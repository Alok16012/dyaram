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
// body.media_url (optional): public image saved as the default header for Bulk Send.
async function createTemplate(db: ReturnType<typeof admin>, body: any) {
  const missing = missingConfig(true)
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const t = body.template ?? {}
  if (!/^[a-z0-9_]{1,512}$/.test(t.name ?? '')) throw new Error('Template name must be lowercase letters, numbers and _')
  const res = await graph(`${env.wabaId}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({ name: t.name, language: t.language || 'en', category: t.category || 'MARKETING', components: t.components ?? [] }),
  })
  if (/^https:\/\//.test(body.media_url ?? '')) {
    const { error } = await db.from('wa_template_media').upsert({
      key: `${t.name}::${t.language || 'en'}`, url: body.media_url, updated_at: new Date().toISOString(),
    })
    if (error) console.error('wa_template_media upsert failed', error.message)
  }
  return { template: res }
}

const MEDIA_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' }
const MAX_IMAGE = 5 * 1024 * 1024

// Meta app id, needed for the resumable upload API (from the token itself).
let appIdCache = Deno.env.get('WHATSAPP_APP_ID') ?? ''
async function appId() {
  if (!appIdCache) {
    const d = await graph(`debug_token?input_token=${env.token}`)
    appIdCache = String(d.data?.app_id ?? '')
    if (!appIdCache) throw new Error('Could not read the Meta app id from the token')
  }
  return appIdCache
}

// Uploads a sample file to Meta and returns the handle a template needs for
// review (example.header_handle).
async function metaUploadHandle(bytes: Uint8Array, mime: string, name: string) {
  const session = await graph(`${await appId()}/uploads?file_name=${encodeURIComponent(name)}&file_length=${bytes.length}&file_type=${encodeURIComponent(mime)}`, { method: 'POST' })
  const res = await fetch(`https://graph.facebook.com/${env.apiVersion}/${session.id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${env.token}`, file_offset: '0' },
    body: bytes,
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || !out.h) throw new Error(out.error?.message ?? `Meta upload failed (HTTP ${res.status})`)
  return out.h as string
}

// body: { filename, mime, data (base64), for_template? }
// Stores the image in the public wa-media bucket (WhatsApp fetches header images
// by URL) and, for a new template, also uploads it to Meta for review.
async function uploadMedia(db: ReturnType<typeof admin>, body: any) {
  const mime = String(body.mime ?? '')
  const ext = MEDIA_TYPES[mime]
  if (!ext) throw new Error('Only JPG or PNG images are allowed')
  const bytes = Uint8Array.from(atob(String(body.data ?? '')), c => c.charCodeAt(0))
  if (!bytes.length) throw new Error('Empty file')
  if (bytes.length > MAX_IMAGE) throw new Error('Image must be 5 MB or smaller')
  const base = String(body.filename ?? 'image').replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image'
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID().slice(0, 8)}-${base}.${ext}`
  const { error } = await db.storage.from('wa-media').upload(path, bytes, { contentType: mime, upsert: false })
  if (error) throw new Error(`Could not save the image: ${error.message}`)
  const url = db.storage.from('wa-media').getPublicUrl(path).data.publicUrl
  const handle = body.for_template ? await metaUploadHandle(bytes, mime, `${base}.${ext}`) : null
  return { url, handle }
}

async function deleteTemplate(db: ReturnType<typeof admin>, body: any) {
  const missing = missingConfig(true)
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  const name = String(body.name ?? '')
  if (!/^[a-z0-9_]{1,512}$/.test(name)) throw new Error('Invalid template name')
  const res = await graph(`${env.wabaId}/message_templates?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
  await db.from('wa_template_media').delete().like('key', `${name}::%`)
  return res
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
    const templateAdmin = body.action === 'create_template' || body.action === 'delete_template' ||
      (body.action === 'upload_media' && body.for_template)
    if (templateAdmin && !auth.isAdmin) {
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
      case 'upload_media': return json(await uploadMedia(db, body))
      case 'create_template': return json(await createTemplate(db, body))
      case 'delete_template': return json(await deleteTemplate(db, body))
      default:           return json({ error: `Unknown action: ${body.action}` }, 400)
    }
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
