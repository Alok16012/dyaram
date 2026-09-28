import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Wallet, CalendarDays, ChartColumn, Tags, Pencil, Trash2, X } from 'lucide-react'
import { PageHeader, StatCard, Card, EmptyState, Pagination, Pill } from '../components/ui'
import { inr, fmtDate } from '../lib/ui'

const CATEGORIES = ['Hotel', 'Cab/Transport', 'Staff Salary', 'Marketing', 'Office', 'Other']

const todayStr = () => new Date().toISOString().slice(0, 10)


function ExpenseModal({ expense, onSave, onClose }) {
  const [form, setForm] = useState(expense || {
    date: todayStr(),
    category: CATEGORIES[0],
    vendor: '',
    amount: '',
    notes: '',
  })

  const submit = () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Amount is required')
      return
    }
    onSave({ ...form, amount: Number(form.amount) })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{expense ? 'Edit Expense' : 'Add Expense'}</h3>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body-custom">
          <div className="form-row">
            <div className="form-field">
              <label>Date</label>
              <input className="glass-input" type="date" value={form.date || todayStr()} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Category</label>
              <select className="glass-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Vendor</label>
              <input className="glass-input" value={form.vendor || ''} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Hotel Grand" />
            </div>
            <div className="form-field">
              <label>Amount (₹)</label>
              <input className="glass-input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 5000" />
            </div>
          </div>

          <div className="form-field">
            <label>Notes</label>
            <textarea className="glass-input" rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional details..." />
          </div>
        </div>

        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save Expense</button>
        </div>
      </div>
    </div>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [page, setPage] = useState(1)
  const [catFilter, setCatFilter] = useState('all')

  const fetchExpenses = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    if (error) {
      toast.error('Failed to load expenses')
    } else {
      setExpenses(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [])

  const addExpense = async (formData) => {
    const { error } = await supabase.from('expenses').insert([formData])
    if (error) {
      toast.error('Failed to add expense')
      return
    }
    toast.success('Expense added')
    await fetchExpenses()
  }

  const updateExpense = async (id, formData) => {
    const { error } = await supabase.from('expenses').update(formData).eq('id', id)
    if (error) {
      toast.error('Failed to update expense')
      return
    }
    toast.success('Expense updated')
    await fetchExpenses()
  }

  const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete expense')
      return
    }
    toast.success('Expense deleted')
    await fetchExpenses()
  }

  const handleSave = async (formData) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, formData)
    } else {
      await addExpense(formData)
    }
    setEditingExpense(null)
    setShowAdd(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this expense?')) {
      await deleteExpense(id)
    }
  }

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const totalAll = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
  const totalMonth = expenses
    .filter(e => e.date && new Date(e.date).getMonth() === currentMonth && new Date(e.date).getFullYear() === currentYear)
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
  const totalYear = expenses
    .filter(e => e.date && new Date(e.date).getFullYear() === currentYear)
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)

  const PAGE_SIZE = 15
  const filteredExpenses = expenses.filter(e => {
    const q = search.toLowerCase()
    const matches = !q || (e.category || '').toLowerCase().includes(q) || (e.vendor || '').toLowerCase().includes(q)
    return matches && (catFilter === 'all' || e.category === catFilter)
  })
  const pageRows = filteredExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const byCategory = CATEGORIES.map(c => ({
    name: c,
    total: expenses.filter(e => e.category === c).reduce((a, e) => a + (Number(e.amount) || 0), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  const topCat = byCategory[0]
  const CAT_COLORS = ['#12A15A', '#3B6FF6', '#F5A623', '#8B5CF6', '#0E9CB5', '#E5484D']

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`${inr(totalMonth)} spent this month`}
        actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add Expense</button>}
      />

      <div className="kpi-grid">
        <StatCard icon={Wallet} tone="red" label="Total Expenses" value={inr(totalAll)} />
        <StatCard icon={CalendarDays} tone="orange" label="This Month" value={inr(totalMonth)} />
        <StatCard icon={ChartColumn} tone="blue" label="This Year" value={inr(totalYear)} />
        <StatCard icon={Tags} tone="purple" label="Top Category" value={topCat ? topCat.name : '—'} />
      </div>

      <div className="split-2 mb-20">
        <Card title="Spend by Category" subtitle="All time">
          {byCategory.length === 0 ? <EmptyState title="No data yet" /> : (
            <ul className="bar-list">
              {byCategory.map((c, i) => (
                <li key={c.name}>
                  <div className="bar-list-head"><span>{c.name}</span><span className="cell-strong">{inr(c.total)}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.total / byCategory[0].total) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="card">
          <div className="toolbar">
            <div className="toolbar-search">
              <Search size={16} />
              <input placeholder="Search by category or vendor..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <div className="tabs-line">
              {['all', ...CATEGORIES].map(c => (
                <button key={c} className={`tab-line ${catFilter === c ? 'active' : ''}`} onClick={() => { setCatFilter(c); setPage(1) }}>
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState icon={Wallet} title="No expenses found" text="Track hotel, transport and office costs here."
              action={<button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Expense</button>} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Vendor</th>
                      <th>Notes</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(exp => (
                      <tr key={exp.id} onClick={() => setEditingExpense(exp)}>
                        <td>{fmtDate(exp.date)}</td>
                        <td><Pill tone="gray">{exp.category || '—'}</Pill></td>
                        <td className="cell-strong">{exp.vendor || '—'}</td>
                        <td>{exp.notes || '—'}</td>
                        <td className="cell-strong text-right" style={{ color: 'var(--danger)' }}>{inr(exp.amount)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="row-actions">
                            <button className="icon-action" onClick={() => setEditingExpense(exp)} title="Edit"><Pencil size={15} /></button>
                            <button className="icon-action danger" onClick={() => handleDelete(exp.id)} title="Delete"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={Math.min(page, Math.ceil(filteredExpenses.length / PAGE_SIZE))} pageSize={PAGE_SIZE} total={filteredExpenses.length} onChange={setPage} noun="expenses" />
            </>
          )}
        </div>
      </div>

      {(showAdd || editingExpense) && (
        <ExpenseModal
          expense={editingExpense}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingExpense(null); }}
        />
      )}

    </div>
  )
}
