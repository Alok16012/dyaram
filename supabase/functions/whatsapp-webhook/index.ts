// Public endpoint (deployed with --no-verify-jwt). Handles:
//   GET  ?hub.mode=subscribe…          Meta webhook verification
//   POST (signed by Meta)              inbound messages + delivery statuses
//   POST ?event=lead_created           new-lead trigger from Postgres (pg_net)
import {
  admin, botOutText, env, fillVars, json, leadVars, normalizePhone, phoneKey, resolveParams, sendBotMessage, sendTemplate, sendText,
} from '../_shared/whatsapp.ts'
import { isGreeting, isMenuWord, startFlow, step, summarize, type BotFlow, type BotSession } from '../_shared/botEngine.ts'

type DB = ReturnType<typeof admin>

const STATUS_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 }
const STOP_WORDS = ['STOP', 'UNSUBSCRIBE', 'STOP ALL']
const START_WORDS = ['START', 'SUBSCRIBE']

async function getAutomation(db: DB, key: string) {
  const { data } = await db.from('wa_automations').select('enabled, config').eq('key', key).maybeSingle()
  return { enabled: !!data?.enabled, config: (data?.config ?? {}) as Record<string, any> }
}

async function verifySignature(raw: string, header: string | null) {
  if (!env.appSecret || !header?.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const hex = Array.from(sig, b => b.toString(16).padStart(2, '0')).join('')
  const given = header.slice(7)
  if (given.length !== hex.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}

function messageText(m: any): string {
  switch (m.type) {
    case 'text':        return m.text?.body ?? ''
    case 'button':      return m.button?.text ?? ''
    case 'interactive': return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? ''
    case 'image': case 'video': case 'document': case 'audio': case 'sticker':
      return `[${m.type}]${m[m.type]?.caption ? ' ' + m[m.type].caption : ''}`
    case 'location':    return `[location] ${m.location?.name ?? ''} ${m.location?.latitude},${m.location?.longitude}`
    default:            return `[${m.type}]`
  }
}

async function findLead(db: DB, phone: string) {
  const { data } = await db.from('leads').select('*').eq('phone_key', phoneKey(phone))
    .order('created_at', { ascending: false }).limit(1)
  return data?.[0] ?? null
}

async function handleInbound(db: DB, m: any, profileName: string) {
  const phone = String(m.from)
  const text = messageText(m)

  // Meta retries webhooks — the unique wa_message_id makes processing idempotent.
  const { data: logged, error: dupErr } = await db.from('wa_messages').insert({
    direction: 'in', phone, kind: 'inbound', body: text, wa_message_id: m.id, status: 'received',
  }).select('id').single()
  if (dupErr) { if (dupErr.code !== '23505') console.error('inbound log', dupErr.message); return }

  const auto = await getAutomation(db, 'inbound_auto_reply')
  const bot = await getAutomation(db, 'menu_bot')
  const botOn = bot.enabled && Array.isArray(bot.config.nodes) && bot.config.nodes.length > 0
  let lead = await findLead(db, phone)
  let isNewLead = false

  if (!lead && auto.config.create_lead !== false) {
    const { data, error } = await db.from('leads').insert({
      name: profileName || `WhatsApp +${phone}`,
      phone: `+${phone}`,
      whatsapp: phone,
      source: 'WhatsApp',
      stage: 'new_inquiry',
      notes: text ? `First WhatsApp message: ${text}` : null,
    }).select('*').single()
    if (error) console.error('lead create', error.message)
    lead = data
    isNewLead = !!data
  } else if (lead && !botOn) {
    await db.from('lead_notes').insert({ lead_id: lead.id, content: `WhatsApp: ${text}`, type: 'whatsapp' })
  }
  if (lead) await db.from('wa_messages').update({ lead_id: lead.id }).eq('id', logged.id)

  // Opt-out / opt-in keywords (required for bulk marketing)
  const word = text.trim().toUpperCase()
  if (lead && (STOP_WORDS.includes(word) || START_WORDS.includes(word))) {
    const optOut = STOP_WORDS.includes(word)
    await db.from('leads').update({ wa_opt_out: optOut }).eq('phone_key', phoneKey(phone))
    const reply = optOut
      ? 'You have been unsubscribed from our WhatsApp updates. Reply START to subscribe again.'
      : 'You are subscribed to our WhatsApp updates again.'
    await sendAndLog(db, phone, reply, 'auto_reply', lead.id)
    return
  }

  // The menu bot, when on, replaces the one-line instant reply.
  if (botOn) {
    const reply_id = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? null
    await runBot(db, phone, { text, reply_id }, lead, profileName, bot.config)
    return
  }

  if (!auto.enabled || !auto.config.message) return
  if (auto.config.only_new_leads && !isNewLead) return

  // Don't auto-reply more than once per cooldown window to the same number.
  const hours = Number(auto.config.cooldown_hours ?? 24)
  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const { count } = await db.from('wa_messages').select('id', { count: 'exact', head: true })
    .eq('phone', phone).eq('kind', 'auto_reply').gte('created_at', since)
  if ((count ?? 0) > 0) return

  const reply = fillVars(auto.config.message, leadVars(lead, profileName))
  await sendAndLog(db, phone, reply, 'auto_reply', lead?.id ?? null)
}

// ── Menu bot ────────────────────────────────────────────────────────────────
async function runBot(
  db: DB, phone: string, input: { text: string; reply_id: string | null },
  lead: Record<string, any> | null, profileName: string, config: Record<string, any>,
) {
  const flow = { nodes: config.nodes } as BotFlow
  const { data: row } = await db.from('wa_sessions').select('*').eq('phone', phone).maybeSingle()
  const ageHours = row ? (Date.now() - new Date(row.updated_at).getTime()) / 3600_000 : Infinity
  const agentHours = Number(config.agent_timeout_hours ?? 24)
  const quietHours = Number(config.restart_after_hours ?? 12)
  const session: BotSession | null = row
    ? { node: row.node, status: row.status, data: row.data ?? {}, retries: row.retries ?? 0 }
    : null

  // Staff is handling this chat, or the bot already finished recently:
  // stay quiet (the message is in the CRM inbox) unless the customer asks for the menu.
  if (session?.status === 'agent' && ageHours < agentHours && !isMenuWord(input.text)) {
    await noteForLead(db, lead, `WhatsApp: ${input.text}`)
    return
  }
  if (session?.status === 'done' && ageHours < quietHours && !isMenuWord(input.text) && !isGreeting(input.text)) {
    await noteForLead(db, lead, `WhatsApp: ${input.text}`)
    return
  }

  const vars = leadVars(lead, profileName)
  const restart = !session || session.status !== 'bot' || ageHours >= quietHours || isMenuWord(input.text) || isGreeting(input.text)
  const res = restart ? startFlow(flow, vars) : step(flow, session, input, vars)

  for (const out of res.outgoing) {
    const msg: Record<string, unknown> = { direction: 'out', phone, kind: 'bot', body: botOutText(out), lead_id: lead?.id ?? null }
    try {
      msg.wa_message_id = await sendBotMessage(phone, out)
      msg.status = 'sent'
    } catch (e) {
      msg.status = 'failed'
      msg.error = (e as Error).message
    }
    await db.from('wa_messages').insert(msg)
  }

  if (lead && Object.keys(res.leadUpdates).length) {
    await db.from('leads').update({ ...res.leadUpdates, updated_at: new Date().toISOString() }).eq('id', lead.id)
  }
  const summary = summarize(flow, res.session.data)
  if (res.events.includes('handoff')) {
    await noteForLead(db, lead, `🙋 Asked to talk to an agent on WhatsApp.${summary ? ' Bot answers — ' + summary : ''}`)
  } else if (res.events.includes('done') && summary) {
    await noteForLead(db, lead, `WhatsApp bot answers — ${summary}`)
  }

  await db.from('wa_sessions').upsert({
    phone, lead_id: lead?.id ?? null, node: res.session.node, status: res.session.status,
    data: res.session.data, retries: res.session.retries, updated_at: new Date().toISOString(),
  }, { onConflict: 'phone' })
}

async function noteForLead(db: DB, lead: Record<string, any> | null, content: string) {
  if (lead) await db.from('lead_notes').insert({ lead_id: lead.id, content, type: 'whatsapp' })
}

async function sendAndLog(db: DB, phone: string, text: string, kind: string, leadId: string | null) {
  const row: Record<string, unknown> = { direction: 'out', phone, kind, body: text, lead_id: leadId }
  try {
    row.wa_message_id = await sendText(phone, text)
    row.status = 'sent'
  } catch (e) {
    row.status = 'failed'
    row.error = (e as Error).message
  }
  await db.from('wa_messages').insert(row)
}

async function handleStatus(db: DB, s: any) {
  const { data: row } = await db.from('wa_messages').select('id, status').eq('wa_message_id', s.id).maybeSingle()
  if (!row) return
  const next = s.status as string
  if (next !== 'failed' && (STATUS_RANK[next] ?? -1) <= (STATUS_RANK[row.status] ?? -1)) return
  if (next === 'failed' && row.status === 'read') return
  const err = s.errors?.[0]
  await db.from('wa_messages').update({
    status: next,
    error: err ? `${err.title ?? err.message ?? 'Error'} (code ${err.code})${err.error_data?.details ? ' — ' + err.error_data.details : ''}` : null,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
}

// New lead from any source → welcome template (if that automation is on).
async function handleLeadCreated(db: DB, leadId: string) {
  const auto = await getAutomation(db, 'new_lead_welcome')
  if (!auto.enabled || !auto.config.template_name) return { skipped: 'automation off' }

  const { data: lead } = await db.from('leads').select('*').eq('id', leadId).maybeSingle()
  if (!lead) return { skipped: 'lead not found' }
  if (lead.wa_opt_out) return { skipped: 'opted out' }
  const skipSources: string[] = auto.config.skip_sources ?? []
  if (skipSources.includes(lead.source)) return { skipped: `source ${lead.source}` }
  const phone = normalizePhone(lead.whatsapp || lead.phone)
  if (!phone) return { skipped: 'no valid phone' }

  const { count: already } = await db.from('wa_messages').select('id', { count: 'exact', head: true })
    .eq('lead_id', lead.id).eq('kind', 'welcome')
  if ((already ?? 0) > 0) return { skipped: 'already welcomed' }

  // Lead came in over WhatsApp and the auto-reply / menu bot already answered it.
  const inbound = await getAutomation(db, 'inbound_auto_reply')
  const bot = await getAutomation(db, 'menu_bot')
  if (inbound.enabled || bot.enabled) {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const { count } = await db.from('wa_messages').select('id', { count: 'exact', head: true })
      .eq('phone', phone).eq('direction', 'in').gte('created_at', since)
    if ((count ?? 0) > 0) return { skipped: 'answered by auto-reply' }
  }

  const vars = leadVars(lead)
  const c = auto.config
  const bodyParams = resolveParams(c.body_params, vars)
  const row: Record<string, unknown> = {
    direction: 'out', phone, lead_id: lead.id, kind: 'welcome', template_name: c.template_name,
    // c.preview is the template body; its {{1}} / {{name}} slots are the param names.
    body: c.preview ? fillVars(c.preview, Object.fromEntries(bodyParams.map(p => [p.name ?? '', p.value]))) : null,
  }
  try {
    row.wa_message_id = await sendTemplate(phone, {
      name: c.template_name,
      language: c.language || 'en',
      header_format: c.header_format ?? null,
      header_media_url: c.header_media_url ?? null,
      header_params: resolveParams(c.header_params, vars),
      body_params: bodyParams,
    })
    row.status = 'sent'
  } catch (e) {
    row.status = 'failed'
    row.error = (e as Error).message
  }
  await db.from('wa_messages').insert(row)
  return { status: row.status, error: row.error }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && env.verifyToken &&
      url.searchParams.get('hub.verify_token') === env.verifyToken
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const db = admin()
  const raw = await req.text()

  if (url.searchParams.get('event') === 'lead_created') {
    if (!env.automationSecret || req.headers.get('x-automation-secret') !== env.automationSecret) {
      return json({ error: 'Forbidden' }, 403)
    }
    try {
      const { lead_id } = JSON.parse(raw || '{}')
      return json(await handleLeadCreated(db, lead_id))
    } catch (e) {
      console.error(e)
      return json({ error: (e as Error).message }, 500)
    }
  }

  if (!(await verifySignature(raw, req.headers.get('x-hub-signature-256')))) {
    console.warn('Rejected webhook: bad or missing signature (is WHATSAPP_APP_SECRET set?)')
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const payload = JSON.parse(raw)
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const v = change.value ?? {}
        if (env.phoneNumberId && v.metadata?.phone_number_id && v.metadata.phone_number_id !== env.phoneNumberId) continue
        const names: Record<string, string> = Object.fromEntries((v.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name ?? '']))
        for (const m of v.messages ?? []) await handleInbound(db, m, names[m.from] ?? '')
        for (const s of v.statuses ?? []) await handleStatus(db, s)
      }
    }
  } catch (e) {
    // Still answer 200 so Meta doesn't keep retrying a payload we can't parse.
    console.error('webhook processing error', e)
  }
  return new Response('ok', { status: 200 })
})
