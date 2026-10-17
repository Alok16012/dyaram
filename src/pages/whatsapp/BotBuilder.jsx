import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Bot, Save, Plus, Trash2, RotateCcw, Send, ListChecks, HelpCircle, MessageSquareText, Headset, Flag, AlertTriangle } from 'lucide-react'
import { saveAutomation, DEFAULT_BOT_FLOW } from '../../lib/whatsapp'
import {
  startFlow, step, validateFlow, START_NODE, MAX_OPTIONS, MAX_BUTTONS, BUTTON_TITLE_MAX, LIST_TITLE_MAX,
} from '../../../supabase/functions/_shared/botEngine.ts'
import { Toggle } from './shared'

const TYPES = {
  menu:     { label: 'Menu',          icon: ListChecks,        hint: 'Shows buttons (up to 3) or a list (up to 10). Each option can go to a different step.' },
  question: { label: 'Question',      icon: HelpCircle,        hint: 'Asks something and waits for a typed answer. Optional quick-reply options.' },
  message:  { label: 'Message',       icon: MessageSquareText, hint: 'Sends information (text, image or PDF) and moves straight on.' },
  handoff:  { label: 'Agent handoff', icon: Headset,           hint: 'Sends this text, pauses the bot and flags the chat for your team in the Inbox.' },
  end:      { label: 'End',           icon: Flag,              hint: 'Sends this text and finishes. The answers are saved to the lead’s notes.' },
}
const SAVE_FIELDS = [
  { id: '', label: 'Don’t save to lead' },
  { id: 'destination', label: 'Lead → Package / destination' },
  { id: 'adults', label: 'Lead → No. of travellers' },
  { id: 'budget_max', label: 'Lead → Budget' },
]
const TEXT_VARS = ['first_name', 'destination', 'adults']
const SAMPLE_VARS = { name: 'Rahul Khan', first_name: 'Rahul', destination: '', phone: '+91 98765 43210' }

const uid = (type, nodes) => {
  let i = nodes.length + 1
  while (nodes.some(n => n.id === `${type}_${i}`)) i++
  return `${type}_${i}`
}

