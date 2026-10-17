// Building blocks shared by the bulk sender and the automation settings.
import { Fragment } from 'react'
import { Image as ImageIcon, FileText, Video } from 'lucide-react'
import { VAR_SOURCES } from '../../lib/whatsapp'

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="wa-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="wa-toggle-track" />
      {label && <span>{label}</span>}
    </label>
  )
}

export function TemplateSelect({ templates, value, onChange, loading }) {
  return (
    <select className="glass-input" value={value || ''} onChange={e => onChange(e.target.value)} disabled={loading}>
      <option value="">{loading ? 'Loading templates…' : templates.length ? 'Choose an approved template' : 'No approved templates found'}</option>
      {templates.map(t => (
        <option key={t.key} value={t.key}>{t.name} · {t.language} · {t.category?.toLowerCase()}</option>
      ))}
    </select>
  )
}

// One row per template variable: {{1}} → [source ▾] [fixed text]
export function VariableMapper({ mapping, onChange }) {
  if (!mapping.length) return null
  const set = (i, patch) => onChange(mapping.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  return (
    <div>
      {mapping.map((m, i) => (
        <div className="wa-map-row" key={m.name}>
          <code>{`{{${m.name}}}`}</code>
          <select className="glass-input" value={m.source} onChange={e => set(i, { source: e.target.value })}>
            {VAR_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {m.source === 'custom'
            ? <input className="glass-input" value={m.custom || ''} placeholder="Text for every recipient" onChange={e => set(i, { custom: e.target.value })} />
            : <span className="wa-hint">Filled per recipient</span>}
        </div>
      ))}
    </div>
  )
}

// Render text with filled variables highlighted; unfilled ones stay as {{n}}.
function Highlighted({ text, values }) {
  const parts = String(text || '').split(/(\{\{\s*\w+\s*\}\})/g)
  return parts.map((p, i) => {
    const m = p.match(/^\{\{\s*(\w+)\s*\}\}$/)
    if (!m) return <Fragment key={i}>{p}</Fragment>
    const v = values?.[m[1]]
    return <span key={i} className="wa-var">{v || p}</span>
  })
}

const MEDIA_ICON = { IMAGE: ImageIcon, VIDEO: Video, DOCUMENT: FileText }

export function WaPreview({ template, bodyValues, headerValues, mediaUrl, title = 'Preview' }) {
  const MediaIcon = MEDIA_ICON[template?.headerFormat]
  return (
    <div className="wa-phone">
      <div className="wa-phone-head">{title}</div>
      {!template ? (
        <div className="wa-bubble" style={{ color: '#667781' }}>Choose a template to see how the message will look.</div>
      ) : (
        <>
          <div className="wa-bubble">
            {MediaIcon && (
              <div className="wa-bubble-media" style={template.headerFormat === 'IMAGE' && mediaUrl ? { backgroundImage: `url("${mediaUrl}")` } : undefined}>
                {!(template.headerFormat === 'IMAGE' && mediaUrl) && <span><MediaIcon size={18} /> {template.headerFormat.toLowerCase()}</span>}
              </div>
            )}
            {template.headerText && <div className="wa-bubble-header"><Highlighted text={template.headerText} values={headerValues} /></div>}
            <Highlighted text={template.bodyText} values={bodyValues} />
            {template.footer && <div className="wa-bubble-footer">{template.footer}</div>}
            <div className="wa-bubble-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          {template.buttons.map(b => <div key={b} className="wa-bubble-btn">{b}</div>)}
        </>
      )}
    </div>
  )
}
