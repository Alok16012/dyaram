import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, FileText, CircleCheck, Hourglass, TriangleAlert, Pencil, Trash2, Check } from 'lucide-react'
import { PageHeader, StatCard, EmptyState, Pill, Pagination } from '../components/ui'
import { inr, fmtDate } from '../lib/ui'

const STATUS_STYLES = {
  paid:     { tone: 'green',  label: 'Paid' },
  partial:  { tone: 'blue',   label: 'Partial' },
  unpaid:   { tone: 'orange', label: 'Unpaid' },
  overdue:  { tone: 'red',    label: 'Overdue' },
}

// Amount actually received against an invoice (jsonb payments or stored total).
const paidOf = (inv) => {
  if (inv.amount_paid != null) return Number(inv.amount_paid) || 0
  if (Array.isArray(inv.payments)) return inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  return inv.status === 'paid' ? (Number(inv.amount) || 0) : 0
}
const balanceOf = (inv) => Math.max(0, (Number(inv.amount) || 0) - paidOf(inv))

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

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
    const matchesSearch = !q || inv.client_name?.toLowerCase().includes(q) || inv.invoice_number?.toLowerCase().includes(q)
    const matchesFilter = filter === 'all' || inv.status === filter
    return matchesSearch && matchesFilter
  })
  const PAGE_SIZE = 15
  const pageRows = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Sum of money actually collected vs still outstanding, across all invoices
  // (accounts for part-payments, not just fully-paid invoices).
  const paidAmount = invoices.reduce((acc, i) => acc + paidOf(i), 0)
  const unpaidAmount = invoices.reduce((acc, i) => acc + balanceOf(i), 0)
  const overdueCount = invoices.filter(i => i.status === 'overdue').length
  const TABS = ['all', 'unpaid', 'partial', 'paid', 'overdue']

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoices · ${inr(unpaidAmount)} outstanding`}
        actions={<Link to="/invoices/new" className="btn btn-primary"><Plus size={17} /> New Invoice</Link>}
      />

      <div className="kpi-grid">
        <StatCard icon={FileText} tone="blue" label="Total Invoices" value={invoices.length} />
        <StatCard icon={CircleCheck} tone="green" label="Collected" value={inr(paidAmount)} />
        <StatCard icon={Hourglass} tone="orange" label="Outstanding" value={inr(unpaidAmount)} />
        <StatCard icon={TriangleAlert} tone="red" label="Overdue" value={overdueCount} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search by client or invoice #..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="tabs-line">
            {TABS.map(t => (
              <button key={t} className={`tab-line ${filter === t ? 'active' : ''}`} onClick={() => { setFilter(t); setPage(1) }}>
                {t === 'all' ? 'All' : STATUS_STYLES[t].label}
                <span className="tab-count">{t === 'all' ? invoices.length : invoices.filter(i => i.status === t).length}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices found" text="Create your first GST invoice to get started."
            action={<Link to="/invoices/new" className="btn btn-primary btn-sm"><Plus size={15} /> New Invoice</Link>} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Client</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(inv => {
                    const st = STATUS_STYLES[inv.status] || STATUS_STYLES.unpaid
                    const bal = balanceOf(inv)
                    return (
                      <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                        <td>
                          <div className="person-cell">
                            <span className="entity-icon blue"><FileText size={16} /></span>
                            <span className="cell-strong">{inv.invoice_number || '—'}</span>
                          </div>
                        </td>
                        <td>{inv.client_name}</td>
                        <td>{fmtDate(inv.issue_date)}</td>
                        <td>{fmtDate(inv.due_date)}</td>
                        <td className="cell-strong text-right">{inr(inv.amount)}</td>
                        <td className="text-right" style={{ color: 'var(--success)' }}>{inr(paidOf(inv))}</td>
                        <td className="text-right" style={{ color: bal > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{inr(bal)}</td>
                        <td><Pill tone={st.tone}>{st.label}</Pill></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="row-actions">
                            {inv.status !== 'paid' && (
                              <button className="icon-action green" onClick={() => markPaid(inv)} title="Mark Paid"><Check size={15} /></button>
                            )}
                            <Link className="icon-action" to={`/invoices/${inv.id}/edit`} title="Edit"><Pencil size={15} /></Link>
                            <button className="icon-action danger" onClick={() => deleteInvoice(inv.id)} title="Delete"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={Math.min(page, Math.ceil(filteredInvoices.length / PAGE_SIZE))} pageSize={PAGE_SIZE} total={filteredInvoices.length} onChange={setPage} noun="invoices" />
          </>
        )}
      </div>
    </div>
  )
}
