import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  paid:     { bg: '#D1FAE5', color: '#065F46', label: 'Paid' },
  partial:  { bg: '#DBEAFE', color: '#1E40AF', label: 'Partial' },
  unpaid:   { bg: '#FEF3C7', color: '#92400E', label: 'Unpaid' },
  overdue:  { bg: '#FEE2E2', color: '#991B1B', label: 'Overdue' },
}

// Amount actually received against an invoice (jsonb payments or stored total).
const paidOf = (inv) => {
  if (inv.amount_paid != null) return Number(inv.amount_paid) || 0
  if (Array.isArray(inv.payments)) return inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  return inv.status === 'paid' ? (Number(inv.amount) || 0) : 0
}
const balanceOf = (inv) => Math.max(0, (Number(inv.amount) || 0) - paidOf(inv))

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.unpaid
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 700,
      padding: '4px 10px',
      borderRadius: 20,
      background: s.bg,
      color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchInvoices() }, [])

  const fetchInvoices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load invoices')
      console.error(error)
    } else {
      setInvoices(data || [])
    }
    setLoading(false)
  }

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete invoice')
      console.error(error)
    } else {
      toast.success('Invoice deleted')
      await fetchInvoices()
    }
  }

  const markPaid = async (inv) => {
    const amt = Number(inv.amount) || 0
    const { error } = await supabase.from('invoices')
      .update({ status: 'paid', amount_paid: amt })
      .eq('id', inv.id)
    if (error) {
      toast.error('Failed to mark as paid')
      console.error(error)
    } else {
      toast.success('Marked as paid')
      await fetchInvoices()
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    const q = search.toLowerCase()
    const matchesSearch = inv.client_name?.toLowerCase().includes(q) || inv.invoice_number?.toLowerCase().includes(q)
    const matchesFilter = filter === 'all' || inv.status === filter
    return matchesSearch && matchesFilter
  })

  const totalAmount = invoices.length
  // Sum of money actually collected vs still outstanding, across all invoices
  // (accounts for part-payments, not just fully-paid invoices).
  const paidAmount = invoices.reduce((acc, i) => acc + paidOf(i), 0)
  const unpaidAmount = invoices.reduce((acc, i) => acc + balanceOf(i), 0)
  const overdueCount = invoices.filter(i => i.status === 'overdue').length

  const statCards = [
    { label: 'Total Invoices', val: totalAmount, icon: '🧾', color: '#2563EB', bgColor: '#DBEAFE' },
    { label: 'Paid', val: `₹${paidAmount.toLocaleString()}`, icon: '✅', color: '#059669', bgColor: '#D1FAE5' },
    { label: 'Unpaid', val: `₹${unpaidAmount.toLocaleString()}`, icon: '⏳', color: '#B45309', bgColor: '#FEF3C7' },
    { label: 'Overdue', val: overdueCount, icon: '⚠️', color: '#991B1B', bgColor: '#FEE2E2' },
  ]

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  return (
    <div className="invoices-dashboard">
      <div className="invoices-header">
        <div>
          <h1 className="text-gradient">Invoices</h1>
          <p className="text-muted">{invoices.length} invoices • ₹{unpaidAmount.toLocaleString()} unpaid</p>
        </div>
        <Link to="/invoices/new" className="btn btn-primary">
          + New Invoice
        </Link>
      </div>

      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="glass-card stat-card animate-fade" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="stat-content">
              <p className="stat-label">{s.label}</p>
              <h2 className="stat-value">{s.val}</h2>
            </div>
            <div className="stat-icon-wrap" style={{ background: s.bgColor, color: s.color }}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="filter-row">
        <input className="glass-input search-input" placeholder="Search by client or invoice #..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-pills">
          <button className={`filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-pill ${filter === 'unpaid' ? 'active' : ''}`} onClick={() => setFilter('unpaid')}>Unpaid</button>
          <button className={`filter-pill ${filter === 'partial' ? 'active' : ''}`} onClick={() => setFilter('partial')}>Partial</button>
          <button className={`filter-pill ${filter === 'paid' ? 'active' : ''}`} onClick={() => setFilter('paid')}>Paid</button>
          <button className={`filter-pill ${filter === 'overdue' ? 'active' : ''}`} onClick={() => setFilter('overdue')}>Overdue</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧾</div>
          <h2>No invoices found</h2>
          <p>Create your first invoice to get started</p>
          <Link to="/invoices/new" className="btn btn-primary">+ New Invoice</Link>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700 }}>{inv.invoice_number || '—'}</td>
                    <td>{inv.client_name}</td>
                    <td>₹{(Number(inv.amount) || 0).toLocaleString()}</td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>₹{paidOf(inv).toLocaleString()}</td>
                    <td style={{ color: balanceOf(inv) > 0 ? '#B45309' : '#059669', fontWeight: 600 }}>₹{balanceOf(inv).toLocaleString()}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inv.issue_date)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inv.due_date)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {inv.status !== 'paid' && (
                          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => markPaid(inv)} title="Mark Paid">✅</button>
                        )}
                        <Link className="btn btn-ghost" style={{ padding: 8 }} to={`/invoices/${inv.id}/edit`} title="Edit">✏️</Link>
                        <button className="btn btn-ghost" style={{ padding: 8, color: '#EF4444' }} onClick={() => deleteInvoice(inv.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .invoices-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .invoices-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .invoices-header .btn { white-space: nowrap; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
        .stat-value { font-size: 22px; font-weight: 800; }
        .stat-icon-wrap { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }

        .filter-row { margin-bottom: 20px; }
        .search-input { max-width: 320px; margin-bottom: 12px; }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .invoices-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .invoices-header h1 { font-size: 22px; }
          .invoices-header .btn { width: 100%; justify-content: center; }

          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .stat-card { padding: 14px; }
          .stat-value { font-size: 18px; }

          .filter-pills {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 8px;
            -webkit-overflow-scrolling: touch;
          }
          .filter-pill { white-space: nowrap; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
