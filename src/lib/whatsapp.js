// WhatsApp Cloud API client for the CRM.
// Live mode: talks to the `whatsapp` Supabase edge function (which holds the
// Meta access token). Demo mode: everything is simulated in localStorage so
// the screens can be shown without a WhatsApp Business account.
import { supabase, isLive } from './supabase'
import { BRAND } from './brand'

// ── Phone numbers ──────────────────────────────────────────────────────────
// Same rules as the edge function: bare 10-digit (or 0-prefixed) numbers are Indian.
export function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) d = '91' + d
  return d.length >= 11 && d.length <= 15 ? d : null
}

export const MSG_TONE = {
  queued: 'gray', sent: 'blue', delivered: 'purple', read: 'green', failed: 'red', received: 'orange',
}

export const formatPhone = (p) => (p ? `+${String(p).replace(/\D/g, '')}` : '—')

// ── Templates ──────────────────────────────────────────────────────────────
const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g

const uniqueVars = (text = '') => [...new Set([...String(text).matchAll(VAR_RE)].map(m => m[1]))]

// Flatten Meta's template object into what the UI needs.
export function parseTemplate(t) {
  if (!t) return null
  const comp = (type) => (t.components || []).find(c => c.type === type)
  const header = comp('HEADER')
  const body = comp('BODY')
  const buttons = comp('BUTTONS')?.buttons || []
  return {
    key: `${t.name}::${t.language}`,
    name: t.name,
    language: t.language,
    category: t.category,
    headerFormat: header?.format || null,
    headerText: header?.format === 'TEXT' ? header.text : '',
    headerVars: header?.format === 'TEXT' ? uniqueVars(header.text) : [],
    bodyText: body?.text || '',
    bodyVars: uniqueVars(body?.text),
    footer: comp('FOOTER')?.text || '',
    buttons: buttons.map(b => b.text),
    dynamicButton: buttons.some(b => b.type === 'URL' && VAR_RE.test(b.url || '')),
  }
}

export const renderText = (text, values = {}) =>
  String(text || '').replace(VAR_RE, (_, k) => (values[k] !== undefined && values[k] !== '' ? values[k] : `{{${k}}}`))

// Where a template variable's value comes from.
export const VAR_SOURCES = [
  { id: 'first_name',  label: 'First name' },
  { id: 'name',        label: 'Full name' },
  { id: 'destination', label: 'Package / destination' },
  { id: 'travel_date', label: 'Travel date' },
  { id: 'phone',       label: 'Phone' },
  { id: 'custom',      label: 'Fixed text…' },
]

