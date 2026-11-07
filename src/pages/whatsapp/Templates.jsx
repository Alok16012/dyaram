import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FileText, Plus, RefreshCw, Trash2, Send, X, Info, ImagePlus, Type } from 'lucide-react'
import { isAdmin } from '../../lib/auth'
import { parseTemplate, waCreateTemplate, waDeleteTemplate, waTemplates, waUploadImage, getTemplateMedia, MAX_IMAGE_MB } from '../../lib/whatsapp'
import { EmptyState, Pill } from '../../components/ui'
import { WaPreview } from './shared'

const STATUS_TONE = { APPROVED: 'green', PENDING: 'orange', IN_APPEAL: 'orange', REJECTED: 'red', PAUSED: 'gray', DISABLED: 'gray' }
const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ur', label: 'Urdu' },
  { id: 'en_US', label: 'English (US)' },
]
const VAR_RE = /\{\{\s*(\d+)\s*\}\}/g
const LIMITS = { header: 60, body: 1024, footer: 60, button: 25 }

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
const varsIn = (text) => [...new Set([...String(text).matchAll(VAR_RE)].map(m => Number(m[1])))].sort((a, b) => a - b)

const EMPTY = {
  title: '', name: '', category: 'MARKETING', language: 'en',
  headerType: 'TEXT', header: '', headerExample: '', image: null,
  body: 'Assalamu Alaikum {{1}},\n\n', examples: { 1: 'Rahul' },
  footer: 'Reply STOP to unsubscribe',
  quickReplies: [], urlText: '', url: '', callText: '', phone: '',
}

// Ready-made starting points for a Hajj / Umrah business.
const STARTERS = [
  {
    label: 'Umrah offer', title: 'Umrah package offer', category: 'MARKETING',
    header: 'Umrah Packages Open',
    body: 'Assalamu Alaikum {{1}},\n\nBookings are now open for our *{{2}}* package. It includes visa, flights, hotels near the Haram and Ziyarat, with an experienced group leader.\n\nReply *YES* to receive the full itinerary and price.',
    examples: { 1: 'Rahul', 2: 'Economy Umrah 15 Days' }, quickReplies: ['Send details', 'Call me'],
  },
  {
    label: 'Offer with photo', title: 'Umrah offer photo', category: 'MARKETING', headerType: 'IMAGE', header: '',
    body: 'Assalamu Alaikum {{1}},\n\nOur *{{2}}* package is now open for booking. Visa, flights, hotels near the Haram and Ziyarat included.\n\nReply *YES* for the full itinerary and price.',
    examples: { 1: 'Rahul', 2: 'Economy Umrah 15 Days' }, quickReplies: ['Send details', 'Call me'],
  },
  {
    label: 'Enquiry received', title: 'Enquiry received', category: 'UTILITY', header: '', footer: '',
    body: 'Assalamu Alaikum {{1}}, thank you for your enquiry about {{2}} with Dayare Haram Hajj Umrah Tours. Our team will contact you shortly with the full details.',
    examples: { 1: 'Rahul', 2: 'Umrah' }, quickReplies: [],
  },
  {
    label: 'Payment reminder', title: 'Payment reminder', category: 'UTILITY', header: 'Payment reminder', footer: '',
    body: 'Dear {{1}}, this is a reminder that the balance payment of Rs {{2}} for your {{3}} booking is due by {{4}}. Please complete the payment to confirm your seats.',
    examples: { 1: 'Rahul', 2: '45,000', 3: 'Umrah December 2026', 4: '20 Nov 2026' }, quickReplies: [],
  },
  {
    label: 'Departure reminder', title: 'Departure reminder', category: 'UTILITY', header: 'Journey reminder', footer: '',
    body: 'Assalamu Alaikum {{1}}, your {{2}} group departs on {{3}}. Please keep your passport, tickets and documents ready. Our team will share the reporting time shortly.',
    examples: { 1: 'Rahul', 2: 'Umrah', 3: '12 Dec 2026' }, quickReplies: [],
  },
]

