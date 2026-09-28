import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, IndianRupee, CalendarDays, Hourglass, ArrowLeftRight, CreditCard, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBooking } from '../context/BookingContext'
import { PageHeader, StatCard, Pill, EmptyState, Pagination } from '../components/ui'
import { inr, fmtDate } from '../lib/ui'

const PAGE_SIZE = 15
const METHOD_LABEL = { razorpay: 'Razorpay', upi: 'UPI', bank_transfer: 'Bank Transfer', cash: 'Cash' }
const TYPE_LABEL = { advance: 'Advance', balance: 'Balance', full: 'Full Payment' }
const STATUS_TONE = { success: ['green', 'Success'], pending: ['orange', 'Pending'], failed: ['red', 'Failed'] }

// All payments received against bookings, across every booking.
export default function Payments() {
  const navigate = useNavigate()
  const { bookings, fetchBookings } = useBooking()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchBookings()
    supabase.from('payments').select('*').order('paid_at', { ascending: false }).then(({ data }) => {
      setPayments(data || [])
      setLoading(false)
    })
  }, [fetchBookings])

  const rows = useMemo(() => payments.map(p => ({ ...p, booking: bookings.find(b => b.id === p.booking_id) })), [payments, bookings])

  const filtered = rows.filter(p => {
    const q = search.trim().toLowerCase()
    const matches = !q || [p.booking?.customer_name, p.booking?.booking_ref, p.razorpay_payment_id, p.booking?.destination]
      .some(v => String(v || '').toLowerCase().includes(q))
    return matches && (method === 'all' || p.method === method)
  })

  const ok = rows.filter(p => (p.status || 'success') === 'success')
  const total = ok.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const now = new Date()
  const thisMonth = ok.filter(p => {
    const d = new Date(p.paid_at || p.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const pending = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (Number(b.balance_amount) || 0), 0)

  const methods = ['all', ...Object.keys(METHOD_LABEL)]

  const exportCSV = () => {
    const out = [['Date', 'Booking', 'Customer', 'Type', 'Method', 'Amount', 'Status']]
    filtered.forEach(p => out.push([fmtDate(p.paid_at || p.created_at), p.booking?.booking_ref, p.booking?.customer_name, TYPE_LABEL[p.type] || p.type, METHOD_LABEL[p.method] || p.method, p.amount, p.status]))
    const csv = out.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Every payment received against your bookings"
        actions={<button className="btn btn-ghost" onClick={exportCSV}><Download size={16} /> Export</button>}
      />

      <div className="kpi-grid">
        <StatCard icon={IndianRupee} tone="green" label="Total Collected" value={inr(total)} />
        <StatCard icon={CalendarDays} tone="blue" label="This Month" value={inr(thisMonth)} />
        <StatCard icon={Hourglass} tone="orange" label="Pending Balance" value={inr(pending)} />
        <StatCard icon={ArrowLeftRight} tone="purple" label="Transactions" value={ok.length} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search customer, booking ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="tabs-line">
            {methods.map(m => (
              <button key={m} className={`tab-line ${method === m ? 'active' : ''}`} onClick={() => { setMethod(m); setPage(1) }}>
                {m === 'all' ? 'All' : METHOD_LABEL[m]}
                <span className="tab-count">{m === 'all' ? rows.length : rows.filter(p => p.method === m).length}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments found" text="Payments recorded on bookings will show up here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Destination</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(p => {
                    const [tone, label] = STATUS_TONE[p.status || 'success'] || ['gray', p.status]
                    return (
                      <tr key={p.id} onClick={() => p.booking && navigate(`/bookings/${p.booking.id}`)}>
                        <td>{fmtDate(p.paid_at || p.created_at)}</td>
                        <td className="cell-strong">{p.booking?.booking_ref || '—'}</td>
                        <td>{p.booking?.customer_name || '—'}</td>
                        <td>{p.booking?.destination || '—'}</td>
                        <td>{TYPE_LABEL[p.type] || p.type || '—'}</td>
                        <td>{METHOD_LABEL[p.method] || p.method || '—'}</td>
                        <td><Pill tone={tone}>{label}</Pill></td>
                        <td className="cell-strong text-right">{inr(p.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={Math.min(page, Math.ceil(filtered.length / PAGE_SIZE))} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} noun="payments" />
          </>
        )}
      </div>
    </div>
  )
}
