import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Inbox as InboxIcon, RefreshCw, Search, Send, ArrowLeft, Bot, Headset, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCRM } from '../../context/CRMContext'
import { formatPhone, waSendText, MSG_TONE } from '../../lib/whatsapp'
import { Avatar, EmptyState, Pill } from '../../components/ui'
import { timeAgo } from '../../lib/ui'

const KIND_LABEL = { template: 'Bulk', welcome: 'Welcome', auto_reply: 'Auto-reply', bot: 'Bot', text: 'Team' }
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'agent', label: 'Needs agent' },
  { id: 'failed', label: 'Failed' },
]
const WINDOW_MS = 24 * 3600_000
const POLL_MS = 20_000

const SESSION_TAG = {
  agent: { tone: 'orange', label: 'Needs agent' },
  bot: { tone: 'blue', label: 'With bot' },
  done: { tone: 'green', label: 'Bot finished' },
}

export default function Inbox({ refreshKey }) {
  const { leads, fetchLeads } = useCRM()
  const navigate = useNavigate()
  const [messages, setMessages] = useState(null)
  const [sessions, setSessions] = useState({})
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [openPhone, setOpenPhone] = useState(null)
  const [thread, setThread] = useState([])
  const [windowOpen, setWindowOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  const load = useCallback(async () => {
    const [{ data: msgs }, { data: sess }] = await Promise.all([
      supabase.from('wa_messages').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('wa_sessions').select('*'),
    ])
    setMessages(msgs || [])
    setSessions(Object.fromEntries((sess || []).map(s => [s.phone, s])))
  }, [])

  const loadThread = useCallback(async (phone) => {
    if (!phone) return
    const { data } = await supabase.from('wa_messages').select('*').eq('phone', phone).order('created_at', { ascending: true }).limit(300)
    const rows = data || []
    const lastIn = [...rows].reverse().find(m => m.direction === 'in')
    setThread(rows)
    setWindowOpen(!!lastIn && Date.now() - new Date(lastIn.created_at).getTime() < WINDOW_MS)
  }, [])

  useEffect(() => { load(); fetchLeads() }, [load, fetchLeads, refreshKey])
  useEffect(() => { loadThread(openPhone) }, [openPhone, loadThread])

  // Light polling so new enquiries show up without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      load()
      loadThread(openPhone)
    }, POLL_MS)
    return () => clearInterval(t)
  }, [load, loadThread, openPhone])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [thread])

  const leadById = useMemo(() => Object.fromEntries(leads.map(l => [l.id, l])), [leads])

  // One conversation per phone number, newest first.
  const conversations = useMemo(() => {
    const map = new Map()
    for (const m of messages || []) {
      let c = map.get(m.phone)
      if (!c) { c = { phone: m.phone, last: m, leadId: null, failed: 0, lastIn: null }; map.set(m.phone, c) }
      if (!c.leadId && m.lead_id) c.leadId = m.lead_id
      if (m.status === 'failed') c.failed++
      if (m.direction === 'in' && !c.lastIn) c.lastIn = m.created_at
    }
    return [...map.values()].map(c => ({ ...c, lead: leadById[c.leadId] || null, session: sessions[c.phone] || null }))
  }, [messages, leadById, sessions])

  const shown = conversations.filter(c => {
    if (filter === 'agent' && c.session?.status !== 'agent') return false
    if (filter === 'failed' && !c.failed) return false
    const term = q.trim().toLowerCase()
    return !term || [c.phone, c.lead?.name, c.last.body].some(v => String(v || '').toLowerCase().includes(term))
  })
  const agentCount = conversations.filter(c => c.session?.status === 'agent').length

  const open = conversations.find(c => c.phone === openPhone) || null
  const name = open?.lead?.name || formatPhone(openPhone)

  const send = async () => {
    const text = reply.trim()
    if (!text) return
    setSending(true)
    try {
      await waSendText({ to: openPhone, text, lead_id: open?.leadId || null })
      setReply('')
      await Promise.all([loadThread(openPhone), load()])
    } catch (e) {
      toast.error(e.message, { duration: 8000 })
    }
    setSending(false)
  }

  const setBot = async (mode) => {
    if (mode === 'pause') {
      await supabase.from('wa_sessions').upsert([{ phone: openPhone, status: 'agent', node: null, updated_at: new Date().toISOString() }], { onConflict: 'phone' })
      toast.success('Bot paused for this chat')
    } else {
      await supabase.from('wa_sessions').delete().eq('phone', openPhone)
      toast.success('Bot will greet them again on their next message')
    }
    load()
  }

  const sessionTag = open?.session ? SESSION_TAG[open.session.status] : null

  return (
    <div className="card">
      {messages === null ? <div className="loading-state"><div className="spinner" /></div> : (
        <div className={`wa-inbox ${openPhone ? 'has-open' : ''}`}>
          <div className="wa-convs">
            <div className="toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div className="toolbar-search" style={{ flex: 1 }}>
                  <Search size={16} />
                  <input placeholder="Search chats…" value={q} onChange={e => setQ(e.target.value)} />
                </div>
                <button className="icon-action" onClick={load} title="Refresh" aria-label="Refresh"><RefreshCw size={15} /></button>
              </div>
              <div className="tabs-line">
                {FILTERS.map(f => (
                  <button key={f.id} className={`tab-line ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                    {f.label}{f.id === 'agent' && agentCount > 0 && <span className="tab-count">{agentCount}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="wa-convs-list">
              {shown.length === 0 ? <EmptyState icon={InboxIcon} title="No chats" text="WhatsApp enquiries and replies will show up here." /> : shown.map(c => {
                const tag = c.session ? SESSION_TAG[c.session.status] : null
                return (
                  <button key={c.phone} className={`wa-conv ${c.phone === openPhone ? 'active' : ''}`} onClick={() => setOpenPhone(c.phone)}>
                    <Avatar name={c.lead?.name || c.phone} size={36} />
                    <div className="wa-conv-main">
                      <div className="wa-conv-top"><b>{c.lead?.name || formatPhone(c.phone)}</b><span>{timeAgo(c.last.created_at)}</span></div>
                      <div className="wa-conv-last">{c.last.direction === 'out' ? '✓ ' : ''}{(c.last.body || '').split('\n')[0] || '—'}</div>
                      {(tag || c.failed > 0) && (
                        <div className="wa-conv-tags">
                          {tag && <Pill tone={tag.tone}>{tag.label}</Pill>}
                          {c.failed > 0 && <Pill tone="red">{c.failed} failed</Pill>}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="wa-thread">
            {!openPhone ? (
              <div className="wa-thread-empty">Select a chat to read it and reply.</div>
            ) : (
              <>
                <div className="wa-thread-head">
                  <div className="person-cell">
                    <button className="icon-action wa-back" onClick={() => setOpenPhone(null)} aria-label="Back to chats"><ArrowLeft size={15} /></button>
                    <Avatar name={name} size={34} />
                    <div>
                      <div className="cell-strong">{name}</div>
                      <div className="cell-sub">{formatPhone(openPhone)}{sessionTag ? ` · ${sessionTag.label}` : ''}</div>
                    </div>
                  </div>
                  <div className="row-actions">
                    {open?.lead && (
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/leads?q=${encodeURIComponent(open.lead.name)}`)}><UserRound size={14} /> Lead</button>
                    )}
                    {open?.session?.status === 'agent'
                      ? <button className="btn btn-ghost btn-sm" onClick={() => setBot('resume')}><Bot size={14} /> Hand back to bot</button>
                      : <button className="btn btn-ghost btn-sm" onClick={() => setBot('pause')}><Headset size={14} /> Pause bot</button>}
                  </div>
                </div>
                <div className="wa-thread-body">
                  {thread.map(m => (
                    <div key={m.id} className={`wa-bubble ${m.direction === 'out' ? 'out' : ''}`}>
                      {m.body || <span className="dim">—</span>}
                      {m.error && <div className="wa-err">{m.error}</div>}
                      <div className="wa-thread-meta">
                        {m.direction === 'out' && <>{KIND_LABEL[m.kind] || m.kind} · </>}
                        {new Date(m.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {m.direction === 'out' && <> · <Pill tone={MSG_TONE[m.status] || 'gray'}>{m.status}</Pill></>}
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                {windowOpen ? (
                  <form className="wa-thread-reply" onSubmit={e => { e.preventDefault(); send() }}>
                    <textarea className="glass-input" rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} aria-label="Reply" />
                    <button className="btn btn-primary" type="submit" disabled={sending || !reply.trim()}><Send size={15} /> {sending ? 'Sending…' : 'Send'}</button>
                  </form>
                ) : (
                  <div className="wa-thread-reply wa-hint">
                    WhatsApp only allows free replies within 24 hours of the customer’s last message. To restart this chat, send them a template from Bulk Send.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