// Form state → Meta's template format.
function toMeta(f) {
  const components = []
  const hv = varsIn(f.header)
  if (f.headerType === 'IMAGE') {
    components.push({ type: 'HEADER', format: 'IMAGE', ...(f.image?.handle ? { example: { header_handle: [f.image.handle] } } : {}) })
  } else if (f.header.trim()) {
    components.push({
      type: 'HEADER', format: 'TEXT', text: f.header.trim(),
      ...(hv.length ? { example: { header_text: [f.headerExample || 'Sample'] } } : {}),
    })
  }
  const bv = varsIn(f.body)
  components.push({
    type: 'BODY', text: f.body.trim(),
    ...(bv.length ? { example: { body_text: [bv.map(n => f.examples[n] || '')] } } : {}),
  })
  if (f.footer.trim()) components.push({ type: 'FOOTER', text: f.footer.trim() })
  const buttons = [
    ...f.quickReplies.filter(q => q.trim()).map(text => ({ type: 'QUICK_REPLY', text: text.trim() })),
    ...(f.urlText.trim() && f.url.trim() ? [{ type: 'URL', text: f.urlText.trim(), url: f.url.trim() }] : []),
    ...(f.callText.trim() && f.phone.trim() ? [{ type: 'PHONE_NUMBER', text: f.callText.trim(), phone_number: f.phone.trim() }] : []),
  ]
  if (buttons.length) components.push({ type: 'BUTTONS', buttons })
  return { name: f.name, language: f.language, category: f.category, components }
}

