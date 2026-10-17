// Menu-bot flow engine. Pure TypeScript with no imports, so the same file runs
// in the Supabase edge function (Deno) and in the CRM's test-chat simulator (Vite).

export type BotOption = { label: string; value?: string; next?: string }
export type BotNode = {
  id: string
  label?: string                       // short name used in the CRM and lead summary
  type: 'menu' | 'question' | 'message' | 'handoff' | 'end'
  text: string
  options?: BotOption[]                // menu (required) / question (optional quick replies)
  save_to?: '' | 'destination' | 'adults' | 'budget_max'
  validate?: 'text' | 'number'         // question only
  next?: string                        // question (typed answer) / message
  media_type?: '' | 'image' | 'document'
  media_url?: string
}
export type BotFlow = { nodes: BotNode[] }
export type BotSession = { node: string | null; status: 'bot' | 'agent' | 'done'; data: Record<string, string>; retries: number }
export type BotInput = { text: string; reply_id?: string | null }
export type BotOut =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; text: string; options: { id: string; title: string }[] }
  | { kind: 'list'; text: string; button: string; options: { id: string; title: string }[] }
  | { kind: 'media'; media_type: 'image' | 'document'; url: string; caption: string }
export type BotResult = {
  session: BotSession
  outgoing: BotOut[]
  leadUpdates: Record<string, string | number>
  events: ('handoff' | 'done')[]
}

export const START_NODE = 'start'
export const MAX_BUTTONS = 3        // WhatsApp reply buttons
export const MAX_OPTIONS = 10       // WhatsApp list rows
export const BUTTON_TITLE_MAX = 20
export const LIST_TITLE_MAX = 24

const MENU_WORDS = ['menu', 'main menu', 'start over', 'restart', '0']
const GREETINGS = ['hi', 'hii', 'hello', 'hey', 'salam', 'salaam', 'assalamu alaikum', 'assalamualaikum', 'asalam alaikum', 'aoa']

const norm = (s: string) => String(s ?? '').trim().toLowerCase().replace(/[!.?]+$/, '')
export const isMenuWord = (text: string) => MENU_WORDS.includes(norm(text))
export const isGreeting = (text: string) => GREETINGS.includes(norm(text))

export function fill(text: string, vars: Record<string, unknown>) {
  return String(text ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])))
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// Turn an answer into the value stored on the lead.
export function leadFieldValue(field: string, value: string): string | number | null {
  if (field === 'adults') {
    const n = parseInt(String(value).replace(/\D/g, ''), 10)
    return n > 0 && n < 100 ? n : null
  }
  if (field === 'budget_max') {
    const t = String(value).toLowerCase().replace(/,/g, '')
    const n = parseFloat(t.replace(/[^\d.]/g, ''))
    if (!n) return null
    if (/lakh|lac|\bl\b/.test(t)) return Math.round(n * 100000)
    if (/\bk\b|thousand/.test(t)) return Math.round(n * 1000)
    return Math.round(n)
  }
  return value ? String(value) : null
}

function render(node: BotNode, vars: Record<string, unknown>, prefix = ''): BotOut[] {
  const text = (prefix ? prefix + '\n\n' : '') + fill(node.text, vars)
  const opts = node.options ?? []
  if ((node.type === 'menu' || node.type === 'question') && opts.length) {
    const asButtons = opts.length <= MAX_BUTTONS
    const options = opts.slice(0, MAX_OPTIONS).map((o, i) => ({
      id: `${node.id}::${i}`,
      title: cut(o.label, asButtons ? BUTTON_TITLE_MAX : LIST_TITLE_MAX),
    }))
    return [asButtons
      ? { kind: 'buttons', text, options }
      : { kind: 'list', text, button: 'View options', options }]
  }
  if (node.type === 'message' && node.media_type && node.media_url) {
    return [{ kind: 'media', media_type: node.media_type, url: node.media_url, caption: text }]
  }
  return [{ kind: 'text', text }]
}

function matchOption(node: BotNode, input: BotInput) {
  const opts = node.options ?? []
  if (input.reply_id) {
    const [nid, idx] = input.reply_id.split('::')
    if (nid === node.id && opts[Number(idx)]) return Number(idx)
  }
  const t = norm(input.text)
  const num = parseInt(t, 10)
  if (String(num) === t && opts[num - 1]) return num - 1
  const i = opts.findIndex(o => norm(o.label) === t)
  return i >= 0 ? i : -1
}