function NextSelect({ nodes, value, onChange, self, allowEnd = true }) {
  return (
    <select className="glass-input" value={value || ''} onChange={e => onChange(e.target.value)}>
      {allowEnd && <option value="">— end chat —</option>}
      {nodes.filter(n => n.id !== self).map(n => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}
    </select>
  )
}

function NodeCard({ node, nodes, onChange, onDelete }) {
  const T = TYPES[node.type]
  const set = (patch) => onChange({ ...node, ...patch })
  const opts = node.options || []
  const titleMax = opts.length <= MAX_BUTTONS ? BUTTON_TITLE_MAX : LIST_TITLE_MAX
  const setOpt = (i, patch) => set({ options: opts.map((o, j) => (j === i ? { ...o, ...patch } : o)) })
  const textRef = useRef(null)
  const insertVar = (v) => {
    const el = textRef.current
    const at = el?.selectionStart ?? node.text.length
    set({ text: node.text.slice(0, at) + `{{${v}}}` + node.text.slice(el?.selectionEnd ?? at) })
  }

  return (
    <div className={`wa-node wa-node-${node.type}`}>
      <div className="wa-node-head">
        <span className="wa-node-type"><T.icon size={14} /> {T.label}</span>
        <input className="glass-input wa-node-label" value={node.label || ''} onChange={e => set({ label: e.target.value })} placeholder="Step name" aria-label="Step name" />
        <code className="wa-node-id">{node.id === START_NODE ? 'start ★' : node.id}</code>
        {node.id !== START_NODE && <button className="icon-action danger" onClick={onDelete} title="Delete step"><Trash2 size={14} /></button>}
      </div>
      <p className="wa-hint" style={{ margin: '0 0 8px' }}>{T.hint}</p>

      <div className="form-field">
        <textarea ref={textRef} className="glass-input" rows={3} value={node.text} onChange={e => set({ text: e.target.value })} placeholder="Message text" />
        <div className="wa-chips">
          {TEXT_VARS.map(v => <button key={v} type="button" className="wa-chip" onClick={() => insertVar(v)}>+ {`{{${v}}}`}</button>)}
        </div>
      </div>

      {(node.type === 'menu' || node.type === 'question') && (
        <div style={{ marginTop: 10 }}>
          <label className="form-label">
            {node.type === 'menu' ? 'Options' : 'Quick-reply options (optional)'}
            <span className="dim"> · {opts.length <= MAX_BUTTONS ? `buttons, max ${BUTTON_TITLE_MAX} chars` : `list, max ${LIST_TITLE_MAX} chars`}</span>
          </label>
          {opts.map((o, i) => (
            <div className="wa-opt-row" key={i}>
              <span className="wa-opt-num">{i + 1}</span>
              <input className="glass-input" value={o.label} maxLength={LIST_TITLE_MAX} onChange={e => setOpt(i, { label: e.target.value })} placeholder="Option text"
                style={o.label.length > titleMax ? { borderColor: 'var(--danger)' } : undefined} />
              <input className="glass-input" value={o.value || ''} onChange={e => setOpt(i, { value: e.target.value })} placeholder="Save as (optional)" title="Value saved to the lead field below" />
              <NextSelect nodes={nodes} self={node.id} value={o.next} onChange={v => setOpt(i, { next: v })} />
              <button className="icon-action" onClick={() => set({ options: opts.filter((_, j) => j !== i) })} title="Remove option"><Trash2 size={13} /></button>
            </div>
          ))}
          {opts.length < MAX_OPTIONS && (
            <button className="btn btn-ghost btn-sm" onClick={() => set({ options: [...opts, { label: '', value: '', next: '' }] })}><Plus size={13} /> Add option</button>
          )}
        </div>
      )}

      <div className="form-row" style={{ marginTop: 10 }}>
        {(node.type === 'menu' || node.type === 'question') && (
          <div className="form-field">
            <label>Save answer to</label>
            <select className="glass-input" value={node.save_to || ''} onChange={e => set({ save_to: e.target.value })}>
              {SAVE_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
        )}
        {node.type === 'question' && (
          <>
            <div className="form-field">
              <label>Answer must be</label>
              <select className="glass-input" value={node.validate || 'text'} onChange={e => set({ validate: e.target.value })}>
                <option value="text">Any text</option>
                <option value="number">A number</option>
              </select>
            </div>
            <div className="form-field">
              <label>After a typed answer, go to</label>
              <NextSelect nodes={nodes} self={node.id} value={node.next} onChange={v => set({ next: v })} />
            </div>
          </>
        )}
        {node.type === 'message' && (
          <>
            <div className="form-field">
              <label>Attach</label>
              <select className="glass-input" value={node.media_type || ''} onChange={e => set({ media_type: e.target.value })}>
                <option value="">Nothing</option>
                <option value="image">Image</option>
                <option value="document">PDF / document</option>
              </select>
            </div>
            {node.media_type && (
              <div className="form-field">
                <label>Public https link</label>
                <input className="glass-input" value={node.media_url || ''} onChange={e => set({ media_url: e.target.value.trim() })} placeholder="https://…/itinerary.pdf" />
              </div>
            )}
            <div className="form-field">
              <label>Then go to</label>
              <NextSelect nodes={nodes} self={node.id} value={node.next} onChange={v => set({ next: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Test chat: runs the same engine as the server, nothing is sent ──
function Simulator({ nodes }) {
  const [chat, setChat] = useState([])
  const [session, setSession] = useState(null)
  const [lead, setLead] = useState({})
  const [text, setText] = useState('')
  const endRef = useRef(null)

  const apply = (res, userMsg) => {
    setChat(c => [...c, ...(userMsg ? [{ me: true, text: userMsg }] : []), ...res.outgoing.map(out => ({ out }))])
    setSession(res.session)
    setLead(l => ({ ...l, ...res.leadUpdates }))
  }
  const restart = () => {
    setChat([]); setLead({})
    apply(startFlow({ nodes }, SAMPLE_VARS))
  }
  // Start once on mount; later flow edits apply on the next "Restart".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { restart() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [chat])

  const send = (input) => {
    const msg = input.text.trim()
    if (!msg) return
    const vars = { ...SAMPLE_VARS, ...lead }
    // Like the server: a finished / handed-over chat starts again on a new message.
    const res = session?.status === 'bot' ? step({ nodes }, session, input, vars) : startFlow({ nodes }, vars)
    apply(res, msg)
    setText('')
  }

  const status = session?.status === 'agent' ? { label: 'Handed to agent', tone: 'orange' }
    : session?.status === 'done' ? { label: 'Finished', tone: 'green' } : { label: 'Bot waiting for reply', tone: 'blue' }

  return (
    <div className="wa-phone wa-sim">
      <div className="wa-sim-head">
        <span>Test chat · nothing is sent</span>
        <button className="btn btn-ghost btn-sm" onClick={restart}><RotateCcw size={13} /> Restart</button>
      </div>
      <div className="wa-sim-body">
        {chat.map((m, i) => m.me ? (
          <div key={i} className="wa-bubble out" style={{ maxWidth: '80%' }}>{m.text}</div>
        ) : (
          <div key={i} style={{ maxWidth: '88%' }}>
            <div className="wa-bubble">
              {m.out.kind === 'media' && <div className="wa-bubble-media">{m.out.media_type}</div>}
              {m.out.kind === 'media' ? m.out.caption : m.out.text}
            </div>
            {(m.out.kind === 'buttons' || m.out.kind === 'list') && (
              <div className={m.out.kind === 'list' ? 'wa-sim-list' : ''}>
                {m.out.kind === 'list' && <div className="wa-sim-list-head">☰ View options</div>}
                {m.out.options.map(o => (
                  <button key={o.id} className="wa-bubble-btn wa-sim-opt" onClick={() => send({ text: o.title, reply_id: o.id })}>{o.title}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="wa-sim-status">
        <span className={`pill pill-${status.tone}`}>{status.label}</span>
        {Object.keys(lead).length > 0 && <span className="wa-hint">Lead: {Object.entries(lead).map(([k, v]) => `${k} = ${v}`).join(', ')}</span>}
      </div>
      <form className="wa-sim-input" onSubmit={e => { e.preventDefault(); send({ text }) }}>
        <input className="glass-input" value={text} onChange={e => setText(e.target.value)} placeholder="Type a reply…" aria-label="Test message" />
        <button className="btn btn-primary btn-sm" type="submit" aria-label="Send"><Send size={14} /></button>
      </form>
    </div>
  )
}

export default function BotBuilder({ initial }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [nodes, setNodes] = useState(initial.config.nodes?.length ? initial.config.nodes : DEFAULT_BOT_FLOW)
  const [agentHours, setAgentHours] = useState(initial.config.agent_timeout_hours ?? 24)
  const [quietHours, setQuietHours] = useState(initial.config.restart_after_hours ?? 12)
  const [saving, setSaving] = useState(false)
  const [simKey, setSimKey] = useState(0)
  const errors = validateFlow({ nodes })

  const update = (id, node) => setNodes(ns => ns.map(n => (n.id === id ? node : n)))
  const remove = (id) => setNodes(ns => ns.filter(n => n.id !== id).map(n => ({
    ...n,
    next: n.next === id ? '' : n.next,
    options: n.options?.map(o => (o.next === id ? { ...o, next: '' } : o)),
  })))
  const add = (type) => setNodes(ns => [...ns, {
    id: uid(type, ns), label: '', type, text: '',
    ...(type === 'menu' ? { options: [{ label: '', value: '', next: '' }], save_to: '' } : {}),
    ...(type === 'question' ? { options: [], save_to: '', validate: 'text', next: '' } : {}),
    ...(type === 'message' ? { next: '' } : {}),
  }])

  const save = async () => {
    if (enabled && errors.length) return toast.error('Fix the problems in the flow first')
    setSaving(true)
    try {
      await saveAutomation('menu_bot', enabled, { nodes, agent_timeout_hours: Number(agentHours) || 24, restart_after_hours: Number(quietHours) || 12 })
      toast.success(enabled ? 'Menu bot saved and switched on' : 'Menu bot saved')
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  return (
    <section className="card wa-auto-card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Bot size={18} style={{ verticalAlign: -3, marginRight: 6 }} />WhatsApp menu bot</h3>
          <p className="card-subtitle">Talks to every enquiry with buttons, asks your questions, fills the lead and hands over to your team when asked. When on, it replaces the instant reply below.</p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'On' : 'Off'} />
      </div>
      <div className="card-body">
        <div className="wa-grid">
          <div>
            <div className="wa-steps">
              {nodes.map(n => (
                <NodeCard key={n.id} node={n} nodes={nodes} onChange={node => update(n.id, node)} onDelete={() => remove(n.id)} />
              ))}
            </div>
            <div className="wa-add-steps">
              <span className="wa-hint">Add step:</span>
              {Object.entries(TYPES).map(([type, T]) => (
                <button key={type} className="btn btn-ghost btn-sm" onClick={() => add(type)}><T.icon size={13} /> {T.label}</button>
              ))}
            </div>

            <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-field">
                <label>After handoff, keep the bot quiet for (hours)</label>
                <input className="glass-input" type="number" min={1} max={168} value={agentHours} onChange={e => setAgentHours(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Start the menu again after (hours of silence)</label>
                <input className="glass-input" type="number" min={1} max={168} value={quietHours} onChange={e => setQuietHours(e.target.value)} />
              </div>
            </div>
            <p className="wa-hint" style={{ marginTop: 8 }}>
              Customers can type <b>MENU</b> or say hi/salam anytime to start over. Typing an option’s number (1, 2, 3…) also works.
              When a staff member replies from the Inbox, the bot pauses for that chat.
            </p>

            {errors.length > 0 && (
              <div className="wa-banner warn" style={{ marginTop: 12, marginBottom: 0 }}>
                <AlertTriangle size={16} />
                <div>{errors.map(e => <div key={e}>{e}</div>)}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save menu bot'}</button>
              <button className="btn btn-ghost" onClick={() => { if (window.confirm('Replace your flow with the default Hajj/Umrah flow?')) { setNodes(DEFAULT_BOT_FLOW); setSimKey(k => k + 1) } }}>
                <RotateCcw size={15} /> Reset to default flow
              </button>
            </div>
          </div>
          <div style={{ position: 'sticky', top: 86 }}>
            <Simulator key={simKey} nodes={nodes} />
          </div>
        </div>
      </div>
    </section>
  )
}
