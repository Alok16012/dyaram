import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Users, CalendarCheck, ClipboardList, Send, FlaskConical, Square, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useCRM, LEAD_STAGES, LEAD_SOURCES } from '../../context/CRMContext'
import { useBooking } from '../../context/BookingContext'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/auth'
import { BOOKING_TONE } from '../../lib/ui'
import {
  normalizePhone, formatPhone, parseTemplate, defaultMapping, personVars, resolveParams,
  paramsToValues, renderText, waSendBatch, BATCH_SIZE,
} from '../../lib/whatsapp'
import { TemplateSelect, VariableMapper, WaPreview } from './shared'

const AUDIENCES = [
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'customers', label: 'Booked customers', icon: CalendarCheck },
  { id: 'paste', label: 'Paste numbers', icon: ClipboardList },
]

// "9876543210, Rahul Khan" or "Rahul Khan - +91 98765 43210" → { phone, name }
function parsePasted(text) {
  return text.split(/\n+/).map(line => {
    const m = line.match(/\+?[\d][\d\s-]{8,}\d/)
    if (!m) return null
    const name = line.replace(m[0], '').replace(/^[\s,;:\-|]+|[\s,;:\-|]+$/g, '').trim()
    return { phone: m[0], name }
  }).filter(Boolean)
}

const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

