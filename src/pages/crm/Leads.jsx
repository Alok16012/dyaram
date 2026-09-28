import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useCRM, LEAD_STAGES } from '../../context/CRMContext'
import { useBooking } from '../../context/BookingContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import {
  Plus, Search, Users, UserPlus, MessagesSquare, BadgeCheck, Phone, MessageCircle,
  BriefcaseBusiness, ArrowLeftRight, Pencil, Trash2, X, Download,
} from 'lucide-react'
import { PageHeader, StatCard, Pill, Avatar, EmptyState, Pagination } from '../../components/ui'
import { LEAD_TONE, fmtDate } from '../../lib/ui'

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
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
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
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
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
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
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
            <input className="glass-input" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="e.g. Umrah, Hajj 2027" />
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
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15
  const [showAdd, setShowAdd] = useState(() => searchParams.get('new') === '1')
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
    const matchesSearch = !q || [l.name, l.destination, l.phone, l.email, l.source].some(v => String(v || '').toLowerCase().includes(q))
    const matchesFilter = filter === 'all' || l.stage === filter
    return matchesSearch && matchesFilter
  })

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

  const countBy = (ids) => leads.filter(l => ids.includes(l.stage)).length
  const TABS = [
    { id: 'all', label: 'All' },
    ...LEAD_STAGES.map(s => ({ id: s.id, label: s.label })),
  ]

  const exportCSV = () => {
    const cols = ['name', 'phone', 'email', 'destination', 'travel_date', 'adults', 'source', 'stage', 'assigned_name', 'created_at']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.join(','), ...filteredLeads.map(l => cols.map(c => esc(l[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="leads-page">
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} travel inquiries in your pipeline`}
        actions={<>
          <button className="btn btn-ghost" onClick={exportCSV}><Download size={16} /> Export</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={17} /> New Lead</button>
        </>}
      />

      <div className="kpi-grid">
        <StatCard icon={Users} tone="blue" label="Total Leads" value={leads.length} />
        <StatCard icon={UserPlus} tone="green" label="New Inquiries" value={countBy(['new_inquiry'])} />
        <StatCard icon={MessagesSquare} tone="orange" label="In Negotiation" value={countBy(['itinerary_sent', 'negotiation'])} />
        <StatCard icon={BadgeCheck} tone="purple" label="Converted" value={countBy(['advance_paid', 'documents', 'trip_ongoing', 'completed'])} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search name, phone, destination..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="tabs-line">
            {TABS.map(t => (
              <button key={t.id} className={`tab-line ${filter === t.id ? 'active' : ''}`} onClick={() => { setFilter(t.id); setPage(1) }}>
                {t.label}
                <span className="tab-count">{t.id === 'all' ? leads.length : countBy([t.id])}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && leads.length === 0 ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filteredLeads.length === 0 ? (
          <EmptyState icon={Users} title="No leads found" text={search ? 'Try a different search or filter.' : 'Add your first lead to get started.'}
            action={!search && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> New Lead</button>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table leads-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Destination</th>
                  <th>Travel Date</th>
                  <th>Pax</th>
                  <th>Source</th>
                  <th>Stage</th>
                  <th>Assigned To</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(lead => {
                  const st = LEAD_TONE[lead.stage] || { tone: 'gray', label: lead.stage }
                  const pax = (lead.adults || 0) + (lead.children || 0) + (lead.infants || 0)
                  return (
                    <tr key={lead.id} onClick={() => setEditingLead(lead)}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={lead.name} size={36} />
                          <div>
                            <div className="cell-strong">{lead.name}</div>
                            <div className="cell-sub">{lead.phone || lead.whatsapp || lead.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{lead.destination || '—'}</td>
                      <td>{lead.travel_date ? fmtDate(lead.travel_date) : '—'}</td>
                      <td>{pax > 0 ? `${pax} pax` : '—'}</td>
                      <td>{lead.source || '—'}</td>
                      <td><Pill tone={st.tone}>{st.label}</Pill></td>
                      <td>
                        {lead.assigned_name ? (
                          <div className="person-cell" style={{ gap: 8 }}>
                            <Avatar name={lead.assigned_name} size={26} />
                            <span>{lead.assigned_name}</span>
                          </div>
                        ) : <span className="dim">Unassigned</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="row-actions">
                          {lead.phone && (
                            <a className="icon-action blue" href={`tel:${lead.phone.replace(/\s/g, '')}`} title="Call"><Phone size={15} /></a>
                          )}
                          {(lead.whatsapp || lead.phone) && (
                            <a className="icon-action whatsapp" href={`https://wa.me/${cleanPhone(lead.whatsapp || lead.phone)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                              <MessageCircle size={15} />
                            </a>
                          )}
                          <button className="icon-action green" onClick={() => setConvertLead(lead)} title="Convert to Booking"><BriefcaseBusiness size={15} /></button>
                          <button className="icon-action" onClick={() => setTransferTarget(lead)} title="Transfer Lead"><ArrowLeftRight size={15} /></button>
                          <button className="icon-action" onClick={() => setEditingLead(lead)} title="Edit"><Pencil size={15} /></button>
                          <button className="icon-action danger" onClick={() => handleDelete(lead.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredLeads.length > 0 && (
          <Pagination page={Math.min(page, Math.ceil(filteredLeads.length / PAGE_SIZE))} pageSize={PAGE_SIZE} total={filteredLeads.length} onChange={setPage} noun="leads" />
        )}
      </div>

      {(showAdd || editingLead) && (
        <LeadModal
          lead={editingLead}
          onSave={handleSave}
          onClose={() => {
            setShowAdd(false)
            setEditingLead(null)
            if (searchParams.has('new')) { searchParams.delete('new'); setSearchParams(searchParams, { replace: true }) }
          }}
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

    </div>
  )
}
