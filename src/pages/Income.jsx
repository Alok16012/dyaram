import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

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
          <button className="modal-close-btn" onClick={onClose}>✕</button>
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

  useEffect(() => { fetchIncome() }, [])

  const fetchIncome = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('income')
      .select('*')
      .order('created_at', { ascending: false })
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

  const statCards = [
    { label: 'Total Income', val: `₹${totalIncome.toLocaleString()}`, icon: '💰', color: '#059669', bgColor: '#D1FAE5' },
    { label: 'This Month', val: `₹${monthIncome.toLocaleString()}`, icon: '📅', color: '#2563EB', bgColor: '#DBEAFE' },
    { label: 'This Year', val: `₹${yearIncome.toLocaleString()}`, icon: '📈', color: '#0E7490', bgColor: '#CFFAFE' },
  ]

  const filteredIncome = income.filter(i => {
    const q = search.toLowerCase()
    return i.source?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
  })

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  return (
    <div className="income-dashboard">
      <div className="income-header">
        <div>
          <h1 className="text-gradient">Income</h1>
          <p className="text-muted">Total: ₹{monthIncome.toLocaleString()} this month</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Income
        </button>
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
        <input className="glass-input search-input" placeholder="Search by source or category..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : filteredIncome.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <h2>No income entries found</h2>
          <p>Add your first income entry to get started</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Income</button>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncome.map(i => (
                  <tr key={i.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(i.date)}</td>
                    <td style={{ fontWeight: 700 }}>{i.source || '—'}</td>
                    <td>{i.category || '—'}</td>
                    <td>₹{(Number(i.amount) || 0).toLocaleString()}</td>
                    <td>{i.notes || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setEditingIncome(i)} title="Edit">✏️</button>
                        <button className="btn btn-ghost" style={{ padding: 8, color: '#EF4444' }} onClick={() => deleteIncome(i.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showAdd || editingIncome) && (
        <IncomeModal
          income={editingIncome}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingIncome(null) }}
        />
      )}

      <style jsx>{`
        .income-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .income-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .income-header .btn { white-space: nowrap; }

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
        .stat-icon-wrap { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }

        .filter-row { margin-bottom: 20px; }
        .search-input { max-width: 320px; }

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
          .income-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .income-header h1 { font-size: 22px; }
          .income-header .btn { width: 100%; justify-content: center; }

          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .stat-card { padding: 14px; }
          .stat-value { font-size: 18px; }

          .modal-content { max-height: 95vh; }
          .modal-header { padding: 16px 20px; }
          .modal-header h3 { font-size: 16px; }
          .modal-body-custom { padding: 16px 20px; }
          .modal-footer-custom { padding: 12px 20px; }
        }
        @media (max-width: 480px) {
          .form-row { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