// Walk forward from `id`, sending nodes until one needs an answer or the flow ends.
function run(flow: BotFlow, id: string | undefined, res: BotResult, vars: Record<string, unknown>) {
  const byId = new Map(flow.nodes.map(n => [n.id, n]))
  let cur = id
  for (let hops = 0; hops < 8; hops++) {
    const node = cur ? byId.get(cur) : undefined
    if (!node) { res.session.status = 'done'; res.session.node = null; res.events.push('done'); return }
    const v = { ...vars, ...res.session.data }
    res.outgoing.push(...render(node, v))
    if (node.type === 'message') { cur = node.next; continue }
    if (node.type === 'handoff') { res.session.status = 'agent'; res.session.node = null; res.events.push('handoff'); return }
    if (node.type === 'end') { res.session.status = 'done'; res.session.node = null; res.events.push('done'); return }
    res.session.node = node.id
    res.session.status = 'bot'
    res.session.retries = 0
    return
  }
  res.session.status = 'done'
  res.session.node = null
}

const emptyResult = (data: Record<string, string> = {}): BotResult => ({
  session: { node: null, status: 'bot', data, retries: 0 },
  outgoing: [], leadUpdates: {}, events: [],
})

export function startFlow(flow: BotFlow, vars: Record<string, unknown>): BotResult {
  const res = emptyResult()
  run(flow, START_NODE, res, vars)
  return res
}

export function step(flow: BotFlow, session: BotSession | null, input: BotInput, vars: Record<string, unknown>): BotResult {
  if (!session || session.status !== 'bot' || !session.node) return startFlow(flow, vars)
  const node = flow.nodes.find(n => n.id === session.node)
  if (!node) return startFlow(flow, vars)

  const res = emptyResult({ ...session.data })
  res.session.retries = session.retries
  const v = { ...vars, ...res.session.data }
  let value = ''
  let label = ''
  let next: string | undefined

  const idx = matchOption(node, input)
  if (idx >= 0) {
    const o = node.options![idx]
    label = o.label
    value = o.value ?? ''
    next = o.next || node.next
  } else if (node.type === 'menu') {
    res.session.node = node.id
    res.session.retries = session.retries + 1
    res.outgoing.push(...render(node, v, 'Please choose one of the options 👇'))
    return res
  } else {
    // question with a typed answer
    const text = String(input.text ?? '').trim()
    if (!text || (node.validate === 'number' && !/\d/.test(text))) {
      res.session.node = node.id
      res.session.retries = session.retries + 1
      res.outgoing.push(...render(node, v, node.validate === 'number' ? 'Please reply with a number 🙏' : 'Please type your answer 🙏'))
      return res
    }
    label = text
    value = text
    next = node.next
  }

  res.session.data[node.id] = label
  if (node.save_to && value) {
    const fieldVal = leadFieldValue(node.save_to, value)
    if (fieldVal != null) {
      res.leadUpdates[node.save_to] = fieldVal
      res.session.data[node.save_to] = String(fieldVal)
    }
  }
  run(flow, next, res, vars)
  return res
}

// "Package: Economy Umrah · Travellers: 4 · Travel time: In 1–3 months"
export function summarize(flow: BotFlow, data: Record<string, string>) {
  return flow.nodes
    .filter(n => (n.type === 'menu' || n.type === 'question') && data[n.id])
    .map(n => `${n.label || n.id}: ${data[n.id]}`)
    .join(' · ')
}

// Problems shown in the flow editor before saving.
export function validateFlow(flow: BotFlow): string[] {
  const errs: string[] = []
  const ids = new Set(flow.nodes.map(n => n.id))
  if (!ids.has(START_NODE)) errs.push('The flow needs a "start" step.')
  for (const n of flow.nodes) {
    const name = n.label || n.id
    if (!String(n.text ?? '').trim()) errs.push(`"${name}" has no message text.`)
    const opts = n.options ?? []
    if (n.type === 'menu' && opts.length === 0) errs.push(`"${name}" needs at least one option.`)
    if (opts.length > MAX_OPTIONS) errs.push(`"${name}" has more than ${MAX_OPTIONS} options.`)
    opts.forEach((o, i) => {
      if (!o.label.trim()) errs.push(`"${name}" option ${i + 1} has no text.`)
      const max = opts.length <= MAX_BUTTONS ? BUTTON_TITLE_MAX : LIST_TITLE_MAX
      if (o.label.length > max) errs.push(`"${name}" option "${o.label}" is longer than ${max} characters.`)
      if (o.next && !ids.has(o.next)) errs.push(`"${name}" option "${o.label}" goes to a missing step.`)
    })
    if (n.next && !ids.has(n.next)) errs.push(`"${name}" goes to a missing step.`)
    if (n.type === 'message' && n.media_type && !/^https:\/\//.test(n.media_url ?? '')) errs.push(`"${name}" needs a public https media link.`)
  }
  return errs
}
