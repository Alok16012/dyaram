// CRM → WhatsApp: connection status, approved templates and (bulk) sending.
// Called from the browser with supabase.functions.invoke('whatsapp', …).
import { admin, cors, env, graph, json, normalizePhone, sendTemplate, sendText, type Param, type TemplateSend } from '../_shared/whatsapp.ts'

type Recipient = {
  to: string
  lead_id?: string | null
  header_params?: Param[]
  body_params?: Param[]
  preview?: string
}

const CONCURRENCY = 5
const MAX_BATCH = 50

// The CRM uses its own app_users login (no Supabase Auth), so the caller
// passes its user id and we check it is an active user allowed to use WhatsApp.
async function authorize(db: ReturnType<typeof admin>, userId: unknown) {
  if (!userId || typeof userId !== 'string') return false
  const { data } = await db.from('app_users').select('id, active, is_admin, permissions').eq('id', userId).maybeSingle()
  if (!data || data.active === false) return false
  return data.is_admin || !!data.permissions?.whatsapp
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

async function templates() {
  const missing = missingConfig(true)
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const out: unknown[] = []
  let path: string | null = `${env.wabaId}/message_templates?fields=name,language,status,category,components&limit=100`
  while (path && out.length < 1000) {
    const page = await graph(path)
    out.push(...(page.data ?? []))
    const next: string | undefined = page.paging?.next
    path = next ? next.replace(/^https:\/\/graph\.facebook\.com\/[^/]+\//, '') : null
  }
  return { templates: out.filter((t: any) => t.status === 'APPROVED') }
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
    if (!(await authorize(db, body.user_id))) return json({ error: 'Not allowed to use WhatsApp' }, 403)

    switch (body.action) {
      case 'status':     return json(await status())
      case 'templates':  return json(await templates())
      case 'send_batch': return json(await sendBatch(db, body))
      case 'send_text':  return json(await sendStaffText(db, body))
      default:           return json({ error: `Unknown action: ${body.action}` }, 400)
    }
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
