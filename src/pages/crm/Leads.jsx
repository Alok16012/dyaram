import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useCRM, LEAD_STAGES } from '../../context/CRMContext'
import { useBooking } from '../../context/BookingContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Strip everything except digits; prefix with country code if missing
function cleanPhone(raw) {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return ''
  // If 10 digits assume India
  if (digits.length === 10) return '91' + digits
  return digits
}

function ConvertBookingModal({ lead, onSave, onClose }) {
  const [form, setForm] = useState({
    total_amount: '',
    advance_percent: 20,
    travel_date: lead?.travel_date || '',
    return_date: lead?.return_date || '',
    adults: lead?.adults || 1,
    children: lead?.children || 0,
    infants: lead?.infants || 0,
    destination: lead?.destination || '',
    notes: lead?.notes || '',
  })

  const submit = () => {
    if (!form.total_amount || Number(form.total_amount) <= 0) {
      toast.error('Total amount required')
      return
    }
    onSave({
      ...form,
      total_amount: Number(form.total_amount),
      advance_percent: Number(form.advance_percent),
      lead_id: lead.id,
      customer_name: lead.name,
      customer_email: lead.email || null,
      customer_phone: lead.phone || null,
      customer_whatsapp: lead.whatsapp || lead.phone || null,
    })
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Convert to Booking — {lead.name}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body-custom">
          <div className="form-row">
            <div className="form-field">
              <label>Total Amount (₹)</label>
              <input className="glass-input" type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} placeholder="e.g. 50000" />
            </div>
            <div className="form-field">
              <label>Advance %</label>
              <input className="glass-input" type="number" value={form.advance_percent} onChange={e => setForm({ ...form, advance_percent: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label>Destination</label>
            <input className="glass-input" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Travel Date</label>
              <input className="glass-input" type="date" value={form.travel_date || ''} onChange={e => setForm({ ...form, travel_date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Return Date</label>
              <input className="glass-input" type="date" value={form.return_date || ''} onChange={e => setForm({ ...form, return_date: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Adults</label>
              <input className="glass-input" type="number" value={form.adults} onChange={e => setForm({ ...form, adults: Number(e.target.value) })} />
            </div>
            <div className="form-field">
              <label>Children</label>
              <input className="glass-input" type="number" value={form.children} onChange={e => setForm({ ...form, children: Number(e.target.value) })} />
            </div>
            <div className="form-field">
              <label>Infants</label>
              <input className="glass-input" type="number" value={form.infants} onChange={e => setForm({ ...form, infants: Number(e.target.value) })} />
            </div>
          </div>
        </div>
        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Create Booking</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const avatarColor = (name = '') => {
  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9']
  return colors[(name.charCodeAt(0) || 0) % colors.length]
}

const initials = (name = '') => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

function TransferModal({ lead, users, onTransfer, onClose }) {
  const [selected, setSelected] = useState(lead.assigned_to || '')

  const submit = () => {
    const u = users.find(x => x.id === selected)
    onTransfer(u?.id || null, u ? (u.full_name || u.username) : null)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Transfer Lead — {lead.name}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body-custom">
          <div className="form-field">
            <label>Assign To</label>
            <select className="glass-input" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— Unassigned —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
              ))}
            </select>
          </div>
          <p className="text-muted" style={{ fontSize: 12 }}>
            Currently handling: <strong>{lead.assigned_name || 'Unassigned'}</strong>
          </p>
        </div>
        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Transfer</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function LeadModal({ lead, onSave, onClose }) {
  const [form, setForm] = useState(lead || { 
    name: '', email: '', phone: '', whatsapp: '',
    destination: '', travel_date: '', stage: 'new_inquiry',
    adults: 1, children: 0, infants: 0, 
    source: 'Website', notes: ''
  })

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{lead ? 'Edit Lead' : 'Add New Lead'}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body-custom">
          <div className="form-row">
            <div className="form-field">
              <label>Full Name</label>
              <input className="glass-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Traveler Name" />
            </div>
            <div className="form-field">
              <label>Phone / WhatsApp</label>
              <input className="glass-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91 ..." />
            </div>
          </div>
          
          <div className="form-field">
            <label>Destination</label>
            <input className="glass-input" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="e.g. Kashmir, Maldives" />
          </div>
          
          <div className="form-row">
            <div className="form-field">
              <label>Travel Date</label>
              <input className="glass-input" type="date" value={form.travel_date} onChange={e => setForm({...form, travel_date: e.target.value})} />
            </div>
            <div className="form-field">
              <label>No. of Travelers (Pax)</label>
              <select
                className="glass-input"
                value={(form.adults || 0) + (form.children || 0) + (form.infants || 0) || 1}
                onChange={e => setForm({ ...form, adults: Number(e.target.value), children: 0, infants: 0 })}
              >
                {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n} Pax</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Stage</label>
            <select className="glass-input" value={form.stage} onChange={e => setForm({...form, stage: e.target.value})}>
              {LEAD_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          
          <div className="form-field">
            <label>Notes</label>
            <textarea className="glass-input" rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Shared requirements..." />
          </div>
        </div>
        
        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save Lead</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Leads() {
  const { leads, loading, fetchLeads, addLead, updateLead, deleteLead, transferLead } = useCRM()
  const { createBooking } = useBooking()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [convertLead, setConvertLead] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)
  const [users, setUsers] = useState([])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Team members (for the "Assigned To" column + transfer dropdown)
  useEffect(() => {
    supabase.from('app_users').select('id, full_name, username, active').then(({ data }) => {
      setUsers((data || []).filter(u => u.active !== false))
    })
  }, [])

  // Auto-open convert modal when ?convert=<leadId> is present (from Bookings page)
  useEffect(() => {
    const convertId = searchParams.get('convert')
    if (!convertId) return
    const target = leads.find(l => l.id === convertId)
    if (target) {
      setConvertLead(target)
      searchParams.delete('convert')
      setSearchParams(searchParams, { replace: true })
    }
  }, [leads, searchParams, setSearchParams])

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase()
    const matchesSearch = l.name?.toLowerCase().includes(q) || l.destination?.toLowerCase().includes(q)
    const matchesFilter = filter === 'all' || l.stage === filter
    return matchesSearch && matchesFilter
  })

  const stats = [
    { label: 'Total', count: leads.length, color: '#6366f1' },
    { label: 'New', count: leads.filter(l => l.stage === 'new_inquiry').length, color: '#f59e0b' },
    { label: 'Negotiating', count: leads.filter(l => ['negotiation', 'negotiating'].includes(l.stage)).length, color: '#3b82f6' },
    { label: 'Booked', count: leads.filter(l => ['advance_paid', 'documents', 'booked'].includes(l.stage)).length, color: '#10b981' },
  ]

  const handleSave = async (formData) => {
    if (!formData.name?.trim()) {
      toast.error('Name is required')
      return
    }
    
    try {
      if (editingLead) {
        await updateLead(editingLead.id, formData)
      } else {
        await addLead(formData)
      }
      // Force refetch to ensure data is synced
      await fetchLeads()
    } catch (err) {
      console.error('Save error:', err)
    }
    setEditingLead(null)
    setShowAdd(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this lead?')) {
      await deleteLead(id)
    }
  }

  const handleTransfer = async (assignedTo, assignedName) => {
    try {
      await transferLead(transferTarget.id, assignedTo, assignedName)
    } catch (err) {
      console.error('Transfer error:', err)
    }
    setTransferTarget(null)
  }

  const handleConvert = async (bookingData) => {
    try {
      const created = await createBooking(bookingData)
      if (created) {
        setConvertLead(null)
        await fetchLeads()
        navigate(`/bookings/${created.id}`)
      }
    } catch (err) {
      console.error('Convert error:', err)
    }
  }

  return (
    <div className="leads-dashboard">
      <div className="leads-header">
        <div>
          <h1 className="text-gradient">Traveler Pipeline</h1>
          <p className="text-muted">{leads.length} inquiries</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + New Lead
        </button>
      </div>

      <div className="stats-row">
        {stats.map((s, i) => (
          <div key={i} className="stat-chip glass-card animate-fade" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="stat-dot" style={{ background: s.color }} />
            <div className="stat-info">
              <span className="stat-count">{s.count}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="filter-row">
        <input className="glass-input search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-pills">
          <button className={`filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          {LEAD_STAGES.slice(0, 5).map(s => (
            <button key={s.id} className={`filter-pill ${filter === s.id ? 'active' : ''}`} onClick={() => setFilter(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card leads-table-card">
        {filteredLeads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No leads found</h3>
            <p>Add your first lead to get started</p>
          </div>
        ) : (
          <div className="leads-table-scroll">
            <table className="modern-table leads-excel-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Destination</th>
                  <th>Phone</th>
                  <th>Travel Date</th>
                  <th>Pax</th>
                  <th>Source</th>
                  <th>Stage</th>
                  <th>Assigned To</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => {
                  const stage = LEAD_STAGES.find(s => s.id === lead.stage)
                  const pax = (lead.adults || 0) + (lead.children || 0) + (lead.infants || 0)
                  return (
                    <tr key={lead.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="lead-avatar" style={{ background: avatarColor(lead.name) }}>
                            {initials(lead.name)}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{lead.name}</span>
                        </div>
                      </td>
                      <td>{lead.destination || '—'}</td>
                      <td>{lead.phone || lead.whatsapp || '—'}</td>
                      <td>
                        {lead.travel_date
                          ? new Date(lead.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                          : '—'}
                      </td>
                      <td>{pax > 0 ? `${pax} pax` : '—'}</td>
                      <td>{lead.source || '—'}</td>
                      <td>
                        <span className="stage-badge" style={{ color: stage?.color, background: `${stage?.color}15` }}>
                          {stage?.emoji} {stage?.label || lead.stage}
                        </span>
                      </td>
                      <td>
                        {lead.assigned_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="lead-avatar" style={{ width: 24, height: 24, fontSize: 10, borderRadius: 6, background: avatarColor(lead.assigned_name) }}>
                              {initials(lead.assigned_name)}
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{lead.assigned_name}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div className="lead-actions">
                          {lead.phone && (
                            <a
                              className="action-btn call"
                              href={`tel:${lead.phone.replace(/\s/g, '')}`}
                              title="Call"
                              onClick={e => e.stopPropagation()}
                            >📞</a>
                          )}
                          {(lead.whatsapp || lead.phone) && (
                            <a
                              className="action-btn whatsapp"
                              href={`https://wa.me/${cleanPhone(lead.whatsapp || lead.phone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              onClick={e => e.stopPropagation()}
                            >💬</a>
                          )}
                          <button className="action-btn convert" onClick={() => setConvertLead(lead)} title="Convert to Booking">💼</button>
                          <button className="action-btn transfer" onClick={() => setTransferTarget(lead)} title="Transfer Lead">🔄</button>
                          <button className="action-btn" onClick={() => setEditingLead(lead)} title="Edit">✏️</button>
                          <button className="action-btn delete" onClick={() => handleDelete(lead.id)} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showAdd || editingLead) && (
        <LeadModal
          lead={editingLead}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingLead(null); }}
        />
      )}

      {convertLead && (
        <ConvertBookingModal
          lead={convertLead}
          onSave={handleConvert}
          onClose={() => setConvertLead(null)}
        />
      )}

      {transferTarget && (
        <TransferModal
          lead={transferTarget}
          users={users}
          onTransfer={handleTransfer}
          onClose={() => setTransferTarget(null)}
        />
      )}

      <style jsx>{`
        .leads-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .leads-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .leads-header .btn { white-space: nowrap; }
        
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-chip {
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .stat-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .stat-info {
          display: flex;
          flex-direction: column;
        }
        .stat-count {
          font-size: 20px;
          font-weight: 800;
          line-height: 1;
        }
        .stat-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
        }
        
        .filter-row {
          margin-bottom: 20px;
        }
        .search-input {
          max-width: 300px;
          margin-bottom: 12px;
        }
        .filter-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-pill {
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #FFFFFF;
          border: 1px solid var(--border-glass);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }
        .filter-pill:hover {
          border-color: var(--primary);
          color: var(--primary-dark);
        }
        .filter-pill.active {
          background: var(--primary);
          border-color: var(--primary);
          color: #fff;
        }
        
        .leads-table-card {
          padding: 0;
          overflow: hidden;
        }
        .leads-table-scroll {
          overflow-x: auto;
        }
        .leads-excel-table th,
        .leads-excel-table td {
          white-space: nowrap;
        }
        .leads-excel-table tbody tr {
          transition: background 0.15s;
        }
        .lead-avatar {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 12px;
          color: #fff;
          flex-shrink: 0;
        }
        .stage-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .lead-actions {
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
        .action-btn.call {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.3);
          color: #2563eb;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .action-btn.whatsapp {
          background: rgba(37, 211, 102, 0.12);
          border-color: rgba(37, 211, 102, 0.35);
          color: #25D366;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .action-btn.convert {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.35);
          color: #f59e0b;
        }
        .action-btn.convert:hover {
          background: rgba(245, 158, 11, 0.25);
        }
        .action-btn.transfer {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.35);
          color: #6366f1;
        }
        .action-btn.transfer:hover {
          background: rgba(99, 102, 241, 0.25);
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
          background: #FEE2E2;
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
          .stats-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .leads-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .leads-header h1 { font-size: 22px; }
          .leads-header .btn { width: 100%; justify-content: center; }
          
          .stats-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .stat-chip { padding: 12px; }
          .stat-count { font-size: 18px; }
          .stat-label { font-size: 10px; }
          
          .filter-pills {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 8px;
            -webkit-overflow-scrolling: touch;
          }
          .filter-pill { white-space: nowrap; }
          
          .lead-item {
            padding: 14px 16px;
            gap: 12px;
          }
          .lead-avatar {
            width: 40px;
            height: 40px;
            font-size: 13px;
          }
          .lead-name { font-size: 14px; }
          .lead-meta { font-size: 11px; }
          .stage-badge { font-size: 10px; padding: 3px 8px; }
          .action-btn { width: 32px; height: 32px; font-size: 12px; }
          
          .modal-content { max-height: 95vh; }
          .modal-header { padding: 16px 20px; }
          .modal-header h3 { font-size: 16px; }
          .modal-body-custom { padding: 16px 20px; }
          .modal-footer-custom { padding: 12px 20px; }
        }
        @media (max-width: 480px) {
          .form-row { grid-template-columns: 1fr; }
          .lead-stage { display: none; }
          .lead-info { flex: 1; }
        }
      `}</style>
    </div>
  )
}
