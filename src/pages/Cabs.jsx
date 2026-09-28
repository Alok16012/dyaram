import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const RATE_UNITS = ['per day', 'per km', 'per trip']

function CabModal({ cab, onSave, onClose }) {
  const [form, setForm] = useState(cab || {
    vendor_name: '', vehicle_type: '', contact_person: '', phone: '',
    rate: '', rate_unit: 'per day', notes: ''
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{cab ? 'Edit Cab Vendor' : 'Add Cab Vendor'}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body-custom">
          <div className="form-row">
            <div className="form-field">
              <label>Vendor Name</label>
              <input className="glass-input" value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} placeholder="Vendor Name" />
            </div>
            <div className="form-field">
              <label>Vehicle Type</label>
              <input className="glass-input" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} placeholder="e.g. Sedan, SUV, Tempo Traveller" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Contact Person</label>
              <input className="glass-input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Contact Name" />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input className="glass-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Rate (₹)</label>
              <input className="glass-input" type="number" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} placeholder="e.g. 2500" />
            </div>
            <div className="form-field">
              <label>Rate Unit</label>
              <select className="glass-input" value={form.rate_unit} onChange={e => setForm({ ...form, rate_unit: e.target.value })}>
                {RATE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Notes</label>
            <textarea className="glass-input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional details..." />
          </div>
        </div>

        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save Cab</button>
        </div>
      </div>
    </div>
  )
}

export default function Cabs() {
  const [cabs, setCabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingCab, setEditingCab] = useState(null)

  const fetchCabs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cabs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load cab vendors')
      console.error(error)
    } else {
      setCabs(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchCabs() }, [])

  const addCab = async (formData) => {
    const payload = {
      ...formData,
      rate: Number(formData.rate) || 0,
    }
    const { error } = await supabase.from('cabs').insert([payload])
    if (error) {
      toast.error('Failed to add cab vendor')
      console.error(error)
    } else {
      toast.success('Cab vendor added')
      await fetchCabs()
    }
  }

  const updateCab = async (id, formData) => {
    const payload = {
      ...formData,
      rate: Number(formData.rate) || 0,
    }
    delete payload.id
    delete payload.created_at
    const { error } = await supabase.from('cabs').update(payload).eq('id', id)
    if (error) {
      toast.error('Failed to update cab vendor')
      console.error(error)
    } else {
      toast.success('Cab vendor updated')
      await fetchCabs()
    }
  }

  const deleteCab = async (id) => {
    const { error } = await supabase.from('cabs').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete cab vendor')
      console.error(error)
    } else {
      toast.success('Cab vendor deleted')
      await fetchCabs()
    }
  }

  const handleSave = async (formData) => {
    if (!formData.vendor_name?.trim()) {
      toast.error('Vendor name is required')
      return
    }
    if (editingCab) {
      await updateCab(editingCab.id, formData)
    } else {
      await addCab(formData)
    }
    setEditingCab(null)
    setShowAdd(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this cab vendor?')) {
      await deleteCab(id)
    }
  }

  const filteredCabs = cabs.filter(c => {
    const q = search.toLowerCase()
    return c.vendor_name?.toLowerCase().includes(q) || c.vehicle_type?.toLowerCase().includes(q)
  })

  return (
    <div className="cabs-page">
      <div className="cabs-header">
        <div>
          <h1 className="text-gradient">Cabs</h1>
          <p className="text-muted">{cabs.length} cab vendors</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Cab Vendor
        </button>
      </div>

      <div className="filter-row">
        <input
          className="glass-input search-input"
          placeholder="Search by vendor or vehicle type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="glass-card cabs-table-card">
          {filteredCabs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🚕</div>
              <h3>No cab vendors found</h3>
              <p>Add your first cab vendor to get started</p>
            </div>
          ) : (
            <div className="cabs-table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Contact Person</th>
                    <th>Phone</th>
                    <th>Rate</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCabs.map(cab => (
                    <tr key={cab.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, color: '#fff' }}>
                            🚕
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{cab.vendor_name}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{cab.vehicle_type || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td>{cab.contact_person || '—'}</td>
                      <td>{cab.phone || '—'}</td>
                      <td>{cab.rate ? `₹${Number(cab.rate).toLocaleString('en-IN')} ${cab.rate_unit || ''}` : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setEditingCab(cab)} title="Edit">✏️</button>
                          <button className="btn btn-ghost" style={{ padding: 8, color: '#EF4444' }} onClick={() => handleDelete(cab.id)} title="Delete">🗑️</button>
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

      {(showAdd || editingCab) && (
        <CabModal
          cab={editingCab}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingCab(null) }}
        />
      )}

      <style jsx>{`
        .cabs-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .cabs-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .cabs-header .btn { white-space: nowrap; }

        .filter-row {
          margin-bottom: 20px;
        }
        .search-input {
          max-width: 300px;
        }

        .cabs-table-card {
          padding: 0;
          overflow: hidden;
        }
        .cabs-table-scroll {
          overflow-x: auto;
        }

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

        @media (max-width: 768px) {
          .cabs-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .cabs-header h1 { font-size: 22px; }
          .cabs-header .btn { width: 100%; justify-content: center; }
          .search-input { max-width: 100%; }
        }
      `}</style>
    </div>
  )
}
