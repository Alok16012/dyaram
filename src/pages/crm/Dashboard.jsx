import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useCRM, LEAD_STAGES } from '../../context/CRMContext'
import CRMLayout from '../../components/crm/CRMLayout'

// ── Avatar color based on name ─────────────────────────────
const AVATAR_COLORS = ['#4F6EF7','#8B5CF6','#10B981','#F59E0B','#EF4444','#0EA5E9','#F97316','#14B8A6']
function avatarColor(name = '') {
  const code = name.charCodeAt(0) || 0
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}
function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// ── Days ago helper ────────────────────────────────────────
function daysAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return '1d ago'
  return `${d}d ago`
}

// ── Stage color helper ─────────────────────────────────────
function stageInfo(stageId) {
  return LEAD_STAGES.find(s => s.id === stageId) || { label: stageId, color: '#94A3B8', bg: '#F1F5F9' }
}

// ── Custom Tooltip for chart ───────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#4F6EF7' }}>{payload[0].value} leads</div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { leads, loading, fetchLeads, getStats } = useCRM()

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const stats    = getStats()
  const recent   = [...leads].slice(0, 8)

  // Stat cards config
  const statCards = [
    {
      value: stats.total,
      label: 'Total Leads',
      icon: '👥',
      iconBg: 'linear-gradient(135deg, #EEF2FF 0%, #C7D7FD 100%)',
      iconColor: '#4F6EF7',
      glowColor: '#4F6EF7',
      trend: `${stats.thisMonth} this month`,
      trendType: 'neu',
    },
    {
      value: stats.active,
      label: 'Active Leads',
      icon: '🔥',
      iconBg: 'linear-gradient(135deg, #FFFBEB 0%, #FDE68A 100%)',
      iconColor: '#F59E0B',
      glowColor: '#F59E0B',
      trend: `${stats.hot} in negotiation`,
      trendType: 'warn',
    },
    {
      value: stats.booked,
      label: 'Bookings',
      icon: '✅',
      iconBg: 'linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)',
      iconColor: '#10B981',
      glowColor: '#10B981',
      trend: 'Advance paid +',
      trendType: 'up',
    },
    {
      value: stats.thisMonth,
      label: 'New This Month',
      icon: '📈',
      iconBg: 'linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)',
      iconColor: '#8B5CF6',
      glowColor: '#8B5CF6',
      trend: 'Fresh inquiries',
      trendType: 'neu',
    },
  ]

  // Max count for pipeline bar scaling
  const maxCount = Math.max(...stats.stageDist.map(s => s.count), 1)

  return (
    <CRMLayout>
      {/* ── PAGE HEADER ── */}
      <div className="crm-page-header">
        <div>
          <div className="crm-page-title">Dashboard</div>
          <div className="crm-page-sub">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className="crm-page-actions">
          <button className="crm-btn crm-btn-primary" onClick={() => navigate('/leads')}>
            + New Lead
          </button>
        </div>
      </div>

      {loading && leads.length === 0 ? (
        <div className="crm-loading">
          <div className="crm-spinner" />
          <p style={{ fontSize: 14 }}>Loading dashboard…</p>
        </div>
      ) : (
        <>
          {/* ── STAT CARDS ── */}
          <div className="crm-stats-grid">
            {statCards.map((card, i) => (
              <div className="crm-stat-card" key={i}>
                <div className="crm-stat-icon" style={{ background: card.iconBg }}>
                  {card.icon}
                </div>
                <div className="crm-stat-body">
                  <div className="crm-stat-value">{card.value}</div>
                  <div className="crm-stat-label">{card.label}</div>
                  <div className={`crm-stat-trend ${card.trendType}`}>{card.trend}</div>
                </div>
                <div className="crm-stat-card-glow" style={{ background: card.glowColor }} />
              </div>
            ))}
          </div>

          {/* ── MAIN GRID: Chart + Pipeline ── */}
          <div className="crm-dash-grid" style={{ marginBottom: 20 }}>

            {/* ── BAR CHART — Monthly Leads ── */}
            <div className="crm-chart-card">
              <div className="crm-chart-head">
                <div>
                  <div className="crm-chart-title">Monthly Lead Trend</div>
                  <div className="crm-chart-sub">Last 6 months</div>
                </div>
                <span className="crm-badge crm-badge-blue">Leads</span>
              </div>
              {stats.monthly.every(m => m.count === 0) ? (
                <div className="crm-empty" style={{ padding: '32px 0' }}>
                  <div className="crm-empty-icon">📊</div>
                  <p>Add leads to see monthly trend</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.monthly} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: '#94A3B8', fontWeight: 600 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      axisLine={false} tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9', radius: 6 }} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={48}>
                      {stats.monthly.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={index === stats.monthly.length - 1 ? '#4F6EF7' : '#C7D7FD'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── PIPELINE SUMMARY ── */}
            <div className="crm-pipeline-card">
              <div className="crm-pipeline-head">
                📊 Pipeline Overview
              </div>
              {stats.stageDist.map(stage => (
                <div
                  key={stage.id}
                  className="crm-pipeline-row"
                  onClick={() => navigate(`/leads?stage=${stage.id}`)}
                >
                  <div className="crm-pipeline-dot" style={{ background: stage.color }} />
                  <div className="crm-pipeline-stage">
                    {stage.emoji} {stage.label}
                  </div>
                  <div className="crm-pipeline-bar-wrap">
                    <div
                      className="crm-pipeline-bar-fill"
                      style={{
                        background: stage.color,
                        width: `${Math.round((stage.count / maxCount) * 100)}%`,
                        opacity: stage.count === 0 ? 0.2 : 1,
                      }}
                    />
                  </div>
                  <div className="crm-pipeline-count">{stage.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RECENT LEADS TABLE ── */}
          <div className="crm-table-card">
            <div className="crm-table-head">
              <div className="crm-table-title">Recent Leads</div>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => navigate('/leads')}>
                View All →
              </button>
            </div>

            {recent.length === 0 ? (
              <div className="crm-empty">
                <div className="crm-empty-icon">👥</div>
                <h3>Koi lead nahi abhi</h3>
                <p>Pehla lead add karo — Leads page pe jao</p>
                <button
                  className="crm-btn crm-btn-primary"
                  style={{ marginTop: 14 }}
                  onClick={() => navigate('/leads')}
                >
                  + Add First Lead
                </button>
              </div>
            ) : (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Destination</th>
                    <th>Travel Date</th>
                    <th>Pax</th>
                    <th>Stage</th>
                    <th>Source</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(lead => {
                    const stage = stageInfo(lead.stage)
                    const pax = (lead.adults || 0) + (lead.children || 0) + (lead.infants || 0)
                    const waMsg = encodeURIComponent(`Hi ${lead.name}! This is Shera Travels. How can I assist you with your trip?`)
                    const waLink = `https://wa.me/${(lead.whatsapp || lead.phone || '').replace(/\D/g, '')}?text=${waMsg}`
                    return (
                      <tr key={lead.id} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="crm-avatar-sm" style={{ background: avatarColor(lead.name) }}>
                              {initials(lead.name)}
                            </div>
                            <div>
                              <div className="crm-lead-name">{lead.name}</div>
                              <div className="crm-lead-dest">{lead.phone || lead.whatsapp || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.destination || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>
                            {lead.travel_date
                              ? new Date(lead.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                              : '—'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {pax > 0 ? `${pax} pax` : '—'}
                          </div>
                        </td>
                        <td>
                          <span
                            className="crm-badge"
                            style={{ background: stage.bg, color: stage.color }}
                          >
                            {stage.emoji} {stage.label}
                          </span>
                        </td>
                        <td>
                          <span className="crm-badge crm-badge-gray">{lead.source || '—'}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: '#94A3B8' }}>{daysAgo(lead.created_at)}</span>
                        </td>
                        <td>
                          <div className="crm-table-row-actions">
                            {(lead.phone || lead.whatsapp) && (
                              <a
                                className="crm-action-btn crm-action-call"
                                href={`tel:${lead.phone || lead.whatsapp}`}
                                title="Call"
                                onClick={e => e.stopPropagation()}
                              >📞</a>
                            )}
                            {(lead.whatsapp || lead.phone) && (
                              <a
                                className="crm-action-btn crm-action-wa"
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp"
                                onClick={e => e.stopPropagation()}
                              >💬</a>
                            )}
                            <button
                              className="crm-action-btn crm-action-view"
                              onClick={() => navigate(`/leads?highlight=${lead.id}`)}
                              title="View"
                            >👁</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </CRMLayout>
  )
}
