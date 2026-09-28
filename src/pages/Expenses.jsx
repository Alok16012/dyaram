import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const CATEGORIES = ['Hotel', 'Cab/Transport', 'Staff Salary', 'Marketing', 'Office', 'Other']

const todayStr = () => new Date().toISOString().slice(0, 10)

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

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
          <button className="modal-close-btn" onClick={onClose}>✕</button>
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

  const statCards = [
    { label: 'Total Expenses', val: fmtINR(totalAll), icon: '💸', color: '#B91C1C', bgColor: '#FEE2E2' },
    { label: 'This Month', val: fmtINR(totalMonth), icon: '📅', color: '#B45309', bgColor: '#FEF3C7' },
    { label: 'This Year', val: fmtINR(totalYear), icon: '📊', color: '#0E7490', bgColor: '#CFFAFE' },
  ]

  const filteredExpenses = expenses.filter(e => {
    const q = search.toLowerCase()
    return (e.category || '').toLowerCase().includes(q) || (e.vendor || '').toLowerCase().includes(q)
  })

  return (
    <div className="expenses-dashboard">
      <div className="expenses-header">
        <div>
          <h1 className="text-gradient">Expenses</h1>
          <p className="text-muted">Total: {fmtINR(totalMonth)} this month</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Expense
        </button>
      </div>

      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="glass-card stat-card animate-fade" style={{ animationDelay: `${i * 0.1}s` }}>
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
        <input className="glass-input search-input" placeholder="Search by category or vendor..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="glass-card expenses-table-card">
          {filteredExpenses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💸</div>
              <h3>No expenses found</h3>
              <p>Add your first expense to get started</p>
            </div>
          ) : (
            <div className="expenses-table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {exp.date ? new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td>
                        <span className="category-badge">{exp.category || '—'}</span>
                      </td>
                      <td>{exp.vendor || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fmtINR(exp.amount)}</td>
                      <td className="notes-cell">{exp.notes || '—'}</td>
                      <td>
                        <div className="expense-actions">
                          <button className="action-btn" onClick={() => setEditingExpense(exp)} title="Edit">✏️</button>
                          <button className="action-btn delete" onClick={() => handleDelete(exp.id)} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(showAdd || editingExpense) && (
        <ExpenseModal
          expense={editingExpense}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingExpense(null); }}
        />
      )}

      <style jsx>{`
        .expenses-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .expenses-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .expenses-header .btn { white-space: nowrap; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
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
        .stat-icon-wrap { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }

        .filter-row { margin-bottom: 20px; }
        .search-input { max-width: 320px; }

        .expenses-table-card { padding: 0; overflow: hidden; }
        .expenses-table-scroll { overflow-x: auto; }

        .category-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(16, 185, 129, 0.12);
          color: var(--primary-dark, #059669);
          white-space: nowrap;
        }
        .notes-cell {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-dim);
        }

        .expense-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
          justify-content: flex-end;
        }
        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          border: 1px solid var(--border-glass);
          background: #F8FAFC;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s;
        }
        .action-btn:hover {
          background: #F1F5F9;
          transform: scale(1.05);
        }
        .action-btn.delete:hover {
          background: rgba(239,68,68,0.12);
          border-color: #ef4444;
        }

        .empty-state {
          padding: 48px 20px;
          text-align: center;
        }
        .empty-state-icon { font-size: 48px; margin-bottom: 12px; }
        .empty-state h3 { font-size: 18px; margin-bottom: 6px; }
        .empty-state p { color: var(--text-dim); }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-content {
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-glass);
        }
        .modal-header h3 { font-size: 18px; font-weight: 800; }
        .modal-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #F1F5F9;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          font-size: 14px;
        }
        .modal-close-btn:hover {
          background: rgba(239,68,68,0.2);
          color: #ef4444;
        }
        .modal-body-custom {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-field label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .modal-footer-custom {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--border-glass);
          background: #F8FAFC;
        }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .expenses-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .expenses-header h1 { font-size: 22px; }
          .expenses-header .btn { width: 100%; justify-content: center; }

          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .stat-card { padding: 14px; }
          .stat-value { font-size: 18px; }
          .stat-label { font-size: 10px; }

          .modal-content { max-height: 95vh; }
          .modal-header { padding: 16px 20px; }
          .modal-header h3 { font-size: 16px; }
          .modal-body-custom { padding: 16px 20px; }
          .modal-footer-custom { padding: 12px 20px; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
