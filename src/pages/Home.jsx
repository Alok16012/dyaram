import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  BriefcaseBusiness, Users, CalendarCheck, IndianRupee, Star, CalendarDays,
  ChevronDown, Plus, UserPlus, FilePlus2, FileText, Send, UserRound,
  ArrowRight, Ellipsis, User, Plane, Hotel, MessageCircle, X, Map,
} from 'lucide-react'
import { usePackage } from '../context/PackageContext'
import { useCRM } from '../context/CRMContext'
import { useBooking } from '../context/BookingContext'
import { supabase } from '../lib/supabase'
import { getSession } from '../lib/auth'
import { StatCard, Card, Pill, Avatar, EmptyState } from '../components/ui'
import { BOOKING_TONE, LEAD_TONE, inr, inrShort, fmtDate, timeAgo } from '../lib/ui'
import './Home.css'

const DAY = 864e5

const RANGES = [
  { id: '7d',  label: 'Last 7 Days',   days: 7,   bucket: 'day' },
  { id: '30d', label: 'Last 30 Days',  days: 30,  bucket: 'day' },
  { id: '90d', label: 'Last 90 Days',  days: 90,  bucket: 'week' },
  { id: '12m', label: 'Last 12 Months', days: 365, bucket: 'month' },
]

const DEST_IMAGES = [
  [/ladakh|leh|nubra|pangong/i, 'photo-1455156218388-5e61b526818b'],
  [/honeymoon|houseboat|dal/i, 'photo-1589182373726-e4f658ab50f0'],
  [/gulmarg/i, 'photo-1506905925346-21bda4d32df4'],
  [/pahalgam/i, 'photo-1464822759023-fed622ff2c3b'],
  [/sonamarg/i, 'photo-1551632811-561732d1e306'],
  [/.*/, 'photo-1605649461784-eec84f8e5f0f'],
]
const destImage = (name) =>
  `https://images.unsplash.com/${DEST_IMAGES.find(([re]) => re.test(name))[1]}?w=400&q=70`

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