export function personVars(p = {}) {
  const name = p.name || ''
  return {
    name,
    first_name: name.split(/\s+/)[0] || '',
    destination: p.destination || '',
    travel_date: p.travel_date
      ? new Date(p.travel_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '',
    phone: p.phone || '',
  }
}

// Sensible default mapping: first variable → first name, the rest → fixed text.
export const defaultMapping = (vars) =>
  vars.map((name, i) => ({ name, source: i === 0 ? 'first_name' : 'custom', custom: '' }))

// mapping: [{ name, source, custom }] → [{ name, value }]
export const resolveParams = (mapping = [], vars = {}) =>
  mapping.map(m => ({ name: m.name, value: m.source === 'custom' ? (m.custom || '') : (vars[m.source] || '') }))

export const paramsToValues = (params = []) => Object.fromEntries(params.map(p => [p.name, p.value]))

// ── Edge function calls ────────────────────────────────────────────────────
async function invoke(action, payload = {}) {
  if (!isLive) return demoInvoke(action, payload)
  const { data, error } = await supabase.functions.invoke('whatsapp', {
    body: { action, ...payload },
  })
  if (error) {
    let msg = error.message
    try { msg = (await error.context.json()).error || msg } catch { /* not JSON */ }
    if (/Failed to send a request|Function not found|404/i.test(msg)) {
      msg = 'WhatsApp function is not deployed yet. See WhatsApp → Setup.'
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export const waStatus = () => invoke('status')
export const waTemplates = async () => (await invoke('templates')).templates || []
// payload: { campaign_id, template: {name, language, header_format, header_media_url}, recipients: [...] }
export const waSendBatch = (payload) => invoke('send_batch', payload)

// Staff reply from the inbox (only inside the 24h customer-service window).
export const waSendText = (payload) => invoke('send_text', payload)

export const BATCH_SIZE = 25

// ── Menu bot ───────────────────────────────────────────────────────────────
const UMRAH_PACKAGES = ['Economy Umrah 15 Days', 'Premium Umrah 15 Days', 'Ramadan Umrah', 'Umrah + Ziyarat']

export const DEFAULT_BOT_FLOW = [
  {
    id: 'start', label: 'Interest', type: 'menu', save_to: 'destination',
    text: `Assalamu Alaikum {{first_name}} 🌙\n\nWelcome to *${BRAND.legalName}*.\nHow can we help you today?`,
    options: [
      { label: 'Umrah packages', value: '', next: 'umrah_package' },
      { label: 'Hajj 2027', value: 'Hajj 2027', next: 'travellers' },
      { label: 'Office & contact', value: '', next: 'contact' },
      { label: 'Talk to an agent', value: '', next: 'agent' },
    ],
  },
  {
    id: 'umrah_package', label: 'Package', type: 'menu', save_to: 'destination',
    text: 'Which Umrah package are you interested in?',
    options: UMRAH_PACKAGES.map(p => ({ label: p, value: p, next: 'travellers' })),
  },
  {
    id: 'travellers', label: 'Travellers', type: 'question', save_to: 'adults', validate: 'number',
    text: 'How many people will travel, including you? Please reply with a number, e.g. *4*',
    next: 'travel_time',
  },
  {
    id: 'travel_time', label: 'Travel time', type: 'question', save_to: '',
    text: 'When are you planning to travel?',
    options: ['Within 1 month', 'In 1–3 months', 'In 3–6 months', 'Not decided yet'].map(l => ({ label: l, value: l, next: 'thanks' })),
    next: 'thanks',
  },
  {
    id: 'thanks', label: 'Thank you', type: 'end',
    text: 'JazakAllah Khair {{first_name}} 🤲\n\nWe have noted: *{{destination}}* for *{{adults}}* traveller(s), {{travel_time}}.\nOur Umrah/Hajj expert will call you shortly with the best price.\n\nType *MENU* anytime to start again.',
  },
  {
    id: 'contact', label: 'Contact info', type: 'message',
    text: `📍 ${BRAND.address}\n📞 ${BRAND.phone}\n🌐 ${BRAND.website}`,
    next: 'start',
  },
  {
    id: 'agent', label: 'Agent handoff', type: 'handoff',
    text: 'Sure 🙂 One of our team members will reply to you here shortly.\nOffice hours: 10 AM – 8 PM.',
  },
]

// ── Automations ────────────────────────────────────────────────────────────
export const AUTOMATION_DEFAULTS = {
  inbound_auto_reply: {
    enabled: false,
    config: {
      message: `Assalamu Alaikum {{first_name}} 🌙\n\nThank you for contacting ${BRAND.name}. We have received your enquiry and our Umrah/Hajj expert will call you shortly.\n\n📞 ${BRAND.phones[0]}\n🌐 ${BRAND.website.replace(/^https?:\/\//, '')}`,
      create_lead: true,
      only_new_leads: false,
      cooldown_hours: 24,
    },
  },
  menu_bot: {
    enabled: false,
    config: { nodes: DEFAULT_BOT_FLOW, agent_timeout_hours: 24, restart_after_hours: 12 },
  },
  new_lead_welcome: {
    enabled: false,
    config: {
      template_name: '', language: 'en', header_format: null, header_media_url: '',
      header_params: [], body_params: [], skip_sources: [], preview: '',
    },
  },
}

export async function getAutomations() {
  const { data } = await supabase.from('wa_automations').select('*')
  const out = structuredClone(AUTOMATION_DEFAULTS)
  for (const row of data || []) {
    if (!out[row.key]) continue
    out[row.key] = { enabled: !!row.enabled, config: { ...out[row.key].config, ...(row.config || {}) } }
  }
  return out
}

export async function saveAutomation(key, enabled, config) {
  const { error } = await supabase.from('wa_automations')
    .upsert([{ key, enabled, config, updated_at: new Date().toISOString() }], { onConflict: 'key' })
  if (error) throw error
}

// ── Campaign stats ─────────────────────────────────────────────────────────
// Live: the wa_campaign_stats view. Demo: counted from the mock message table.
export async function fetchCampaignStats(ids) {
  if (!ids.length) return {}
  if (isLive) {
    const { data, error } = await supabase.from('wa_campaign_stats').select('*').in('campaign_id', ids)
    if (error) throw error
    return Object.fromEntries((data || []).map(r => [r.campaign_id, r]))
  }
  const { data } = await supabase.from('wa_messages').select('*').in('campaign_id', ids)
  const out = {}
  for (const m of data || []) {
    const s = (out[m.campaign_id] ||= { sent: 0, delivered: 0, read: 0, failed: 0 })
    if (m.status === 'failed') s.failed++
    else {
      s.sent++
      if (m.status === 'delivered' || m.status === 'read') s.delivered++
      if (m.status === 'read') s.read++
    }
  }
  return out
}

// ── Demo mode simulation ───────────────────────────────────────────────────
const DEMO_TEMPLATES = [
  {
    name: 'umrah_package_offer', language: 'en', status: 'APPROVED', category: 'MARKETING',
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Assalamu Alaikum {{1}} 🌙\n\nOur *{{2}}* departs soon and only a few seats are left. Packages include visa, flights, hotels near Haram and Ziyarat.\n\nReply *YES* to get the full itinerary and price.' },
      { type: 'FOOTER', text: 'Reply STOP to unsubscribe' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'YES, send details' }, { type: 'PHONE_NUMBER', text: 'Call us' }] },
    ],
  },
  {
    name: 'new_enquiry_welcome', language: 'en', status: 'APPROVED', category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Assalamu Alaikum {{1}}, thank you for your enquiry about {{2}} with Dayare Haram. Our team will contact you shortly.' },
    ],
  },
  {
    name: 'payment_reminder', language: 'en', status: 'APPROVED', category: 'UTILITY',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Payment reminder' },
      { type: 'BODY', text: 'Dear {{1}}, the balance payment for your {{2}} booking is due. Please complete it to confirm your seats.' },
    ],
  },
  {
    name: 'hello_world', language: 'en_US', status: 'APPROVED', category: 'UTILITY',
    components: [{ type: 'BODY', text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API.' }],
  },
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function demoInvoke(action, payload) {
  if (action === 'status') return { connected: false, demo: true, config: {}, missing: [] }
  if (action === 'templates') return { templates: DEMO_TEMPLATES }
  if (action === 'send_text') {
    const phone = normalizePhone(payload.to)
    if (!phone) throw new Error('Invalid phone number')
    const { data } = await supabase.from('wa_messages').insert([{
      direction: 'out', phone, kind: 'text', body: payload.text, lead_id: payload.lead_id || null,
      wa_message_id: `wamid.DEMO${Date.now()}`, status: 'sent',
    }]).select().single()
    await supabase.from('wa_sessions').upsert([{ phone, status: 'agent', node: null, updated_at: new Date().toISOString() }], { onConflict: 'phone' })
    return { message: data }
  }
  if (action === 'send_batch') {
    const results = []
    for (const r of payload.recipients || []) {
      await sleep(60)
      const to = normalizePhone(r.to)
      const ok = !!to
      const row = {
        direction: 'out', phone: to || String(r.to), lead_id: r.lead_id || null, campaign_id: payload.campaign_id || null,
        kind: 'template', template_name: payload.template?.name, body: r.preview || null,
        wa_message_id: ok ? `wamid.DEMO${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}` : null,
        // Pretend some messages already got delivered/read.
        status: !ok ? 'failed' : ['sent', 'delivered', 'delivered', 'read'][Math.floor(Math.random() * 4)],
        error: ok ? null : 'Invalid phone number',
      }
      await supabase.from('wa_messages').insert([row])
      results.push({ to: row.phone, ok, id: row.wa_message_id, error: row.error })
    }
    return { results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length }
  }
  throw new Error(`Unknown action ${action}`)
}

// Demo only: mimic the server-side "welcome new lead" automation so the
// feature can be shown end-to-end without a backend.
export async function simulateLeadWelcome(lead) {
  if (isLive || !lead) return
  const { new_lead_welcome: auto } = await getAutomations()
  if (!auto.enabled || !auto.config.template_name) return
  if ((auto.config.skip_sources || []).includes(lead.source)) return
  const phone = normalizePhone(lead.whatsapp || lead.phone)
  if (!phone) return
  const preview = renderText(auto.config.preview, paramsToValues(resolveParams(auto.config.body_params, personVars(lead))))
  await supabase.from('wa_messages').insert([{
    direction: 'out', phone, lead_id: lead.id, kind: 'welcome', template_name: auto.config.template_name,
    body: preview, wa_message_id: `wamid.DEMO${Date.now()}`, status: 'sent',
  }])
}
