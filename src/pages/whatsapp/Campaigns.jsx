import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Megaphone, RefreshCw, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchCampaignStats, formatPhone, MSG_TONE } from '../../lib/whatsapp'
import { EmptyState, Pill } from '../../components/ui'
import { fmtDate, timeAgo } from '../../lib/ui'

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')

function CampaignMessages({ campaign, onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('wa_messages').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: true }).limit(1000)
      .then(({ data }) => setRows(data || []))
  }, [campaign.id])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" style={{ maxWidth: 820, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{campaign.name}</h3>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body-custom">
          {!rows ? <div className="loading-state"><div className="spinner" /></div> : (
            <div className="wa-recipients" style={{ maxHeight: 460 }}>
              <table>
                <thead><tr><th>Number</th><th>Status</th><th>Message / error</th></tr></thead>
                <tbody>
                  {rows.map(m => (
                    <tr key={m.id}>
                      <td className="nowrap">{formatPhone(m.phone)}</td>
                      <td><Pill tone={MSG_TONE[m.status] || 'gray'}>{m.status}</Pill></td>
                      <td>{m.error ? <div className="wa-err">{m.error}</div> : <div className="wa-msg-body">{m.body}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function Campaigns({ refreshKey }) {
  const [campaigns, setCampaigns] = useState(null)
  const [stats, setStats] = useState({})
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('wa_campaigns').select('*').order('created_at', { ascending: false }).limit(50)
    setCampaigns(data || [])
    try { setStats(await fetchCampaignStats((data || []).map(c => c.id))) } catch { setStats({}) }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">Campaign history</h3>
          <p className="card-subtitle">Delivered and read counts update as WhatsApp reports them back.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      {!campaigns ? <div className="loading-state"><div className="spinner" /></div>
        : campaigns.length === 0 ? <EmptyState icon={Megaphone} title="No campaigns yet" text="Bulk messages you send will appear here." />
        : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Campaign</th><th>Template</th><th>Recipients</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Failed</th><th>Status</th></tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const s = stats[c.id] || { sent: 0, delivered: 0, read: 0, failed: 0 }
                  return (
                    <tr key={c.id} onClick={() => setOpen(c)}>
                      <td>
                        <div className="cell-strong">{c.name}</div>
                        <div className="cell-sub">{fmtDate(c.created_at)} · {timeAgo(c.created_at)}{c.created_by ? ` · ${c.created_by}` : ''}</div>
                      </td>
                      <td><code className="wa-code">{c.template_name}</code></td>
                      <td>{c.total}</td>
                      <td>{s.sent}</td>
                      <td>{s.delivered} <span className="dim">{pct(s.delivered, s.sent)}</span></td>
                      <td>{s.read} <span className="dim">{pct(s.read, s.sent)}</span></td>
                      <td style={{ color: s.failed ? 'var(--danger)' : undefined }}>{s.failed}</td>
                      <td><Pill tone={c.status === 'completed' ? 'green' : c.status === 'stopped' ? 'orange' : 'blue'}>{c.status}</Pill></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      {open && <CampaignMessages campaign={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
