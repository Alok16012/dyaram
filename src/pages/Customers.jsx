import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserRound, Repeat, IndianRupee, Receipt, Phone, MessageCircle, Download } from 'lucide-react'
import { useCRM } from '../context/CRMContext'
import { useBooking } from '../context/BookingContext'
import { PageHeader, StatCard, Pill, Avatar, EmptyState, Pagination } from '../components/ui'
import { inr, fmtDate } from '../lib/ui'

const PAGE_SIZE = 15
const keyOf = (phone, name) => (String(phone || '').replace(/\D/g, '').slice(-10)) || String(name || '').trim().toLowerCase()

// A customer is anyone who has booked with us (grouped by phone, falling
// back to name). Leads that never booked aren't customers yet.
export default function Customers() {
  const navigate = useNavigate()
  const { leads, fetchLeads } = useCRM()
  const { bookings, fetchBookings } = useBooking()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => { fetchLeads(); fetchBookings() }, [fetchLeads, fetchBookings])

  const customers = useMemo(() => {
    const map = new Map()
    const today = new Date().setHours(0, 0, 0, 0)
    for (const b of bookings) {
      const k = keyOf(b.customer_phone, b.customer_name)
      if (!map.has(k)) {
        map.set(k, {
          key: k, name: b.customer_name, phone: b.customer_phone, email: b.customer_email,
          whatsapp: b.customer_whatsapp || b.customer_phone,
          bookings: [], spent: 0, value: 0, destinations: new Set(), since: b.created_at,
        })
      }
      const c = map.get(k)
      c.bookings.push(b)
      if (b.status !== 'cancelled') {
        c.spent += Number(b.paid_amount) || 0
        c.value += Number(b.total_amount) || 0
      }
      if (b.destination) c.destinations.add(b.destination)
      if (new Date(b.created_at) < new Date(c.since)) c.since = b.created_at
      if (!c.email && b.customer_email) c.email = b.customer_email
    }
    return [...map.values()].map(c => {
      const live = c.bookings.filter(b => b.status !== 'cancelled')
      const upcoming = live.filter(b => b.travel_date && new Date(b.travel_date) >= today)
        .sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date))[0]
      const last = [...c.bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      const source = leads.find(l => l.id === last?.lead_id)?.source
      return {
        ...c,
        trips: live.length,
        upcoming,
        last,
        source,
        status: upcoming ? 'upcoming' : live.length ? 'travelled' : 'cancelled',
        destinations: [...c.destinations],
      }
    }).sort((a, b) => new Date(b.last?.created_at || 0) - new Date(a.last?.created_at || 0))
  }, [bookings, leads])

  const filtered = customers.filter(c => {
    const q = search.trim().toLowerCase()
    const matches = !q || [c.name, c.phone, c.email, ...c.destinations].some(v => String(v || '').toLowerCase().includes(q))
    const inTab = tab === 'all' || (tab === 'repeat' ? c.trips > 1 : c.status === tab)
    return matches && inTab
  })

  const totalSpent = customers.reduce((s, c) => s + c.spent, 0)
  const totalTrips = customers.reduce((s, c) => s + c.trips, 0)
  const repeat = customers.filter(c => c.trips > 1).length
  const STATUS = {
    upcoming: { tone: 'green', label: 'Upcoming Trip' },
    travelled: { tone: 'blue', label: 'Travelled' },
    cancelled: { tone: 'red', label: 'Cancelled' },
  }
  const TABS = [
    { id: 'all', label: 'All', count: customers.length },
    { id: 'upcoming', label: 'Upcoming Trip', count: customers.filter(c => c.status === 'upcoming').length },
    { id: 'travelled', label: 'Travelled', count: customers.filter(c => c.status === 'travelled').length },
    { id: 'repeat', label: 'Repeat', count: repeat },
  ]

  const exportCSV = () => {
    const rows = [['Name', 'Phone', 'Email', 'Trips', 'Total Paid', 'Destinations', 'Customer Since']]
    filtered.forEach(c => rows.push([c.name, c.phone, c.email, c.trips, c.spent, c.destinations.join(' / '), fmtDate(c.since)]))
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Everyone who has booked a trip with you"
        actions={<button className="btn btn-ghost" onClick={exportCSV}><Download size={16} /> Export</button>}
      />

      <div className="kpi-grid">
        <StatCard icon={UserRound} tone="blue" label="Total Customers" value={customers.length} />
        <StatCard icon={Repeat} tone="purple" label="Repeat Customers" value={repeat} />
        <StatCard icon={IndianRupee} tone="green" label="Total Collected" value={inr(totalSpent)} />
        <StatCard icon={Receipt} tone="orange" label="Avg. Trips / Customer" value={customers.length ? (totalTrips / customers.length).toFixed(1) : '0'} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search name, phone, email, destination..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="tabs-line">
            {TABS.map(t => (
              <button key={t.id} className={`tab-line ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setPage(1) }}>
                {t.label} <span className="tab-count">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={UserRound} title="No customers found" text="Customers appear here once a lead is converted into a booking." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Trips</th>
                    <th>Destinations</th>
                    <th>Total Paid</th>
                    <th>Next / Last Trip</th>
                    <th>Status</th>
                    <th className="text-right">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(c => {
                    const st = STATUS[c.status]
                    const trip = c.upcoming || c.last
                    return (
                      <tr key={c.key} onClick={() => navigate(`/bookings/${trip.id}`)}>
                        <td>
                          <div className="person-cell">
                            <Avatar name={c.name} size={36} />
                            <div>
                              <div className="cell-strong">{c.name}</div>
                              <div className="cell-sub">{c.phone || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>{c.email || '—'}</td>
                        <td>{c.trips}</td>
                        <td className="wrap-cell" style={{ whiteSpace: 'normal', maxWidth: 200 }}>{c.destinations.join(', ') || '—'}</td>
                        <td className="cell-strong">{inr(c.spent)}</td>
                        <td>{fmtDate(trip?.travel_date)}</td>
                        <td><Pill tone={st.tone}>{st.label}</Pill></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="row-actions">
                            {c.phone && <a className="icon-action blue" href={`tel:${c.phone.replace(/\s/g, '')}`} title="Call"><Phone size={15} /></a>}
                            {c.whatsapp && (
                              <a className="icon-action whatsapp" href={`https://wa.me/${c.whatsapp.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noreferrer" title="WhatsApp">
                                <MessageCircle size={15} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={Math.min(page, Math.ceil(filtered.length / PAGE_SIZE))} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} noun="customers" />
          </>
        )}
      </div>
    </div>
  )
}
