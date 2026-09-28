import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Plus, Search, IndianRupee, CalendarDays, TrendingUp, Wallet, Pencil, Trash2, X } from 'lucide-react'
import { PageHeader, StatCard, Card, EmptyState, Pagination } from '../components/ui'
import { inr, inrShort, fmtDate } from '../lib/ui'

const CATEGORIES = ['Booking Payment', 'Commission', 'Other']

function IncomeModal({ income, onSave, onClose }) {
  const [form, setForm] = useState(income || {
    date: new Date().toISOString().slice(0, 10),
    source: '',
    category: 'Booking Payment',
    amount: '',
    notes: '',
  })

  const submit = () => {
    if (!form.source?.trim()) {
      toast.error('Source is required')
      return
    }
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{income ? 'Edit Income' : 'Add Income'}</h3>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body-custom">
          <div className="form-row">
            <div className="form-field">
              <label>Date</label>
              <input className="glass-input" type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Amount (₹)</label>
              <input className="glass-input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 15000" />
            </div>
          </div>

          <div className="form-field">
            <label>Source</label>
            <input className="glass-input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="e.g. Booking advance — Rajesh Kumar" />
          </div>

          <div className="form-field">
            <label>Category</label>
            <select className="glass-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>Notes</label>
            <textarea className="glass-input" rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
          </div>
        </div>

        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save Income</button>
        </div>
      </div>
    </div>
  )
}

export default function Income() {
  const [income, setIncome] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [page, setPage] = useState(1)
  const [expenses, setExpenses] = useState([])

  useEffect(() => { fetchIncome() }, [])
  useEffect(() => {
    supabase.from('expenses').select('*').then(({ data }) => setExpenses(data || []))
  }, [])

  const fetchIncome = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('income')
      .select('*')
      .order('date', { ascending: false })
    if (error) {
      toast.error('Failed to load income')
      console.error(error)
    } else {
      setIncome(data || [])
    }
    setLoading(false)
  }

  const addIncome = async (form) => {
    const payload = { ...form, amount: Number(form.amount) || 0 }
    const { error } = await supabase.from('income').insert([payload])
    if (error) {
      toast.error('Failed to add income')
      console.error(error)
    } else {
      toast.success('Income added')
      await fetchIncome()
    }
  }

  const updateIncome = async (id, form) => {
    const payload = { ...form, amount: Number(form.amount) || 0 }
    delete payload.id
    delete payload.created_at
    const { error } = await supabase.from('income').update(payload).eq('id', id)
    if (error) {
      toast.error('Failed to update income')
      console.error(error)
    } else {
      toast.success('Income updated')
      await fetchIncome()
    }
  }

  const deleteIncome = async (id) => {
    if (!window.confirm('Delete this income entry?')) return
    const { error } = await supabase.from('income').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete income')
      console.error(error)
    } else {
      toast.success('Income deleted')
      await fetchIncome()
    }
  }

  const handleSave = async (form) => {
    if (editingIncome) {
      await updateIncome(editingIncome.id, form)
    } else {
      await addIncome(form)
    }
    setEditingIncome(null)
    setShowAdd(false)
  }

  const now = new Date()
  const isThisMonth = (d) => {
    if (!d) return false
    const dt = new Date(d)
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()
  }
  const isThisYear = (d) => {
    if (!d) return false
    return new Date(d).getFullYear() === now.getFullYear()
  }

  const totalIncome = income.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)
  const monthIncome = income.filter(i => isThisMonth(i.date)).reduce((acc, i) => acc + (Number(i.amount) || 0), 0)
  const yearIncome = income.filter(i => isThisYear(i.date)).reduce((acc, i) => acc + (Number(i.amount) || 0), 0)

  const PAGE_SIZE = 15
  const filteredIncome = income.filter(i => {
    const q = search.toLowerCase()
    return !q || i.source?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
  })
  const pageRows = filteredIncome.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const expenseTotal = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
  const monthly = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1)
    const same = (x) => { const t = new Date(x); return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() }
    return {
      label: d.toLocaleString('en-GB', { month: 'short' }),
      Income: income.filter(i => i.date && same(i.date)).reduce((a, i) => a + (Number(i.amount) || 0), 0),
      Expenses: expenses.filter(e => e.date && same(e.date)).reduce((a, e) => a + (Number(e.amount) || 0), 0),
    }
  })

  return (
    <div>
      <PageHeader
        title="Revenue"
        subtitle={`${inr(monthIncome)} received this month`}
        actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add Income</button>}
      />

      <div className="kpi-grid">
        <StatCard icon={IndianRupee} tone="green" label="Total Income" value={inr(totalIncome)} />
        <StatCard icon={CalendarDays} tone="blue" label="This Month" value={inr(monthIncome)} />
        <StatCard icon={TrendingUp} tone="purple" label="This Year" value={inr(yearIncome)} />
        <StatCard icon={Wallet} tone={totalIncome - expenseTotal >= 0 ? 'green' : 'red'} label="Net Profit" value={inr(totalIncome - expenseTotal)} />
      </div>

      <Card title="Income vs Expenses" subtitle="Last 6 months" className="mb-20">
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 10, right: 10, left: -6, bottom: 0 }} barGap={4}>
              <CartesianGrid vertical={false} stroke="#EEF1F5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#64748B' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={inrShort} width={48} />
              <Tooltip formatter={(v) => inr(v)} cursor={{ fill: '#F4F6F9' }} contentStyle={{ borderRadius: 8, border: '1px solid #EAEEF3', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Income" fill="#0D2A7D" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Expenses" fill="#D90A0A" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search by source or category..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filteredIncome.length === 0 ? (
          <EmptyState icon={IndianRupee} title="No income entries found" text="Add your first income entry to get started."
            action={<button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Income</button>} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Category</th>
                    <th>Notes</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(i => (
                    <tr key={i.id} onClick={() => setEditingIncome(i)}>
                      <td>{fmtDate(i.date)}</td>
                      <td className="cell-strong">{i.source || '—'}</td>
                      <td>{i.category || '—'}</td>
                      <td>{i.notes || '—'}</td>
                      <td className="cell-strong text-right" style={{ color: 'var(--success)' }}>{inr(i.amount)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="icon-action" onClick={() => setEditingIncome(i)} title="Edit"><Pencil size={15} /></button>
                          <button className="icon-action danger" onClick={() => deleteIncome(i.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={Math.min(page, Math.ceil(filteredIncome.length / PAGE_SIZE))} pageSize={PAGE_SIZE} total={filteredIncome.length} onChange={setPage} noun="entries" />
          </>
        )}
      </div>

      {(showAdd || editingIncome) && (
        <IncomeModal
          income={editingIncome}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingIncome(null) }}
        />
      )}

    </div>
  )
}
