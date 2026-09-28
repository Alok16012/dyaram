import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, CalendarCheck, IndianRupee, Hourglass, BadgeCheck, Eye, Pencil, Trash2,
  X, ChevronRight, Download,
} from 'lucide-react'
import { useBooking, BOOKING_STATUSES } from '../../context/BookingContext'
import { useCRM } from '../../context/CRMContext'
import EditBookingModal from '../../components/crm/EditBookingModal'
import { PageHeader, StatCard, Pill, Avatar, EmptyState, Pagination } from '../../components/ui'
import { BOOKING_TONE, inr, fmtDate } from '../../lib/ui'

const PAGE_SIZE = 15

function PickLeadModal({ leads, onPick, onClose }) {
  const [q, setQ] = useState('')
  const filtered = leads.filter(l => {
    const s = q.toLowerCase()
    return !s || l.name?.toLowerCase().includes(s) || l.destination?.toLowerCase().includes(s)
  })
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Pick a lead to convert</h3>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body-custom">
          <div className="toolbar-search" style={{ flex: 'none' }}>
            <Search size={16} />
            <input autoFocus placeholder="Search leads..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="pick-list">
            {filtered.length === 0 ? (
              <p className="muted" style={{ padding: 24, textAlign: 'center' }}>No leads match. Add a lead first.</p>
            ) : filtered.map(l => (
              <button key={l.id} className="pick-item" onClick={() => onPick(l)}>
                <Avatar name={l.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cell-strong">{l.name}</div>
                  <div className="cell-sub">{l.destination || '—'} · {l.phone || 'no phone'}</div>
                </div>
                <ChevronRight size={18} color="#94A3B8" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function Bookings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { bookings, fetchBookings, updateBooking, deleteBooking } = useBooking()
  const { leads, fetchLeads } = useCRM()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [showLeadPicker, setShowLeadPicker] = useState(() => searchParams.get('new') === '1')
  const [editingBooking, setEditingBooking] = useState(null)
  const [page, setPage] = useState(1)

  useEffect(() => { fetchBookings() }, [fetchBookings])
  useEffect(() => { fetchLeads() }, [fetchLeads])

  const closePicker = () => {
    setShowLeadPicker(false)
    if (searchParams.has('new')) { searchParams.delete('new'); setSearchParams(searchParams, { replace: true }) }
  }

  const handleDelete = (b) => {
    if (window.confirm(`Delete booking ${b.booking_ref} for ${b.customer_name}? This cannot be undone.`)) {
      deleteBooking(b.id)
    }
  }

  // Route to leads page with a query so the ConvertBookingModal opens for this lead
  const handlePickLead = (lead) => navigate(`/leads?convert=${lead.id}`)

  const live = bookings.filter(b => b.status !== 'cancelled')
  const totalValue = live.reduce((s, b) => s + (Number(b.total_amount) || 0), 0)
  const collected = bookings.reduce((s, b) => s + (Number(b.paid_amount) || 0), 0)
  const pending = live.reduce((s, b) => s + Math.max(0, (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0)), 0)

  const filteredBookings = bookings.filter(b => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || [b.customer_name, b.booking_ref, b.customer_phone, b.destination].some(v => String(v || '').toLowerCase().includes(q))
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const exportCSV = () => {
    const cols = ['booking_ref', 'customer_name', 'customer_phone', 'destination', 'travel_date', 'total_amount', 'paid_amount', 'balance_amount', 'status', 'created_at']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.join(','), ...filteredBookings.map(b => cols.map(c => esc(b[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pageRows = filteredBookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle={`${bookings.length} reservations · track payments and trip status`}
        actions={<>
          <button className="btn btn-ghost" onClick={exportCSV}><Download size={16} /> Export</button>
          <button className="btn btn-primary" onClick={() => setShowLeadPicker(true)}><Plus size={17} /> New Booking</button>
        </>}
      />

      <div className="kpi-grid">
        <StatCard icon={CalendarCheck} tone="blue" label="Total Bookings" value={bookings.length} />
        <StatCard icon={BadgeCheck} tone="purple" label="Booking Value" value={inr(totalValue)} />
        <StatCard icon={IndianRupee} tone="green" label="Collected" value={inr(collected)} />
        <StatCard icon={Hourglass} tone="orange" label="Pending Balance" value={inr(pending)} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search booking ID, customer, destination..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="tabs-line">
            <button className={`tab-line ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => { setStatusFilter('all'); setPage(1) }}>
              All <span className="tab-count">{bookings.length}</span>
            </button>
            {BOOKING_STATUSES.map(s => (
              <button key={s.id} className={`tab-line ${statusFilter === s.id ? 'active' : ''}`} onClick={() => { setStatusFilter(s.id); setPage(1) }}>
                {s.label} <span className="tab-count">{bookings.filter(b => b.status === s.id).length}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No bookings found" text="Create a booking by converting one of your leads."
            action={<button className="btn btn-primary btn-sm" onClick={() => setShowLeadPicker(true)}><Plus size={15} /> New Booking</button>} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Destination</th>
                    <th>Travel Date</th>
                    <th>Pax</th>
                    <th>Amount</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(b => {
                    const st = BOOKING_TONE[b.status] || { tone: 'gray', label: b.status }
                    const pax = (Number(b.adults) || 0) + (Number(b.children) || 0) + (Number(b.infants) || 0)
                    const due = Math.max(0, (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0))
                    return (
                      <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}>
                        <td className="cell-strong">{b.booking_ref}</td>
                        <td>
                          <div className="person-cell">
                            <Avatar name={b.customer_name} size={34} />
                            <div>
                              <div className="cell-strong">{b.customer_name}</div>
                              <div className="cell-sub">{b.customer_phone || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>{b.destination || '—'}</td>
                        <td>{fmtDate(b.travel_date)}</td>
                        <td>{pax || '—'}</td>
                        <td className="cell-strong">{inr(b.total_amount)}</td>
                        <td style={{ color: due > 0 && b.status !== 'cancelled' ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {b.status === 'cancelled' ? '—' : inr(due)}
                        </td>
                        <td><Pill tone={st.tone}>{st.label}</Pill></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="row-actions">
                            <button className="icon-action green" title="View" onClick={() => navigate(`/bookings/${b.id}`)}><Eye size={15} /></button>
                            <button className="icon-action" title="Edit" onClick={() => setEditingBooking(b)}><Pencil size={15} /></button>
                            <button className="icon-action danger" title="Delete" onClick={() => handleDelete(b)}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={Math.min(page, Math.ceil(filteredBookings.length / PAGE_SIZE))} pageSize={PAGE_SIZE} total={filteredBookings.length} onChange={setPage} noun="bookings" />
          </>
        )}
      </div>

      {showLeadPicker && <PickLeadModal leads={leads} onPick={handlePickLead} onClose={closePicker} />}

      {editingBooking && (
        <EditBookingModal booking={editingBooking} onSave={updateBooking} onClose={() => setEditingBooking(null)} />
      )}
    </div>
  )
}
