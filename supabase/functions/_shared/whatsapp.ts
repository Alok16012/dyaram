// Shared helpers for the WhatsApp edge functions (Meta WhatsApp Cloud API).
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { BotOut } from './botEngine.ts'

export const env = {
  token:         Deno.env.get('WHATSAPP_TOKEN') ?? '',            // permanent System User token
  phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
  wabaId:        Deno.env.get('WHATSAPP_WABA_ID') ?? '',          // WhatsApp Business Account id
  verifyToken:   Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '',     // any string, also typed into Meta's webhook form
  appSecret:     Deno.env.get('WHATSAPP_APP_SECRET') ?? '',       // Meta app secret, used to sign webhooks
  apiVersion:    Deno.env.get('WHATSAPP_API_VERSION') ?? 'v23.0',
  automationSecret: Deno.env.get('WA_AUTOMATION_SECRET') ?? '',
}

const GRAPH = () => `https://graph.facebook.com/${env.apiVersion}`

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Service-role client: edge functions get these two env vars automatically.
export const admin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

// ── Phone numbers ───────────────────────────────────────────────────────────
// WhatsApp wants the full international number as digits. Bare 10-digit
// numbers (and 0-prefixed 11-digit ones) are treated as Indian.
export function normalizePhone(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) d = '91' + d
  return d.length >= 11 && d.length <= 15 ? d : null
}

export const phoneKey = (p: string) => p.replace(/\D/g, '').slice(-10)

// ── Graph API ───────────────────────────────────────────────────────────────
export async function graph(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH()}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    const e = body.error ?? {}
    const detail = e.error_data?.details ? ` — ${e.error_data.details}` : ''
    throw new Error(`${e.message ?? `HTTP ${res.status}`}${e.code ? ` (code ${e.code})` : ''}${detail}`)
  }
  return body
}

export type Param = { name?: string; value: string }
export type TemplateSend = {
  name: string
  language: string
  header_format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null
  header_media_url?: string | null
  header_params?: Param[]
  body_params?: Param[]
}

const textParam = (p: Param) => {
  const out: Record<string, string> = { type: 'text', text: String(p.value ?? '').trim() || '-' }
  if (p.name && !/^\d+$/.test(p.name)) out.parameter_name = p.name
  return out
}

export function buildTemplateComponents(t: TemplateSend) {
  const components: unknown[] = []
  const fmt = t.header_format
  if (fmt && fmt !== 'TEXT' && t.header_media_url) {
    const kind = fmt.toLowerCase()
    components.push({ type: 'header', parameters: [{ type: kind, [kind]: { link: t.header_media_url } }] })
  } else if (fmt === 'TEXT' && t.header_params?.length) {
    components.push({ type: 'header', parameters: t.header_params.map(textParam) })
  }
  if (t.body_params?.length) {
    components.push({ type: 'body', parameters: t.body_params.map(textParam) })
  }
  return components
}

export async function sendTemplate(to: string, t: TemplateSend): Promise<string> {
  const components = buildTemplateComponents(t)
  const body = await graph(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: t.name, language: { code: t.language || 'en' }, ...(components.length ? { components } : {}) },
    }),
  })
  return body.messages?.[0]?.id
}

// Free-form text — only allowed inside the 24h customer-service window,
// i.e. as a reply to someone who messaged us.
export async function sendText(to: string, text: string): Promise<string> {
  const body = await graph(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: true } }),
  })
  return body.messages?.[0]?.id
}

// Menu-bot output → Cloud API message (reply buttons, list, media or text).
export async function sendBotMessage(to: string, out: BotOut): Promise<string> {
  let message: Record<string, unknown>
  if (out.kind === 'buttons') {
    message = {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: out.text.slice(0, 1024) },
        action: { buttons: out.options.map(o => ({ type: 'reply', reply: { id: o.id, title: o.title } })) },
      },
    }
  } else if (out.kind === 'list') {
    message = {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: out.text.slice(0, 1024) },
        action: { button: out.button, sections: [{ title: 'Options', rows: out.options.map(o => ({ id: o.id, title: o.title })) }] },
      },
    }
  } else if (out.kind === 'media') {
    const media: Record<string, string> = { link: out.url }
    if (out.caption) media.caption = out.caption.slice(0, 1024)
    if (out.media_type === 'document') media.filename = decodeURIComponent(out.url.split('/').pop()?.split('?')[0] || 'document.pdf')
    message = { type: out.media_type, [out.media_type]: media }
  } else {
    return sendText(to, out.text)
  }
  const body = await graph(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
  })
  return body.messages?.[0]?.id
}

// Plain-text version of a bot message for the CRM message log.
export function botOutText(out: BotOut) {
  if (out.kind === 'buttons' || out.kind === 'list') return `${out.text}\n${out.options.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`
  if (out.kind === 'media') return `[${out.media_type}] ${out.caption}`
  return out.text
}

// {{name}}, {{first_name}}, {{destination}}… in automation texts.
export function fillVars(text: string, vars: Record<string, string>) {
  return String(text ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '')
}

// Template variable mapping saved by the CRM: [{ name, source, custom }]
// where source is a leadVars() key or 'custom' (fixed text).
export type ParamMap = { name?: string; source: string; custom?: string }
export const resolveParams = (map: ParamMap[] = [], vars: Record<string, string>): Param[] =>
  map.map(m => ({ name: m.name, value: m.source === 'custom' ? (m.custom ?? '') : (vars[m.source] ?? '') }))

export function leadVars(lead: Record<string, any> | null, profileName = '') {
  const name = lead?.name || profileName || ''
  return {
    name,
    first_name: name.split(/\s+/)[0] || '',
    destination: lead?.destination || '',
    travel_date: lead?.travel_date
      ? new Date(lead.travel_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '',
    phone: lead?.phone || '',
  }
}
