// CRM → WhatsApp: connection status, approved templates and (bulk) sending.
// Called from the browser with supabase.functions.invoke('whatsapp', …).
import { admin, cors, env, graph, json, normalizePhone, sendTemplate, sendText, type Param, type TemplateSend } from '../_shared/whatsapp.ts'
import { callerAppUser } from '../_shared/auth.ts'

type Recipient = {
  to: string
  lead_id?: string | null
  header_params?: Param[]
  body_params?: Param[]
  preview?: string
}

const CONCURRENCY = 5
const MAX_BATCH = 50

// Caller must be a signed-in, active CRM user with the WhatsApp module.
async function authorize(db: ReturnType<typeof admin>, req: Request) {
  const me = await callerAppUser(db, req)
  return { ok: !!me && (me.is_admin || !!me.permissions?.whatsapp), isAdmin: !!me?.is_admin }
}

// Submit a message template to Meta for approval (admins only).
// body: { name, language, category, components } in Graph API format.
async function createTemplate(body: any) {
  const missing = missingConfig(true)
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const t = body.template ?? {}
  if (!/^[a-z0-9_]{1,512}$/.test(t.name ?? '')) throw new Error('Template name must be lowercase letters, numbers and _')
  const res = await graph(`${env.wabaId}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({ name: t.name, language: t.language || 'en', category: t.category || 'MARKETING', components: t.components ?? [] }),
  })
  return { template: res }
}

async function deleteTemplate(body: any) {
  const missing = missingConfig(true)
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const name = String(body.name ?? '')
  if (!/^[a-z0-9_]{1,512}$/.test(name)) throw new Error('Invalid template name')
  return graph(`${env.wabaId}/message_templates?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
}

function missingConfig(needWaba = false) {
  const missing = []
  if (!env.token) missing.push('WHATSAPP_TOKEN')
  if (!env.phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID')
  if (needWaba && !env.wabaId) missing.push('WHATSAPP_WABA_ID')
  return missing
}

async function status() {
  const missing = missingConfig(true)
  const config = {
    token: !!env.token, phone_number_id: !!env.phoneNumberId, waba_id: !!env.wabaId,
    verify_token: !!env.verifyToken, app_secret: !!env.appSecret, automation_secret: !!env.automationSecret,
  }
  if (missingConfig().length) return { connected: false, config, missing }
  try {
    const phone = await graph(`${env.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`)
    return { connected: true, config, missing, phone }
  } catch (e) {
    return { connected: false, config, missing, error: (e as Error).message }
  }
}

// Approved templates by default; `all` also returns pending / rejected ones
// (with Meta's rejection reason) for the Templates screen.
async function templates(all = false) {
  const missing = missingConfig(true)
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const out: unknown[] = []
  let path: string | null = `${env.wabaId}/message_templates?fields=name,language,status,category,components,rejected_reason&limit=100`
  while (path && out.length < 1000) {
    const page = await graph(path)
    out.push(...(page.data ?? []))
    const next: string | undefined = page.paging?.next
    path = next ? next.replace(/^https:\/\/graph\.facebook\.com\/[^/]+\//, '') : null
  }
  return { templates: all ? out : out.filter((t: any) => t.status === 'APPROVED') }
}

async function sendBatch(db: ReturnType<typeof admin>, body: any) {
  const missing = missingConfig()
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const tpl = body.template as TemplateSend
  if (!tpl?.name) throw new Error('template.name is required')
  const recipients = (body.recipients ?? []) as Recipient[]
  if (recipients.length > MAX_BATCH) throw new Error(`Max ${MAX_BATCH} recipients per call`)
  const campaignId = body.campaign_id ?? null

  const results: { to: string; ok: boolean; id?: string; error?: string }[] = []
  let cursor = 0
  const worker = async () => {
    while (cursor < recipients.length) {
      const r = recipients[cursor++]
      const to = normalizePhone(r.to)
      let row: Record<string, unknown> = {
        direction: 'out', phone: to ?? String(r.to), lead_id: r.lead_id ?? null, campaign_id: campaignId,
        kind: 'template', template_name: tpl.name, body: r.preview ?? null,
      }
      try {
        if (!to) throw new Error('Invalid phone number')
        const id = await sendTemplate(to, { ...tpl, header_params: r.header_params, body_params: r.body_params })
        row = { ...row, wa_message_id: id, status: 'sent' }
        results.push({ to, ok: true, id })
      } catch (e) {
        row = { ...row, status: 'failed', error: (e as Error).message }
        results.push({ to: to ?? String(r.to), ok: false, error: (e as Error).message })
      }
      const { error } = await db.from('wa_messages').insert(row)
      if (error) console.error('wa_messages insert failed', error.message)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, recipients.length) }, worker))
  return { results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length }
}

// Staff reply from the CRM inbox. Free text only works within 24h of the
// customer's last message; Meta rejects it otherwise (error 131047).
// Replying also pauses the menu bot for this chat so it doesn't talk over staff.
async function sendStaffText(db: ReturnType<typeof admin>, body: any) {
  const missing = missingConfig()
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const to = normalizePhone(body.to)
  const text = String(body.text ?? '').trim()
  if (!to) throw new Error('Invalid phone number')
  if (!text) throw new Error('Message is empty')
  const row: Record<string, unknown> = { direction: 'out', phone: to, kind: 'text', body: text, lead_id: body.lead_id ?? null }
  try {
    row.wa_message_id = await sendText(to, text)
    row.status = 'sent'
  } catch (e) {
    row.status = 'failed'
    row.error = (e as Error).message
  }
  const { data } = await db.from('wa_messages').insert(row).select('*').single()
  if (row.status === 'sent') {
    await db.from('wa_sessions').upsert(
      { phone: to, status: 'agent', node: null, updated_at: new Date().toISOString() },
      { onConflict: 'phone' },
    )
  }
  if (row.status === 'failed') throw new Error(String(row.error))
  return { message: data }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const db = admin()
    const auth = await authorize(db, req)
    if (!auth.ok) return json({ error: 'Not allowed to use WhatsApp' }, 403)
    if ((body.action === 'create_template' || body.action === 'delete_template') && !auth.isAdmin) {
      return json({ error: 'Only admins can create or delete templates' }, 403)
    }

    switch (body.action) {
      case 'status':     return json(await status())
      case 'templates':  return json(await templates(!!body.all))
      case 'send_batch': return json(await sendBatch(db, body))
      case 'send_text':  return json(await sendStaffText(db, body))
      case 'subscribe_webhook': {
        // Links this app to the WhatsApp account so Meta sends incoming messages and delivery receipts.
        if (!auth.isAdmin) return json({ error: 'Only admins can change the webhook' }, 403)
        const before = await graph(`${env.wabaId}/subscribed_apps`)
        const res = await graph(`${env.wabaId}/subscribed_apps`, { method: 'POST' })
        const after = await graph(`${env.wabaId}/subscribed_apps`)
        return json({ before: before.data, result: res, after: after.data })
      }
      case 'create_template': return json(await createTemplate(body))
      case 'delete_template': return json(await deleteTemplate(body))
      default:           return json({ error: `Unknown action: ${body.action}` }, 400)
    }
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
