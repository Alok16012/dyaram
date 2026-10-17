import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, CheckCheck, Inbox as InboxIcon, AlertTriangle, Info, XCircle } from 'lucide-react'
import { supabase, isDemo } from '../../lib/supabase'
import { waStatus, waTemplates } from '../../lib/whatsapp'
import { PageHeader, StatCard } from '../../components/ui'
import BulkSend from './BulkSend'
import Campaigns from './Campaigns'
import Inbox from './Inbox'
import Automations from './Automations'
import Setup from './Setup'
import './whatsapp.css'

const TABS = [
  { id: 'bulk', label: 'Bulk Send' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'automation', label: 'Automation' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'setup', label: 'Setup' },
]

function useWeekStats(refreshKey) {
  const [s, setS] = useState(null)
  useEffect(() => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString()
    supabase.from('wa_messages').select('direction, status').gte('created_at', since).limit(10000).then(({ data }) => {
      const rows = data || []
      const out = rows.filter(r => r.direction === 'out')
      const ok = out.filter(r => r.status !== 'failed')
      setS({
        sent: ok.length,
        delivered: ok.filter(r => ['delivered', 'read'].includes(r.status)).length,
        inbound: rows.filter(r => r.direction === 'in').length,
        failed: out.length - ok.length,
      })
    })
  }, [refreshKey])
  return s
}

export default function WhatsApp() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'bulk'
  const setTab = (id) => { params.set('tab', id); setParams(params, { replace: true }) }

  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(false)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const stats = useWeekStats(refreshKey)

  const checkStatus = useCallback(async () => {
    setChecking(true)
    try { setStatus(await waStatus()) } catch (e) { setStatus({ connected: false, error: e.message }) }
    setChecking(false)
  }, [])

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    setTemplatesError('')
    try { setTemplates(await waTemplates()) } catch (e) { setTemplates([]); setTemplatesError(e.message) }
    setTemplatesLoading(false)
  }, [])

  useEffect(() => { checkStatus(); loadTemplates() }, [checkStatus, loadTemplates])

  const pct = stats?.sent ? Math.round((stats.delivered / stats.sent) * 100) : 0

  return (
    <div>
      <PageHeader title="WhatsApp" subtitle="Bulk campaigns and automatic replies through the official WhatsApp Cloud API" />

      {isDemo ? (
        <div className="wa-banner info"><Info size={16} />
          <span>Demo mode — messages are simulated and nothing is sent. <button className="link-btn" onClick={() => setTab('setup')}>How to connect real WhatsApp</button></span>
        </div>
      ) : status && !status.connected ? (
        <div className="wa-banner err"><XCircle size={16} />
          <span>WhatsApp is not connected: {status.error || `missing ${status.missing?.join(', ')}`}. <button className="link-btn" onClick={() => setTab('setup')}>Open setup</button></span>
        </div>
      ) : templatesError && tab !== 'setup' ? (
        <div className="wa-banner warn"><AlertTriangle size={16} /> Could not load templates: {templatesError}</div>
      ) : null}

      <div className="kpi-grid">
        <StatCard icon={Send} tone="green" label="Sent · last 7 days" value={stats?.sent ?? '—'} />
        <StatCard icon={CheckCheck} tone="blue" label="Delivered" value={stats ? `${pct}%` : '—'} />
        <StatCard icon={InboxIcon} tone="orange" label="Incoming enquiries · 7 days" value={stats?.inbound ?? '—'} />
        <StatCard icon={AlertTriangle} tone="red" label="Failed · 7 days" value={stats?.failed ?? '—'} />
      </div>

      <div className="tabs-line wa-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab-line ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'bulk' && <BulkSend templates={templates} templatesLoading={templatesLoading} onSent={() => setRefreshKey(k => k + 1)} />}
      {tab === 'campaigns' && <Campaigns refreshKey={refreshKey} />}
      {tab === 'automation' && <Automations templates={templates} templatesLoading={templatesLoading} />}
      {tab === 'inbox' && <Inbox refreshKey={refreshKey} />}
      {tab === 'setup' && <Setup status={status} checking={checking} onRefresh={() => { checkStatus(); loadTemplates() }} />}
    </div>
  )
}
