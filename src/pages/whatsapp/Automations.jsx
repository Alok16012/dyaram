import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { MessageSquareReply, UserPlus, Save, Info } from 'lucide-react'
import { LEAD_SOURCES } from '../../context/CRMContext'
import { isDemo } from '../../lib/supabase'
import {
  getAutomations, saveAutomation, parseTemplate, defaultMapping, personVars, resolveParams, paramsToValues, renderText,
} from '../../lib/whatsapp'
import { Toggle, TemplateSelect, VariableMapper, WaPreview } from './shared'
import BotBuilder from './BotBuilder'

const SAMPLE = personVars({ name: 'Rahul Khan', destination: 'Umrah Economy 15 Days', travel_date: '2026-12-10', phone: '+91 98765 43210' })
const REPLY_VARS = ['first_name', 'name', 'destination']

function InboundAutoReply({ initial, botOn }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [cfg, setCfg] = useState(initial.config)
  const [saving, setSaving] = useState(false)
  const textRef = useRef(null)
  const set = (patch) => setCfg(c => ({ ...c, ...patch }))

  const insertVar = (v) => {
    const el = textRef.current
    const token = `{{${v}}}`
    const start = el?.selectionStart ?? cfg.message.length
    const end = el?.selectionEnd ?? cfg.message.length
    set({ message: cfg.message.slice(0, start) + token + cfg.message.slice(end) })
  }

  const save = async () => {
    if (enabled && !cfg.message.trim()) return toast.error('Write the reply message first')
    setSaving(true)
    try {
      await saveAutomation('inbound_auto_reply', enabled, { ...cfg, cooldown_hours: Number(cfg.cooldown_hours) || 24 })
      toast.success('Auto-reply saved')
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  return (
    <section className="card wa-auto-card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><MessageSquareReply size={18} style={{ verticalAlign: -3, marginRight: 6 }} />Instant reply to WhatsApp enquiries</h3>
          <p className="card-subtitle">
            When someone messages your business number, reply at once and add them to Leads.
            {botOn && <b> The menu bot is on, so it replies instead of this message; the lead option below still applies.</b>}
          </p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'On' : 'Off'} />
      </div>
      <div className="card-body">
        <div className="wa-grid wa-grid-300">
          <div>
            <div className="form-field mb-16">
              <label>Reply message</label>
              <textarea ref={textRef} className="glass-input" rows={7} value={cfg.message} onChange={e => set({ message: e.target.value })} />
              <div className="wa-chips">
                {REPLY_VARS.map(v => <button key={v} type="button" className="wa-chip" onClick={() => insertVar(v)}>+ {`{{${v}}}`}</button>)}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="wa-check"><input type="checkbox" checked={cfg.create_lead !== false} onChange={e => set({ create_lead: e.target.checked })} /> Create a lead for new numbers (source: WhatsApp, stage: New Inquiry)</label>
              <label className="wa-check"><input type="checkbox" checked={!!cfg.only_new_leads} onChange={e => set({ only_new_leads: e.target.checked })} /> Only reply to new contacts, not existing leads</label>
              <label className="wa-check">
                Don’t reply to the same number more than once every
                <input className="glass-input" type="number" min={1} max={720} style={{ width: 80 }} value={cfg.cooldown_hours} onChange={e => set({ cooldown_hours: e.target.value })} />
                hours
              </label>
            </div>
            <p className="wa-hint" style={{ marginTop: 12 }}>
              Free text is allowed here because the customer messaged first (WhatsApp’s 24-hour window). Replies of STOP / START are handled automatically.
            </p>
          </div>
          <div className="wa-phone">
            <div className="wa-phone-head">Preview</div>
            <div className="wa-bubble" style={{ marginBottom: 8, maxWidth: '85%' }}>Assalamu Alaikum, I want details of Umrah package</div>
            <div className="wa-bubble out">{renderText(cfg.message, SAMPLE)}<div className="wa-bubble-time">auto</div></div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save auto-reply'}</button>
        </div>
      </div>
    </section>
  )
}

function NewLeadWelcome({ initial, templates, templatesLoading }) {
  const parsed = useMemo(() => templates.map(parseTemplate), [templates])
  const [enabled, setEnabled] = useState(initial.enabled)
  const c0 = initial.config
  const [tplKey, setTplKey] = useState(c0.template_name ? `${c0.template_name}::${c0.language}` : '')
  const [bodyMap, setBodyMap] = useState(c0.body_params || [])
  const [headerMap, setHeaderMap] = useState(c0.header_params || [])
  const [mediaUrl, setMediaUrl] = useState(c0.header_media_url || '')
  const [skip, setSkip] = useState(c0.skip_sources || [])
  const [saving, setSaving] = useState(false)
  const tpl = parsed.find(t => t.key === tplKey) || null

  const choose = (key) => {
    setTplKey(key)
    const t = parsed.find(x => x.key === key)
    setBodyMap(defaultMapping(t?.bodyVars || []))
    setHeaderMap((t?.headerVars || []).map(name => ({ name, source: 'custom', custom: '' })))
    setMediaUrl('')
  }

  const save = async () => {
    if (enabled && !tpl) return toast.error('Choose a template')
    if (enabled && [...bodyMap, ...headerMap].some(m => m.source === 'custom' && !m.custom?.trim())) return toast.error('Fill all fixed-text variables')
    if (enabled && tpl?.headerFormat && tpl.headerFormat !== 'TEXT' && !/^https:\/\//.test(mediaUrl)) return toast.error('Add a public https URL for the header media')
    setSaving(true)
    try {
      await saveAutomation('new_lead_welcome', enabled, {
        template_name: tpl?.name || '', language: tpl?.language || 'en',
        header_format: tpl?.headerFormat || null, header_media_url: mediaUrl,
        header_params: headerMap, body_params: bodyMap, skip_sources: skip, preview: tpl?.bodyText || '',
      })
      toast.success('Welcome automation saved')
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  return (
    <section className="card wa-auto-card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><UserPlus size={18} style={{ verticalAlign: -3, marginRight: 6 }} />Welcome message for every new lead</h3>
          <p className="card-subtitle">Website forms, leads added in the CRM, imports — each new lead gets this template on WhatsApp right away.</p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'On' : 'Off'} />
      </div>
      <div className="card-body">
        <div className="wa-grid wa-grid-300">
          <div>
            <div className="form-field mb-16">
              <label>Template</label>
              <TemplateSelect templates={parsed} value={tplKey} onChange={choose} loading={templatesLoading} />
              {c0.template_name && !tpl && !templatesLoading && (
                <span className="wa-hint" style={{ color: 'var(--danger)' }}>Saved template “{c0.template_name}” is no longer approved — choose another.</span>
              )}
            </div>
            {tpl?.headerFormat && tpl.headerFormat !== 'TEXT' && (
              <div className="form-field mb-16">
                <label>Header {tpl.headerFormat.toLowerCase()} URL</label>
                <input className="glass-input" value={mediaUrl} onChange={e => setMediaUrl(e.target.value.trim())} placeholder="https://…" />
              </div>
            )}
            {headerMap.length > 0 && <><label className="form-label">Header variables</label><VariableMapper mapping={headerMap} onChange={setHeaderMap} /></>}
            {bodyMap.length > 0 && <><label className="form-label">Body variables</label><VariableMapper mapping={bodyMap} onChange={setBodyMap} /></>}
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Don’t send for leads from</label>
              <div className="wa-pills">
                {LEAD_SOURCES.map(s => (
                  <button key={s} className={`filter-pill ${skip.includes(s) ? 'active' : ''}`} onClick={() => setSkip(skip.includes(s) ? skip.filter(x => x !== s) : [...skip, s])}>{s}</button>
                ))}
              </div>
            </div>
            <p className="wa-hint" style={{ marginTop: 12 }}>
              Leads who already got the instant reply (they messaged you on WhatsApp in the last 24 h) are skipped so nobody gets two messages. Leads without a valid number or who replied STOP are skipped too.
            </p>
          </div>
          <WaPreview template={tpl}
            bodyValues={paramsToValues(resolveParams(bodyMap, SAMPLE))}
            headerValues={paramsToValues(resolveParams(headerMap, SAMPLE))}
            mediaUrl={mediaUrl} title="Preview for a new lead" />
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving || templatesLoading}><Save size={15} /> {saving ? 'Saving…' : 'Save welcome automation'}</button>
        </div>
      </div>
    </section>
  )
}

export default function Automations({ templates, templatesLoading }) {
  const [autos, setAutos] = useState(null)
  useEffect(() => { getAutomations().then(setAutos) }, [])
  if (!autos) return <div className="loading-state"><div className="spinner" /></div>
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {isDemo && (
        <div className="wa-banner info"><Info size={16} />
          Demo mode: automations are saved, the bot can be tried in its test chat, and adding a lead in Leads logs a simulated welcome message. Real replies start once WhatsApp is connected (see Setup).
        </div>
      )}
      <BotBuilder initial={autos.menu_bot} />
      <InboundAutoReply initial={autos.inbound_auto_reply} botOn={autos.menu_bot.enabled} />
      <NewLeadWelcome initial={autos.new_lead_welcome} templates={templates} templatesLoading={templatesLoading} />
    </div>
  )
}