function validate(f, existing) {
  const errs = []
  if (!/^[a-z0-9_]{1,60}$/.test(f.name)) errs.push('Template name: only lowercase letters, numbers and _.')
  if (existing.some(t => t.name === f.name && t.language === f.language)) errs.push('A template with this name and language already exists.')
  const body = f.body.trim()
  if (!body) errs.push('Body text is required.')
  if (body.length > LIMITS.body) errs.push(`Body is longer than ${LIMITS.body} characters.`)
  const bv = varsIn(body)
  if (bv.some((n, i) => n !== i + 1)) errs.push('Body variables must be numbered {{1}}, {{2}}, {{3}}… with no gaps.')
  if (/^\{\{\s*\d+\s*\}\}/.test(body) || /\{\{\s*\d+\s*\}\}[.!?]?$/.test(body)) errs.push('Meta rejects a body that starts or ends with a variable — add some words before/after it.')
  if (bv.some(n => !String(f.examples[n] || '').trim())) errs.push('Give an example value for every body variable.')
  if (f.headerType === 'IMAGE' && !f.image?.handle) errs.push('Upload the header image.')
  if (f.header.length > LIMITS.header) errs.push(`Header is longer than ${LIMITS.header} characters.`)
  const hv = varsIn(f.header)
  if (hv.length > 1 || (hv.length === 1 && hv[0] !== 1)) errs.push('Header can have only one variable, {{1}}.')
  if (hv.length && !f.headerExample.trim()) errs.push('Give an example value for the header variable.')
  if (f.footer.length > LIMITS.footer) errs.push(`Footer is longer than ${LIMITS.footer} characters.`)
  if (varsIn(f.footer).length) errs.push('Footer cannot contain variables.')
  const btns = [...f.quickReplies, f.urlText, f.callText].filter(Boolean)
  if (btns.some(b => b.length > LIMITS.button)) errs.push(`Button text must be ${LIMITS.button} characters or less.`)
  if (f.urlText.trim() && !/^https:\/\//.test(f.url.trim())) errs.push('Website button needs a link starting with https://')
  if (f.callText.trim() && !/^\+\d{10,15}$/.test(f.phone.replace(/\s/g, ''))) errs.push('Call button needs a phone number like +919555659996.')
  return errs
}

function TemplateForm({ existing, onCreated, onClose }) {
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const bodyRef = useRef(null)
  const imageRef = useRef(null)
  const set = (patch) => setF(prev => ({ ...prev, ...patch }))
  const bodyVars = varsIn(f.body)
  const errors = validate(f, existing)

  const applyStarter = (s) => setF(prev => ({
    ...EMPTY, ...s, name: slug(s.title), footer: s.footer ?? EMPTY.footer, quickReplies: s.quickReplies || [],
    // Keep an image already uploaded when switching between image starters.
    image: s.headerType === 'IMAGE' ? prev.image : null,
  }))

  const pickImage = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url, handle } = await waUploadImage(file, { forTemplate: true })
      set({ image: { url, handle, name: file.name } })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setUploading(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  const addVariable = () => {
    const n = (bodyVars[bodyVars.length - 1] || 0) + 1
    const el = bodyRef.current
    const at = el?.selectionStart ?? f.body.length
    set({ body: f.body.slice(0, at) + `{{${n}}}` + f.body.slice(el?.selectionEnd ?? at), examples: { ...f.examples, [n]: f.examples[n] || '' } })
  }

  const preview = parseTemplate(toMeta(f))
  const bodyValues = Object.fromEntries(bodyVars.map(n => [String(n), f.examples[n]]))

  const submit = async () => {
    if (errors.length) return toast.error(errors[0])
    setSaving(true)
    try {
      const res = await waCreateTemplate(toMeta(f), f.headerType === 'IMAGE' ? f.image?.url : null)
      const st = res?.template?.status || 'PENDING'
      toast.success(st === 'APPROVED' ? 'Template approved' : 'Template sent to Meta for approval — usually takes a few minutes')
      onCreated()
    } catch (e) {
      toast.error(e.message, { duration: 10000 })
    }
    setSaving(false)
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">New message template</h3>
          <p className="card-subtitle">Meta reviews every template before it can be used for bulk messages. Approval usually takes a few minutes.</p>
        </div>
        <button className="icon-action" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="card-body">
        <div className="wa-chips" style={{ marginBottom: 14 }}>
          <span className="wa-hint" style={{ alignSelf: 'center' }}>Start from:</span>
          {STARTERS.map(s => <button key={s.label} type="button" className="wa-chip" onClick={() => applyStarter(s)}>{s.label}</button>)}
        </div>

        <div className="wa-grid">
          <div>
            <div className="form-row">
              <div className="form-field">
                <label>Title</label>
                <input className="glass-input" value={f.title} placeholder="e.g. Ramadan Umrah offer"
                  onChange={e => set({ title: e.target.value, name: slug(e.target.value) })} />
                <span className="wa-hint">Saved as <code className="wa-code">{f.name || '…'}</code></span>
              </div>
              <div className="form-field">
                <label>Type</label>
                <select className="glass-input" value={f.category} onChange={e => set({ category: e.target.value })}>
                  <option value="MARKETING">Marketing — offers, packages, greetings</option>
                  <option value="UTILITY">Utility — booking, payment, travel updates</option>
                </select>
              </div>
              <div className="form-field">
                <label>Language</label>
                <select className="glass-input" value={f.language} onChange={e => set({ language: e.target.value })}>
                  {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Header</label>
              <div className="wa-chips" style={{ marginTop: 0, marginBottom: 8 }}>
                <button type="button" className={`wa-chip ${f.headerType === 'TEXT' ? 'active' : ''}`} onClick={() => set({ headerType: 'TEXT' })}><Type size={13} /> Text</button>
                <button type="button" className={`wa-chip ${f.headerType === 'IMAGE' ? 'active' : ''}`} onClick={() => set({ headerType: 'IMAGE' })}><ImagePlus size={13} /> Image</button>
              </div>
              {f.headerType === 'TEXT' ? (
                <>
                  <input className="glass-input" value={f.header} maxLength={LIMITS.header} placeholder="Optional bold first line, e.g. Umrah Packages Open" onChange={e => set({ header: e.target.value })} />
                  <span className="wa-hint">{f.header.length}/{LIMITS.header}</span>
                  {varsIn(f.header).length > 0 && (
                    <input className="glass-input" style={{ marginTop: 6 }} value={f.headerExample} placeholder="Example for header {{1}}" onChange={e => set({ headerExample: e.target.value })} />
                  )}
                </>
              ) : (
                <div className="wa-image-pick">
                  <input ref={imageRef} type="file" accept="image/jpeg,image/png" hidden onChange={e => pickImage(e.target.files?.[0])} />
                  {f.image && <img src={f.image.url} alt="" className="wa-image-thumb" />}
                  <div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => imageRef.current?.click()} disabled={uploading}>
                      <ImagePlus size={14} /> {uploading ? 'Uploading…' : f.image ? 'Change image' : 'Upload image'}
                    </button>
                    <div className="wa-hint" style={{ marginTop: 4 }}>
                      {f.image ? f.image.name : `JPG or PNG, up to ${MAX_IMAGE_MB} MB. A wide picture (about 1.9 : 1) looks best.`}
                    </div>
                    <div className="wa-hint">This picture is sent by default; you can change it for each campaign in Bulk Send.</div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Message <span className="dim">({f.body.length}/{LIMITS.body}) · use *bold* and _italic_</span></label>
              <textarea ref={bodyRef} className="glass-input" rows={7} value={f.body} maxLength={LIMITS.body} onChange={e => set({ body: e.target.value })} />
              <div className="wa-chips">
                <button type="button" className="wa-chip" onClick={addVariable}>+ Add variable {`{{${(bodyVars[bodyVars.length - 1] || 0) + 1}}}`}</button>
                <span className="wa-hint" style={{ alignSelf: 'center' }}>Variables are filled per customer in Bulk Send (name, package, date…)</span>
              </div>
            </div>

            {bodyVars.length > 0 && (
              <div className="form-field" style={{ marginTop: 10 }}>
                <label>Example values <span className="dim">(Meta needs these to review the template)</span></label>
                {bodyVars.map(n => (
                  <div className="wa-map-row" key={n} style={{ gridTemplateColumns: '70px 1fr' }}>
                    <code>{`{{${n}}}`}</code>
                    <input className="glass-input" value={f.examples[n] || ''} placeholder={n === 1 ? 'e.g. Rahul' : 'e.g. Economy Umrah 15 Days'}
                      onChange={e => set({ examples: { ...f.examples, [n]: e.target.value } })} />
                  </div>
                ))}
              </div>
            )}

            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Footer <span className="dim">(optional, small grey text · {f.footer.length}/{LIMITS.footer})</span></label>
              <input className="glass-input" value={f.footer} maxLength={LIMITS.footer} onChange={e => set({ footer: e.target.value })} />
            </div>

            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Buttons <span className="dim">(optional)</span></label>
              {f.quickReplies.map((q, i) => (
                <div key={i} className="wa-copy" style={{ marginBottom: 6 }}>
                  <input className="glass-input" value={q} maxLength={LIMITS.button} placeholder="Quick reply, e.g. Send details"
                    onChange={e => set({ quickReplies: f.quickReplies.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <button className="icon-action" onClick={() => set({ quickReplies: f.quickReplies.filter((_, j) => j !== i) })} aria-label="Remove button"><Trash2 size={13} /></button>
                </div>
              ))}
              {f.quickReplies.length < 3 && (
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ quickReplies: [...f.quickReplies, ''] })}><Plus size={13} /> Quick reply button</button>
              )}
              <div className="form-row" style={{ marginTop: 8 }}>
                <input className="glass-input" value={f.urlText} maxLength={LIMITS.button} placeholder="Website button text (optional)" onChange={e => set({ urlText: e.target.value })} />
                <input className="glass-input" value={f.url} placeholder="https://dayareharam.com/" onChange={e => set({ url: e.target.value })} />
              </div>
              <div className="form-row" style={{ marginTop: 8 }}>
                <input className="glass-input" value={f.callText} maxLength={LIMITS.button} placeholder="Call button text (optional)" onChange={e => set({ callText: e.target.value })} />
                <input className="glass-input" value={f.phone} placeholder="+919555659996" onChange={e => set({ phone: e.target.value })} />
              </div>
            </div>

            {errors.length > 0 && (
              <div className="wa-banner warn" style={{ marginTop: 14, marginBottom: 0 }}>
                <Info size={16} /><div>{errors.map(e => <div key={e}>{e}</div>)}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={submit} disabled={saving || errors.length > 0}>
                <Send size={15} /> {saving ? 'Sending to Meta…' : 'Submit for approval'}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>

          <div style={{ position: 'sticky', top: 86 }}>
            <WaPreview template={preview} bodyValues={bodyValues} headerValues={{ 1: f.headerExample }} mediaUrl={f.image?.url} title="How customers will see it" />
            <p className="wa-hint" style={{ marginTop: 10 }}>
              Tips: Marketing templates are for offers and announcements; Utility is only for updates about an existing booking or payment —
              Meta may move a Utility template to Marketing if it contains promotional text.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Templates({ onChanged }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [media, setMedia] = useState({})
  const admin = isAdmin()

  const load = useCallback(async () => {
    setError('')
    try { setList(await waTemplates(true)) } catch (e) { setList([]); setError(e.message) }
    getTemplateMedia().then(setMedia).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const remove = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"? It will no longer be available for sending.`)) return
    try {
      await waDeleteTemplate(t.name)
      toast.success('Template deleted')
      load(); onChanged?.()
    } catch (e) { toast.error(e.message) }
  }

  const rows = (list || []).map(t => ({ raw: t, p: parseTemplate(t) }))

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {creating && admin && (
        <TemplateForm existing={list || []} onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); onChanged?.() }} />
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">Message templates</h3>
            <p className="card-subtitle">Approved templates appear in Bulk Send and the welcome automation.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
            {admin && !creating && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={14} /> New template</button>}
          </div>
        </div>
        {error && <div className="wa-banner err" style={{ margin: '0 20px 16px' }}><Info size={16} /> {error}</div>}
        {!list ? <div className="loading-state"><div className="spinner" /></div>
          : rows.length === 0 ? (
            <EmptyState icon={FileText} title="No templates yet" text="Create your first template — for example an Umrah offer for bulk messages."
              action={admin && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={14} /> New template</button>} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Template</th><th>Type</th><th>Language</th><th>Message</th><th>Status</th>{admin && <th />}</tr></thead>
                <tbody>
                  {rows.map(({ raw, p }) => (
                    <tr key={p.key}>
                      <td><code className="wa-code">{p.name}</code></td>
                      <td>{(p.category || '').toLowerCase()}</td>
                      <td>{p.language}</td>
                      <td>
                        {p.headerFormat === 'IMAGE' && (media[p.key]
                          ? <img src={media[p.key]} alt="" className="wa-image-thumb sm" />
                          : <div className="wa-hint"><ImagePlus size={12} /> image header</div>)}
                        <div className="wa-msg-body">{p.bodyText}</div>
                      </td>
                      <td>
                        <Pill tone={STATUS_TONE[raw.status] || 'gray'}>{(raw.status || '').toLowerCase()}</Pill>
                        {raw.status === 'REJECTED' && raw.rejected_reason && raw.rejected_reason !== 'NONE' && (
                          <div className="wa-err">{raw.rejected_reason.replace(/_/g, ' ').toLowerCase()}</div>
                        )}
                      </td>
                      {admin && (
                        <td><button className="icon-action danger" onClick={() => remove(raw)} title="Delete template"><Trash2 size={14} /></button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}