export default function BulkSend({ templates, templatesLoading, onSent }) {
  const { leads, fetchLeads } = useCRM()
  const { bookings, fetchBookings } = useBooking()
  const [params] = useSearchParams()

  // ── Audience ──
  const [audience, setAudience] = useState('leads')
  const [stages, setStages] = useState(() => {
    const s = params.get('stage')
    return s && s !== 'all' ? [s] : []
  })
  const [source, setSource] = useState('all')
  const [destQ, setDestQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bStatuses, setBStatuses] = useState([])
  const [pasted, setPasted] = useState('')
  const [excluded, setExcluded] = useState(() => new Set())

  useEffect(() => { fetchLeads(); fetchBookings() }, [fetchLeads, fetchBookings])

  const optedOut = useMemo(() => new Set(
    leads.filter(l => l.wa_opt_out).map(l => normalizePhone(l.whatsapp || l.phone)).filter(Boolean)
  ), [leads])

  const candidates = useMemo(() => {
    let people = []
    if (audience === 'leads') {
      const q = destQ.trim().toLowerCase()
      people = leads
        .filter(l => !stages.length || stages.includes(l.stage))
        .filter(l => source === 'all' || l.source === source)
        .filter(l => !q || (l.destination || '').toLowerCase().includes(q))
        .filter(l => !from || (l.created_at || '').slice(0, 10) >= from)
        .filter(l => !to || (l.created_at || '').slice(0, 10) <= to)
        .map(l => ({ name: l.name, rawPhone: l.whatsapp || l.phone, lead_id: l.id, destination: l.destination, travel_date: l.travel_date }))
    } else if (audience === 'customers') {
      people = bookings
        .filter(b => !bStatuses.length || bStatuses.includes(b.status))
        .map(b => ({ name: b.customer_name, rawPhone: b.customer_whatsapp || b.customer_phone, lead_id: b.lead_id || null, destination: b.destination, travel_date: b.travel_date }))
    } else {
      people = parsePasted(pasted).map(p => ({ name: p.name, rawPhone: p.phone, lead_id: null }))
    }
    // Normalise, drop invalid/opted-out numbers and duplicates.
    const seen = new Set()
    const out = []
    let invalid = 0, optOut = 0, dupes = 0
    for (const p of people) {
      const phone = normalizePhone(p.rawPhone)
      if (!phone) { invalid++; continue }
      if (optedOut.has(phone)) { optOut++; continue }
      if (seen.has(phone)) { dupes++; continue }
      seen.add(phone)
      out.push({ ...p, phone })
    }
    return { list: out, invalid, optOut, dupes }
  }, [audience, leads, bookings, stages, source, destQ, from, to, bStatuses, pasted, optedOut])

  const recipients = candidates.list.filter(r => !excluded.has(r.phone))

  // ── Template ──
  const parsed = useMemo(() => templates.map(parseTemplate), [templates])
  const [tplKey, setTplKey] = useState('')
  const tpl = parsed.find(t => t.key === tplKey) || null
  const [bodyMap, setBodyMap] = useState([])
  const [headerMap, setHeaderMap] = useState([])
  const [mediaUrl, setMediaUrl] = useState('')

  const chooseTemplate = (key) => {
    setTplKey(key)
    const t = parsed.find(x => x.key === key)
    setBodyMap(defaultMapping(t?.bodyVars || []))
    setHeaderMap((t?.headerVars || []).map(name => ({ name, source: 'custom', custom: '' })))
    setMediaUrl('')
  }

  const sample = recipients[0] || { name: 'Rahul Khan', destination: 'Umrah Package', phone: '919800000000' }
  const sampleVars = personVars(sample)
  const bodyValues = paramsToValues(resolveParams(bodyMap, sampleVars))
  const headerValues = paramsToValues(resolveParams(headerMap, sampleVars))

  const problems = []
  if (!tpl) problems.push('Choose a template')
  if (tpl && [...bodyMap, ...headerMap].some(m => m.source === 'custom' && !m.custom?.trim())) problems.push('Fill all fixed-text variables')
  if (tpl && tpl.headerFormat && tpl.headerFormat !== 'TEXT' && !/^https:\/\//.test(mediaUrl)) problems.push(`Add a public https ${tpl.headerFormat.toLowerCase()} URL for the header`)

  const buildRecipient = (r) => {
    const vars = personVars(r)
    const body_params = resolveParams(bodyMap, vars)
    return {
      to: r.phone, lead_id: r.lead_id || null,
      body_params, header_params: resolveParams(headerMap, vars),
      preview: renderText(tpl.bodyText, paramsToValues(body_params)),
    }
  }
  const templatePayload = () => ({
    name: tpl.name, language: tpl.language, header_format: tpl.headerFormat, header_media_url: mediaUrl || null,
  })

  // ── Sending ──
  const [campaignName, setCampaignName] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [progress, setProgress] = useState(null) // { total, done, sent, failed, running, errors[] }
  const stopRef = useRef(false)

  const sendTest = async () => {
    const phone = normalizePhone(testPhone)
    if (!phone) return toast.error('Enter a valid test number')
    setTesting(true)
    try {
      const res = await waSendBatch({
        template: templatePayload(),
        recipients: [{ ...buildRecipient({ ...sample, phone, lead_id: null }), to: phone }],
      })
      const r = res.results?.[0]
      r?.ok ? toast.success(`Test sent to ${formatPhone(phone)}`) : toast.error(r?.error || 'Test failed', { duration: 8000 })
    } catch (e) {
      toast.error(e.message, { duration: 8000 })
    }
    setTesting(false)
  }

  const sendAll = async () => {
    if (!recipients.length) return
    if (!window.confirm(`Send "${tpl.name}" to ${recipients.length} WhatsApp number${recipients.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    const session = getSession()
    const name = campaignName.trim() || `${tpl.name} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
    const { data: campaign, error } = await supabase.from('wa_campaigns').insert([{
      name, template_name: tpl.name, template_language: tpl.language, total: recipients.length, status: 'sending',
      created_by: session?.full_name || session?.username || null,
      audience: { type: audience, stages, source, destination: destQ, from, to, booking_status: bStatuses },
    }]).select().single()
    if (error) return toast.error(`Could not create campaign: ${error.message}`)

    stopRef.current = false
    const state = { total: recipients.length, done: 0, sent: 0, failed: 0, running: true, errors: [], campaign: name }
    setProgress({ ...state })
    const payloadTpl = templatePayload()
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      if (stopRef.current) break
      const chunk = recipients.slice(i, i + BATCH_SIZE)
      try {
        const res = await waSendBatch({ campaign_id: campaign.id, template: payloadTpl, recipients: chunk.map(buildRecipient) })
        state.sent += res.sent
        state.failed += res.failed
        state.errors.push(...res.results.filter(r => !r.ok))
      } catch (e) {
        // Whole batch failed (network / config) — stop instead of hammering the API.
        state.failed += chunk.length
        state.errors.push({ to: '—', error: e.message })
        toast.error(e.message, { duration: 8000 })
        stopRef.current = true
      }
      state.done = Math.min(recipients.length, i + chunk.length)
      setProgress({ ...state, errors: [...state.errors] })
    }
    const stopped = stopRef.current && state.done < state.total
    await supabase.from('wa_campaigns').update({ status: stopped ? 'stopped' : 'completed', completed_at: new Date().toISOString() }).eq('id', campaign.id)
    setProgress({ ...state, running: false, stopped })
    toast.success(`Campaign finished: ${state.sent} sent, ${state.failed} failed`)
    onSent?.()
  }

  const sending = progress?.running

  return (
    <div className="wa-grid">
      <div className="card">
        {/* Step 1 */}
        <div className="wa-section">
          <div className="wa-step"><span className="wa-step-num">1</span><h4>Choose recipients</h4></div>
          <div className="wa-source-switch">
            {AUDIENCES.map(a => (
              <button key={a.id} className={`wa-source-btn ${audience === a.id ? 'active' : ''}`} onClick={() => { setAudience(a.id); setExcluded(new Set()) }}>
                <a.icon size={16} /> {a.label}
              </button>
            ))}
          </div>

          {audience === 'leads' && (
            <>
              <div className="form-field mb-16">
                <label>Lead stage <span className="dim">(none selected = all)</span></label>
                <div className="wa-pills">
                  {LEAD_STAGES.map(s => (
                    <button key={s.id} className={`filter-pill ${stages.includes(s.id) ? 'active' : ''}`} onClick={() => setStages(toggleIn(stages, s.id))}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Source</label>
                  <select className="glass-input" value={source} onChange={e => setSource(e.target.value)}>
                    <option value="all">All sources</option>
                    {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Package contains</label>
                  <input className="glass-input" value={destQ} onChange={e => setDestQ(e.target.value)} placeholder="e.g. Umrah, Hajj" />
                </div>
                <div className="form-field">
                  <label>Enquiry from</label>
                  <input className="glass-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Enquiry to</label>
                  <input className="glass-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {audience === 'customers' && (
            <div className="form-field">
              <label>Booking status <span className="dim">(none selected = all)</span></label>
              <div className="wa-pills">
                {Object.entries(BOOKING_TONE).map(([id, b]) => (
                  <button key={id} className={`filter-pill ${bStatuses.includes(id) ? 'active' : ''}`} onClick={() => setBStatuses(toggleIn(bStatuses, id))}>{b.label}</button>
                ))}
              </div>
            </div>
          )}

          {audience === 'paste' && (
            <div className="form-field">
              <label>One number per line, optionally with a name</label>
              <textarea className="glass-input" rows={6} value={pasted} onChange={e => setPasted(e.target.value)}
                placeholder={'9876543210, Rahul Khan\n+91 98765 43211 Ayesha\n919812345678'} />
            </div>
          )}

          <div className="wa-count-line">
            <span><strong>{recipients.length}</strong> recipient{recipients.length === 1 ? '' : 's'} selected</span>
            <span>
              {[candidates.invalid && `${candidates.invalid} without a valid number`,
                candidates.optOut && `${candidates.optOut} opted out`,
                candidates.dupes && `${candidates.dupes} duplicate${candidates.dupes > 1 ? 's' : ''}`]
                .filter(Boolean).join(' · ') || 'No numbers skipped'}
            </span>
          </div>
          {candidates.list.length > 0 && (
            <div className="wa-recipients">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <input type="checkbox" checked={excluded.size === 0}
                        onChange={e => setExcluded(e.target.checked ? new Set() : new Set(candidates.list.map(r => r.phone)))} aria-label="Select all" />
                    </th>
                    <th>Name</th><th>WhatsApp</th><th>Package</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.list.map(r => {
                    const off = excluded.has(r.phone)
                    return (
                      <tr key={r.phone} className={off ? 'off' : ''}>
                        <td><input type="checkbox" checked={!off} onChange={() => {
                          const n = new Set(excluded); off ? n.delete(r.phone) : n.add(r.phone); setExcluded(n)
                        }} aria-label={`Include ${r.name || r.phone}`} /></td>
                        <td>{r.name || <span className="dim">—</span>}</td>
                        <td>{formatPhone(r.phone)}</td>
                        <td>{r.destination || <span className="dim">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="wa-section">
          <div className="wa-step"><span className="wa-step-num">2</span><h4>Message template</h4></div>
          <p className="wa-hint" style={{ marginTop: -6, marginBottom: 12 }}>
            WhatsApp only allows Meta-approved templates for messages you start. Create them in WhatsApp Manager → Message templates.
          </p>
          <div className="form-field mb-16">
            <TemplateSelect templates={parsed} value={tplKey} onChange={chooseTemplate} loading={templatesLoading} />
          </div>
          {tpl?.headerFormat && tpl.headerFormat !== 'TEXT' && (
            <div className="form-field mb-16">
              <label>Header {tpl.headerFormat.toLowerCase()} URL (public https link)</label>
              <input className="glass-input" value={mediaUrl} onChange={e => setMediaUrl(e.target.value.trim())} placeholder="https://…/umrah-offer.jpg" />
            </div>
          )}
          {headerMap.length > 0 && (<><label className="form-label">Header variables</label><VariableMapper mapping={headerMap} onChange={setHeaderMap} /></>)}
          {bodyMap.length > 0 && (<><label className="form-label">Body variables</label><VariableMapper mapping={bodyMap} onChange={setBodyMap} /></>)}
          {tpl?.dynamicButton && (
            <div className="wa-banner warn" style={{ marginTop: 10, marginBottom: 0 }}>
              <AlertTriangle size={16} /> This template has a button with a dynamic URL, which bulk send doesn’t fill in. Use a template with a static link.
            </div>
          )}
        </div>

        {/* Step 3 */}
        <div className="wa-section">
          <div className="wa-step"><span className="wa-step-num">3</span><h4>Test & send</h4></div>
          <div className="form-row">
            <div className="form-field">
              <label>Campaign name</label>
              <input className="glass-input" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder={tpl ? `${tpl.name} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : 'e.g. Ramadan Umrah offer'} />
            </div>
            <div className="form-field">
              <label>Send a test first</label>
              <div className="wa-copy">
                <input className="glass-input" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Your WhatsApp number" />
                <button className="btn btn-ghost" onClick={sendTest} disabled={testing || problems.length > 0 || sending}><FlaskConical size={15} /> {testing ? 'Sending…' : 'Test'}</button>
              </div>
            </div>
          </div>

          {problems.length > 0 && <p className="wa-hint" style={{ marginTop: 12 }}>To send: {problems.join(' · ')}.</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {sending ? (
              <button className="btn btn-danger" onClick={() => { stopRef.current = true }}><Square size={15} /> Stop after this batch</button>
            ) : (
              <button className="btn btn-primary" onClick={sendAll} disabled={problems.length > 0 || recipients.length === 0}>
                <Send size={16} /> Send to {recipients.length} number{recipients.length === 1 ? '' : 's'}
              </button>
            )}
          </div>

          {progress && (
            <div style={{ marginTop: 16 }}>
              <div className="wa-progress"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
              <div className="wa-progress-stats">
                <span><b>{progress.done}</b> / {progress.total} processed</span>
                <span><b style={{ color: 'var(--success)' }}>{progress.sent}</b> sent</span>
                <span><b style={{ color: 'var(--danger)' }}>{progress.failed}</b> failed</span>
                {!progress.running && <span>{progress.stopped ? 'Stopped' : <><CheckCircle2 size={14} style={{ verticalAlign: -2, color: 'var(--success)' }} /> Done — delivery & read status updates in Campaigns</>}</span>}
              </div>
              {progress.errors.length > 0 && (
                <div className="wa-recipients" style={{ marginTop: 10, maxHeight: 180 }}>
                  <table>
                    <thead><tr><th>Number</th><th>Error</th></tr></thead>
                    <tbody>{progress.errors.slice(0, 100).map((e, i) => <tr key={i}><td>{e.to === '—' ? '—' : formatPhone(e.to)}</td><td className="wa-err">{e.error}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'sticky', top: 86 }}>
        <WaPreview template={tpl} bodyValues={bodyValues} headerValues={headerValues} mediaUrl={mediaUrl}
          title={recipients[0] ? `Preview for ${recipients[0].name || formatPhone(recipients[0].phone)}` : 'Preview'} />
        <p className="wa-hint" style={{ marginTop: 10 }}>
          Meta limits how many new people your number can message per 24 hours (your messaging tier) and charges per template conversation.
          Only message people who agreed to hear from you — recipients who reply STOP are excluded automatically.
        </p>
      </div>
    </div>
  )
}