// % change of `cur` against `prev`, rounded; null when there's nothing to compare.
const pctChange = (cur, prev) => {
  if (!prev) return cur ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

function SendQuoteModal({ packages, onClose }) {
  const [selectedPkg, setSelectedPkg] = useState(packages[0]?.id || '')
  const [phone, setPhone] = useState('')
  const pkg = packages.find(p => p.id === selectedPkg)

  const handleSend = () => {
    if (!pkg) return
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
    const num = digits.length === 10 ? `91${digits}` : digits
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
    onClose()
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={e => e.stopPropagation()}>
        <div className="dash-modal-head">
          <h3><MessageCircle size={18} /> Send Itinerary on WhatsApp</h3>
          <button className="icon-action" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dash-modal-body">
          <label className="field-label">Select Package</label>
          <select className="glass-input" value={selectedPkg} onChange={e => setSelectedPkg(e.target.value)}>
            {packages.map(p => <option key={p.id} value={p.id}>{p.title || 'Untitled'} ({p.nights}N/{p.days}D)</option>)}
          </select>
          {pkg && (
            <div className="quote-preview">
              <div>{pkg.start_location || 'Kashmir'} · {pkg.nights}N/{pkg.days}D</div>
              {(pkg.inclusions || []).slice(0, 3).map((inc, i) => <div key={i}>✓ {inc}</div>)}
            </div>
          )}
          <label className="field-label">Customer WhatsApp Number <span>(optional)</span></label>
          <input className="glass-input" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="dash-modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={!pkg}>Open WhatsApp</button>
        </div>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{p.full}</div>
      <div className="chart-tip-value"><span />{inr(p.value)}</div>
    </div>
  )
}

export default function Home() {
  const { packages, fetchPackages, createNewPackage } = usePackage()
  const { leads, fetchLeads } = useCRM()
  const { bookings, fetchBookings } = useBooking()
  const navigate = useNavigate()
  const session = getSession()
  const [payments, setPayments] = useState([])
  const [rangeId, setRangeId] = useState('7d')
  const [sendQuoteOpen, setSendQuoteOpen] = useState(false)
  const [newMenu, setNewMenu] = useState(false)
  const [rowMenu, setRowMenu] = useState(null)
  const newMenuRef = useRef(null)

  useEffect(() => {
    fetchPackages()
    fetchLeads()
    fetchBookings()
    supabase.from('payments').select('*').then(({ data }) => setPayments(data || []))
  }, [fetchPackages, fetchLeads, fetchBookings])

  useEffect(() => {
    if (!newMenu && !rowMenu) return
    const close = (e) => {
      if (newMenuRef.current?.contains(e.target) || e.target.closest?.('.row-menu')) return
      setNewMenu(false)
      setRowMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [newMenu, rowMenu])

  const range = RANGES.find(r => r.id === rangeId)
  const now = Date.now()
  const rangeStart = startOfDay(now - (range.days - 1) * DAY).getTime()
  const prevStart = rangeStart - range.days * DAY
  const inRange = (iso) => { const t = new Date(iso).getTime(); return t >= rangeStart && t <= now }
  const inPrev = (iso) => { const t = new Date(iso).getTime(); return t >= prevStart && t < rangeStart }
  const vsLabel = `vs last ${range.days === 365 ? '12m' : `${range.days}d`}`

  const successPayments = useMemo(() => payments.filter(p => (p.status || 'success') === 'success'), [payments])

  const kpis = useMemo(() => {
    const live = bookings.filter(b => b.status !== 'cancelled')
    const sum = (arr) => arr.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const customers = (arr) => new Set(arr.map(b => (b.customer_phone || b.customer_name || '').replace(/\D/g, '') || b.customer_name)).size
    const cur = {
      leads: leads.filter(l => inRange(l.created_at)).length,
      bookings: live.filter(b => inRange(b.created_at)).length,
      revenue: sum(successPayments.filter(p => inRange(p.paid_at || p.created_at))),
      customers: customers(live.filter(b => inRange(b.created_at))),
      packages: packages.filter(p => inRange(p.created_at)).length,
    }
    const prev = {
      leads: leads.filter(l => inPrev(l.created_at)).length,
      bookings: live.filter(b => inPrev(b.created_at)).length,
      revenue: sum(successPayments.filter(p => inPrev(p.paid_at || p.created_at))),
      customers: customers(live.filter(b => inPrev(b.created_at))),
      packages: packages.filter(p => inPrev(p.created_at)).length,
    }
    return { cur, prev }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, bookings, successPayments, packages, rangeStart])

  // Revenue series bucketed by day / week / month
  const series = useMemo(() => {
    const buckets = []
    if (range.bucket === 'month') {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0)
      for (let i = 11; i >= 0; i--) {
        const s = new Date(d.getFullYear(), d.getMonth() - i, 1)
        const e = new Date(d.getFullYear(), d.getMonth() - i + 1, 1)
        buckets.push({ s: s.getTime(), e: e.getTime(), label: s.toLocaleString('en-GB', { month: 'short' }), full: s.toLocaleString('en-GB', { month: 'long', year: 'numeric' }) })
      }
    } else {
      const step = range.bucket === 'week' ? 7 : 1
      for (let t = rangeStart; t <= now; t += step * DAY) {
        const s = new Date(t)
        const label = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        buckets.push({ s: t, e: t + step * DAY, label, full: step === 7 ? `Week of ${label}` : fmtDate(s) })
      }
    }
    return buckets.map(b => ({
      ...b,
      value: successPayments.reduce((sum, p) => {
        const t = new Date(p.paid_at || p.created_at).getTime()
        return t >= b.s && t < b.e ? sum + (Number(p.amount) || 0) : sum
      }, 0),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successPayments, rangeId])

  const statusData = useMemo(() => {
    const groups = [
      { name: 'Confirmed', color: '#12A15A', ids: ['confirmed', 'fully_paid'] },
      { name: 'Pending', color: '#F5A623', ids: ['advance_paid', 'balance_due', 'draft'] },
      { name: 'Completed', color: '#3B6FF6', ids: ['completed'] },
      { name: 'Cancelled', color: '#E5484D', ids: ['cancelled'] },
    ]
    const total = bookings.length || 1
    return groups.map(g => {
      const value = bookings.filter(b => g.ids.includes(b.status)).length
      return { ...g, value, pct: Math.round((value / total) * 100) }
    })
  }, [bookings])

  const pkgTitle = (b) => packages.find(p => p.id === b.package_id)?.title?.replace(/^\d+ Nights? \d+ Days? /i, '') || `${b.destination || 'Custom'} Package`

  const recentBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    [bookings],
  )
  const recentLeads = useMemo(
    () => [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    [leads],
  )
  const upcoming = useMemo(() => {
    const today = startOfDay(now).getTime()
    return bookings
      .filter(b => b.status !== 'cancelled' && b.travel_date && new Date(b.travel_date).getTime() >= today)
      .sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date))
      .slice(0, 4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings])
  const destinations = useMemo(() => {
    const counts = {}
    bookings.filter(b => b.status !== 'cancelled').forEach(b => {
      const d = (b.destination || 'Other').replace(/ honeymoon/i, '').trim()
      counts[d] = (counts[d] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [bookings])

  const handleNewItinerary = async () => {
    const id = await createNewPackage()
    if (id) navigate(`/editor/${id}`)
  }

  const uniquePackages = packages.filter((p, i, arr) => arr.findIndex(x => (x.title || '') === (p.title || '')) === i)
  const firstName = (session?.full_name || session?.username || 'there').split(' ')[0]
  const rangeText = `${fmtDate(rangeStart, { day: 'numeric', month: 'short' })} - ${fmtDate(now, { day: 'numeric', month: 'short', year: 'numeric' })}`
  const totalBookings = bookings.length

  const quickActions = [
    { label: 'Add New Lead', icon: UserPlus, onClick: () => navigate('/leads?new=1') },
    { label: 'New Booking', icon: CalendarCheck, onClick: () => navigate('/bookings?new=1') },
    { label: 'Create Itinerary', icon: FilePlus2, onClick: handleNewItinerary },
    { label: 'View Customers', icon: UserRound, onClick: () => navigate('/customers') },
    { label: 'Send Itinerary', icon: Send, onClick: () => setSendQuoteOpen(true) },
    { label: 'Generate Invoice', icon: FileText, onClick: () => navigate('/invoices/new') },
  ]

  return (
    <div className="dash">
      {/* ── Header ── */}
      <div className="dash-top">
        <div>
          <h1 className="dash-title">Welcome back, {firstName}! <span className="wave">👋</span></h1>
          <p className="dash-sub">Here's what's happening with your travel business today.</p>
        </div>
        <div className="dash-top-actions">
          <label className="date-pill">
            <CalendarDays size={18} />
            <span>{rangeText}</span>
            <ChevronDown size={16} />
            <select value={rangeId} onChange={e => setRangeId(e.target.value)} aria-label="Date range">
              {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <div className="split-btn" ref={newMenuRef}>
            <button className="btn btn-primary split-main" onClick={() => navigate('/bookings?new=1')}>
              <Plus size={18} /> New Booking
            </button>
            <button className="btn btn-primary split-caret" onClick={() => setNewMenu(o => !o)} aria-label="More">
              <ChevronDown size={16} />
            </button>
            {newMenu && (
              <div className="dropdown">
                <button className="dropdown-item" onClick={() => navigate('/bookings?new=1')}><CalendarCheck size={16} /> New Booking</button>
                <button className="dropdown-item" onClick={() => navigate('/leads?new=1')}><UserPlus size={16} /> New Lead</button>
                <button className="dropdown-item" onClick={handleNewItinerary}><Map size={16} /> New Itinerary</button>
                <button className="dropdown-item" onClick={() => navigate('/invoices/new')}><FileText size={16} /> New Invoice</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid kpi-grid-5">
        <StatCard icon={BriefcaseBusiness} tone="blue" label="Total Packages" value={packages.length.toLocaleString('en-IN')}
          trend={pctChange(kpis.cur.packages, kpis.prev.packages)} trendLabel={vsLabel} />
        <StatCard icon={Users} tone="blue" label="New Leads" value={kpis.cur.leads.toLocaleString('en-IN')}
          trend={pctChange(kpis.cur.leads, kpis.prev.leads)} trendLabel={vsLabel} />
        <StatCard icon={CalendarCheck} tone="green" label="Confirmed Bookings" value={kpis.cur.bookings.toLocaleString('en-IN')}
          trend={pctChange(kpis.cur.bookings, kpis.prev.bookings)} trendLabel={vsLabel} />
        <StatCard icon={IndianRupee} tone="green" label="Total Revenue" value={inr(kpis.cur.revenue)}
          trend={pctChange(kpis.cur.revenue, kpis.prev.revenue)} trendLabel={vsLabel} />
        <StatCard icon={Star} tone="orange" label="Active Customers" value={kpis.cur.customers.toLocaleString('en-IN')}
          trend={pctChange(kpis.cur.customers, kpis.prev.customers)} trendLabel={vsLabel} />
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="dash-row-charts">
            {/* Revenue */}
            <Card
              title="Revenue Overview"
              subtitle="Total revenue generated from bookings"
              action={
                <select className="select-sm" value={rangeId} onChange={e => setRangeId(e.target.value)}>
                  {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              }
            >
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 16, right: 22, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#12A15A" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#12A15A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#EEF1F5" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={8}
                      interval={series.length > 12 ? Math.ceil(series.length / 8) - 1 : 0} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={inrShort} width={48} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#12A15A', strokeDasharray: '4 4', strokeOpacity: 0.5 }} />
                    <Area type="monotone" dataKey="value" stroke="#12A15A" strokeWidth={2.2} fill="url(#revFill)"
                      dot={series.length <= 14 ? { r: 3.5, fill: '#12A15A', stroke: '#fff', strokeWidth: 1.5 } : false}
                      activeDot={{ r: 5, fill: '#12A15A', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Booking status */}
            <Card title="Booking Status">
              <div className="status-wrap">
                <div className="donut">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" innerRadius="72%" outerRadius="100%" paddingAngle={1.5} stroke="none" startAngle={90} endAngle={-270}>
                        {statusData.map(s => <Cell key={s.name} fill={s.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center">
                    <div className="donut-value">{totalBookings.toLocaleString('en-IN')}</div>
                    <div className="donut-label">Total Bookings</div>
                  </div>
                </div>
                <ul className="status-legend">
                  {statusData.map(s => (
                    <li key={s.name}>
                      <span className="dot" style={{ background: s.color }} />
                      <div>
                        <div className="legend-name">{s.name}</div>
                        <div className="legend-val">{s.value} ({s.pct}%)</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          {/* Recent bookings */}
          <Card title="Recent Bookings" action={<button className="link-btn" onClick={() => navigate('/bookings')}>View All <ArrowRight size={14} /></button>} bodyClass="flush">
            {recentBookings.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No bookings yet" text="Convert a lead to create your first booking." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Customer Name</th>
                      <th>Package</th>
                      <th>Destination</th>
                      <th>Travel Date</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((b, i) => {
                      const st = BOOKING_TONE[b.status] || { tone: 'gray', label: b.status }
                      return (
                        <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                          <td>{i + 1}</td>
                          <td>
                            <div className="person-cell">
                              <span className="person-icon"><User size={15} /></span>
                              <div>
                                <div className="cell-strong">{b.customer_name}</div>
                                <div className="cell-sub">{b.customer_phone || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="cell-strong wrap-cell">{pkgTitle(b)}</td>
                          <td className="wrap-cell">{b.destination || '—'}</td>
                          <td>{fmtDate(b.travel_date)}</td>
                          <td><Pill tone={st.tone}>{st.label}</Pill></td>
                          <td className="cell-strong">{inr(b.total_amount)}</td>
                          <td className="row-menu" onClick={e => e.stopPropagation()}>
                            <button className="icon-ghost" onClick={() => setRowMenu(rowMenu === b.id ? null : b.id)}><Ellipsis size={18} /></button>
                            {rowMenu === b.id && (
                              <div className="dropdown">
                                <button className="dropdown-item" onClick={() => navigate(`/bookings/${b.id}`)}>View booking</button>
                                <button className="dropdown-item" onClick={() => navigate('/invoices/new')}>Create invoice</button>
                                {b.customer_whatsapp && (
                                  <a className="dropdown-item" href={`https://wa.me/${b.customer_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp customer</a>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="dash-row-bottom">
            {/* Popular destinations */}
            <Card title="Popular Destinations" action={<button className="link-btn" onClick={() => navigate('/bookings')}>View All <ArrowRight size={14} /></button>}>
              {destinations.length === 0 ? (
                <EmptyState title="No destinations yet" />
              ) : (
                <div className="dest-grid">
                  {destinations.map(([name, count]) => (
                    <button key={name} className="dest-card" onClick={() => navigate(`/bookings?q=${encodeURIComponent(name)}`)}>
                      <div className="dest-img" style={{ backgroundImage: `url(${destImage(name)})` }} />
                      <div className="dest-name">{name}</div>
                      <div className="dest-count">{count} Booking{count > 1 ? 's' : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Upcoming trips */}
            <Card title="Upcoming Trips" action={<button className="link-btn" onClick={() => navigate('/bookings')}>View All <ArrowRight size={14} /></button>}>
              {upcoming.length === 0 ? (
                <EmptyState icon={Plane} title="No upcoming trips" />
              ) : (
                <ul className="trip-list">
                  {upcoming.map((b, i) => {
                    const st = BOOKING_TONE[b.status] || { tone: 'gray', label: b.status }
                    const pax = (Number(b.adults) || 0) + (Number(b.children) || 0) + (Number(b.infants) || 0)
                    const TripIcon = i % 2 ? Hotel : Plane
                    return (
                      <li key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                        <span className={`trip-icon ${i % 2 ? 'alt' : ''}`}><TripIcon size={17} /></span>
                        <div className="trip-info">
                          <div className="cell-strong">{pkgTitle(b)}</div>
                          <div className="cell-sub">{fmtDate(b.travel_date)} &nbsp;•&nbsp; {pax} People</div>
                        </div>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>

        {/* ── Right column ── */}
        <aside className="dash-side">
          <Card title="Quick Actions">
            <div className="qa-grid">
              {quickActions.map(a => (
                <button key={a.label} className="qa-btn" onClick={a.onClick}>
                  <a.icon size={20} strokeWidth={1.7} />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Recent Leads" action={<button className="link-btn" onClick={() => navigate('/leads')}>View All <ArrowRight size={14} /></button>}>
            {recentLeads.length === 0 ? (
              <EmptyState icon={Users} title="No leads yet" />
            ) : (
              <ul className="lead-list">
                {recentLeads.map(l => {
                  const st = LEAD_TONE[l.stage] || { tone: 'gray', label: l.stage }
                  return (
                    <li key={l.id} onClick={() => navigate(`/leads?q=${encodeURIComponent(l.name)}`)}>
                      <Avatar name={l.name} size={40} />
                      <div className="lead-info">
                        <div className="cell-strong">{l.name}</div>
                        <div className="cell-sub">{l.destination ? `${l.destination} Trip` : 'General inquiry'}</div>
                        <div className="cell-sub">{timeAgo(l.created_at)}</div>
                      </div>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <div className="promo">
            <div className="promo-text">
              <div className="promo-eyebrow">Grow Your Business</div>
              <div className="promo-title">More Bookings,<br />More Journeys</div>
              <p>Manage leads, bookings, and customers all in one place.</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/leads')}>
                Explore Features <ArrowRight size={14} />
              </button>
            </div>
            <svg className="promo-art" viewBox="0 0 120 120" fill="none" aria-hidden="true">
              <path d="M10 70c20-6 40-26 60-30" stroke="#12A15A" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 4" />
              <g transform="translate(58 6) rotate(8)">
                <path d="M4 22 44 8c4-1.5 7 0 7 2.5S49 14 45 15.5L10 27l-6 7-4-1 4-8-5-2 1-3z" fill="#12A15A" />
                <path d="m22 16-8-10 5-1 14 7z" fill="#0C8A4B" />
              </g>
              <rect x="52" y="52" width="40" height="56" rx="8" fill="#12A15A" />
              <rect x="52" y="52" width="40" height="56" rx="8" fill="url(#pg)" />
              <rect x="64" y="42" width="16" height="12" rx="4" stroke="#0C8A4B" strokeWidth="3" />
              <path d="M62 64v34M72 64v34M82 64v34" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
              <circle cx="60" cy="112" r="4" fill="#334155" /><circle cx="84" cy="112" r="4" fill="#334155" />
              <path d="M18 108V88M24 108V80M30 108V92" stroke="#12A15A" strokeOpacity=".25" strokeWidth="4" strokeLinecap="round" />
              <defs>
                <linearGradient id="pg" x1="52" y1="52" x2="92" y2="108" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fff" stopOpacity=".18" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </aside>
      </div>

      {sendQuoteOpen && uniquePackages.length > 0 && (
        <SendQuoteModal packages={uniquePackages} onClose={() => setSendQuoteOpen(false)} />
      )}
    </div>
  )
}
