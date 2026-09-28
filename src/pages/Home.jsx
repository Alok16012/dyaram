import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePackage } from '../context/PackageContext'
import { useCRM, LEAD_STAGES } from '../context/CRMContext'
import { supabase } from '../lib/supabase'

const avatarColor = (name = '') => {
  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9']
  return colors[(name.charCodeAt(0) || 0) % colors.length]
}
const initials = (name = '') => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

function SendQuoteModal({ packages, onClose }) {
  const [selectedPkg, setSelectedPkg] = useState(packages[0]?.id || '')
  const [phone, setPhone]             = useState('')
  const [sending, setSending]         = useState(false)

  const pkg = packages.find(p => p.id === selectedPkg)

  const handleSend = () => {
    if (!pkg) { return }
    setSending(true)

    const incLines = (pkg.inclusions || []).slice(0, 6).map(i => `  ✅ ${i}`).join('\n')
    const msg =
`✈️ *${pkg.title || 'Kashmir Tour Package'}*

📍 ${pkg.start_location || 'Kashmir, India'}
🌙 ${pkg.nights || '—'} Nights / ${pkg.days || '—'} Days

${incLines ? `📋 *What's Included*\n${incLines}\n` : ''}
💬 For pricing & availability, reply to this message or call us directly.

📞 *Shera Travels*
+91 9149406965 | +91 9858966518
sheratravels21@gmail.com

_Let's plan your dream trip to Kashmir!_ 🏔️`

    const digits = phone.replace(/\D/g, '')
    const num    = digits.length === 10 ? `91${digits}` : digits
    const url    = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`

    window.open(url, '_blank')
    setSending(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
         onClick={onClose}>
      <div className="glass-card animate-fade"
           style={{ width:'100%', maxWidth:440, padding:0, overflow:'hidden' }}
           onClick={e => e.stopPropagation()}>

        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border-glass)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ fontSize:16, fontWeight:800 }}>💬 Send Quote on WhatsApp</h3>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.05)', border:'none', color:'var(--text-dim)', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Select Package</label>
            <select className="glass-input" value={selectedPkg} onChange={e => setSelectedPkg(e.target.value)}>
              {packages.map(p => (
                <option key={p.id} value={p.id}>{p.title || 'Untitled'} ({p.nights}N/{p.days}D)</option>
              ))}
            </select>
          </div>

          {pkg && (
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-glass)', borderRadius:10, padding:'12px 14px', fontSize:13, color:'var(--text-dim)', lineHeight:1.6 }}>
              📍 {pkg.start_location || 'Kashmir'} &nbsp;•&nbsp; 🌙 {pkg.nights}N/{pkg.days}D
              {(pkg.inclusions||[]).length > 0 && (
                <div style={{ marginTop:6 }}>
                  {(pkg.inclusions||[]).slice(0,3).map((inc, i) => <span key={i} style={{ display:'block' }}>✅ {inc}</span>)}
                  {(pkg.inclusions||[]).length > 3 && <span style={{ color:'var(--primary)', fontSize:11 }}>+{(pkg.inclusions||[]).length - 3} more inclusions</span>}
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Customer WhatsApp Number <span style={{ fontWeight:400, textTransform:'none', color:'var(--text-dim)' }}>(optional)</span></label>
            <input
              className="glass-input"
              placeholder="+91 9876543210  (leave blank to pick contact)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border-glass)', display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            onClick={handleSend}
            disabled={!pkg || sending}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10, background:'#25D366', border:'none', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
            💬 Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const { packages, fetchPackages, createNewPackage } = usePackage()
  const { leads, fetchLeads, loading: leadsLoading } = useCRM()
  const navigate = useNavigate()
  const [sendQuoteOpen, setSendQuoteOpen] = useState(false)

  // Deduplicate packages by title for Send Quote (keep most recent per title)
  const uniquePackages = packages.reduce((acc, pkg) => {
    const existing = acc.find(p => (p.title || 'Untitled') === (pkg.title || 'Untitled'))
    if (!existing) acc.push(pkg)
    return acc
  }, [])

  const recentLeads = leads.slice(0, 6)

  const [stats, setStats] = useState({
    totalLeads: 0,
    totalBookings: 0,
    activeRevenue: 0,
  })

  const loadQuickStats = async () => {
    try {
      const [leadsRes, bookingsRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('total_amount')
      ])

      const revenue = (bookingsRes.data || []).reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0)

      setStats({
        totalLeads: leadsRes.count || 0,
        totalBookings: (bookingsRes.data || []).length,
        activeRevenue: revenue
      })
    } catch (e) {
      console.warn('Could not load extra stats:', e)
    }
  }

  useEffect(() => {
    fetchPackages()
    fetchLeads()
    loadQuickStats()
  }, [fetchPackages, fetchLeads])

  const handleNew = async () => {
    const id = await createNewPackage()
    if (id) navigate(`/editor/${id}`)
  }

  const statCards = [
    { label: 'Total Packages', val: uniquePackages.length, icon: '📦', color: '#059669', bgColor: '#D1FAE5' },
    { label: 'New Leads', val: stats.totalLeads, icon: '👥', color: '#2563EB', bgColor: '#DBEAFE' },
    { label: 'Confirmed Bookings', val: stats.totalBookings, icon: '📅', color: '#B45309', bgColor: '#FEF3C7' },
    { label: 'Total Revenue', val: `₹${stats.activeRevenue.toLocaleString()}`, icon: '💰', color: '#0E7490', bgColor: '#CFFAFE' },
  ]

  return (
    <div className="home-dashboard">
      <div className="dashboard-header animate-fade">
        <div>
          <h1 className="text-gradient">Agency Overview</h1>
          <p className="text-muted">Welcome back. Here's a summary of your travel operations.</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          <span>✨</span> Create New Itinerary
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="glass-card stat-card animate-fade" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="stat-content">
              <p className="stat-label">{s.label}</p>
              <h2 className="stat-value">{s.val}</h2>
            </div>
            <div className="stat-icon-wrap" style={{
               background: s.bgColor,
               color: s.color,
            }}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        {/* Recent Leads */}
        <section className="dashboard-section animate-fade" style={{ animationDelay: '0.4s' }}>
          <div className="section-head">
            <h3>Recent Leads ({leads.length})</h3>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate('/leads')}>View All →</button>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Destination</th>
                  <th>Phone</th>
                  <th>Stage</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {leadsLoading ? (
                  <tr><td colSpan="5">Loading...</td></tr>
                ) : recentLeads.length === 0 ? (
                  <tr><td colSpan="5">No leads yet.</td></tr>
                ) : recentLeads.map(lead => {
                  const stage = LEAD_STAGES.find(s => s.id === lead.stage)
                  return (
                    <tr key={lead.id} className="clickable-row" onClick={() => navigate('/leads')}>
                      <td>
                        <div className="pkg-name-cell">
                          <div className="lead-avatar" style={{ background: avatarColor(lead.name) }}>
                            {initials(lead.name)}
                          </div>
                          <span>{lead.name || 'Unnamed'}</span>
                        </div>
                      </td>
                      <td>{lead.destination || '—'}</td>
                      <td>{lead.phone || lead.whatsapp || '—'}</td>
                      <td>
                        <span className="stage-badge" style={{ color: stage?.color, background: `${stage?.color}15` }}>
                          {stage?.emoji} {stage?.label || lead.stage}
                        </span>
                      </td>
                      <td>
                        {lead.created_at
                          ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Shortcuts / Quick Actions */}
        <aside className="dashboard-section animate-fade" style={{ animationDelay: '0.5s' }}>
          <div className="section-head">
            <h3>Quick Actions</h3>
          </div>
          <div className="shortcuts-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div className="glass-card shortcut-item" onClick={() => navigate('/leads')}>
                <div className="shortcut-meta">
                   <h4>👤 New Lead</h4>
                   <p>Add a fresh inquiry</p>
                </div>
                <span>→</span>
             </div>
             <div className="glass-card shortcut-item" onClick={() => setSendQuoteOpen(true)}>
                <div className="shortcut-meta">
                   <h4>💬 Send Quote</h4>
                   <p>Share itinerary on WhatsApp</p>
                </div>
                <span>→</span>
             </div>
             <div className="glass-card shortcut-item" onClick={() => navigate('/admin')}>
                <div className="shortcut-meta">
                   <h4>🛠️ Config</h4>
                   <p>System settings</p>
                </div>
                <span>→</span>
             </div>
          </div>
        </aside>
      </div>

      {sendQuoteOpen && packages.length > 0 && (
        <SendQuoteModal packages={uniquePackages} onClose={() => setSendQuoteOpen(false)} />
      )}

      <style jsx>{`
        .dashboard-header { margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
        .dashboard-header h1 { font-size: 32px; font-weight: 800; margin-bottom: 4px; }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 48px;
        }
        .stat-card {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-label { font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
        .stat-value { font-size: 28px; font-weight: 800; }
        .stat-icon-wrap { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
        
        .dashboard-sections { display: grid; grid-template-columns: 2.5fr 1fr; gap: 32px; }
        @media (max-width: 1024px) { .dashboard-sections { grid-template-columns: 1fr; } }
        
        .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .section-head h3 { font-size: 18px; font-weight: 800; }
        
        .pkg-name-cell { display: flex; align-items: center; gap: 12px; font-weight: 600; }
        .pkg-mini-img { width: 32px; height: 32px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; border-radius: 8px; }

        .lead-avatar {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 12px;
          color: #fff;
          flex-shrink: 0;
        }
        .stage-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .clickable-row { cursor: pointer; }
        .clickable-row:hover { background: rgba(255,255,255,0.03); }

        .shortcut-item { 
          padding: 20px; 
          cursor: pointer; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          transition: var(--transition);
        }
        .shortcut-item:hover { transform: translateX(5px); background: rgba(255,255,255,0.05); }
        .shortcut-item h4 { font-size: 15px; margin-bottom: 2px; }
        .shortcut-item p { font-size: 12px; color: var(--text-dim); }
        .shortcut-item span { color: var(--primary); font-weight: 800; }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 24px;
          }
          .dashboard-header h1 { font-size: 24px; }
          .dashboard-header .btn { width: 100%; justify-content: center; }
          
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .stat-card { padding: 16px; }
          .stat-value { font-size: 20px; }
          .stat-icon-wrap { width: 40px; height: 40px; font-size: 18px; border-radius: 8px; }
          .stat-label { font-size: 10px; }
          
          .dashboard-sections { gap: 20px; }
          .section-head { flex-wrap: wrap; gap: 8px; }
          .section-head h3 { font-size: 15px; }
        }

        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
          .stat-card { padding: 16px; flex-direction: row; }
          .stat-value { font-size: 24px; }
          .shortcut-item { padding: 14px; }
          .shortcut-item h4 { font-size: 14px; }
        }
      `}</style>
    </div>
  )
}
