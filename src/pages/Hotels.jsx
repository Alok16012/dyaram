import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

function StarRating({ rating = 0 }) {
  const full = Math.max(0, Math.min(5, Number(rating) || 0))
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < full ? '#F59E0B' : 'var(--border-glass)' }}>
          {i < full ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

function HotelModal({ hotel, onSave, onClose }) {
  const [form, setForm] = useState(hotel || {
    name: '', location: '', star_rating: 3,
    contact_person: '', phone: '', email: '',
    rate_per_night: '', notes: ''
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{hotel ? 'Edit Hotel' : 'Add Hotel'}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body-custom">
          <div className="form-row">
            <div className="form-field">
              <label>Name</label>
              <input className="glass-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Hotel Name" />
            </div>
            <div className="form-field">
              <label>Location</label>
              <input className="glass-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Gulmarg, Kashmir" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Star Rating</label>
              <select className="glass-input" value={form.star_rating} onChange={e => setForm({ ...form, star_rating: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} Star</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Rate per Night (₹)</label>
              <input className="glass-input" type="number" value={form.rate_per_night} onChange={e => setForm({ ...form, rate_per_night: e.target.value })} placeholder="e.g. 5000" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Contact Person</label>
              <input className="glass-input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Manager Name" />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input className="glass-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." />
            </div>
          </div>

          <div className="form-field">
            <label>Email</label>
            <input className="glass-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hotel@example.com" />
          </div>

          <div className="form-field">
            <label>Notes</label>
            <textarea className="glass-input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional details..." />
          </div>
        </div>

        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save Hotel</button>
        </div>
      </div>
    </div>
  )
}

export default function Hotels() {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingHotel, setEditingHotel] = useState(null)

  const fetchHotels = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load hotels')
      console.error(error)
    } else {
      setHotels(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchHotels() }, [])

  const addHotel = async (formData) => {
    const payload = {
      ...formData,
      star_rating: Number(formData.star_rating) || 3,
      rate_per_night: Number(formData.rate_per_night) || 0,
    }
    const { error } = await supabase.from('hotels').insert([payload])
    if (error) {
      toast.error('Failed to add hotel')
      console.error(error)
    } else {
      toast.success('Hotel added')
      await fetchHotels()
    }
  }

  const updateHotel = async (id, formData) => {
    const payload = {
      ...formData,
      star_rating: Number(formData.star_rating) || 3,
      rate_per_night: Number(formData.rate_per_night) || 0,
    }
    delete payload.id
    delete payload.created_at
    const { error } = await supabase.from('hotels').update(payload).eq('id', id)
    if (error) {
      toast.error('Failed to update hotel')
      console.error(error)
    } else {
      toast.success('Hotel updated')
      await fetchHotels()
    }
  }

  const deleteHotel = async (id) => {
    const { error } = await supabase.from('hotels').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete hotel')
      console.error(error)
    } else {
      toast.success('Hotel deleted')
      await fetchHotels()
    }
  }

  const handleSave = async (formData) => {
    if (!formData.name?.trim()) {
      toast.error('Name is required')
      return
    }
    if (editingHotel) {
      await updateHotel(editingHotel.id, formData)
    } else {
      await addHotel(formData)
    }
    setEditingHotel(null)
    setShowAdd(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this hotel?')) {
      await deleteHotel(id)
    }
  }

  const filteredHotels = hotels.filter(h => {
    const q = search.toLowerCase()
    return h.name?.toLowerCase().includes(q) || h.location?.toLowerCase().includes(q)
  })

  return (
    <div className="hotels-page">
      <div className="hotels-header">
        <div>
          <h1 className="text-gradient">Hotels</h1>
          <p className="text-muted">{hotels.length} hotel partners</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Hotel
        </button>
      </div>

      <div className="filter-row">
        <input
          className="glass-input search-input"
          placeholder="Search by name or location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="glass-card hotels-table-card">
          {filteredHotels.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏨</div>
              <h3>No hotels found</h3>
              <p>Add your first hotel partner to get started</p>
            </div>
          ) : (
            <div className="hotels-table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Hotel</th>
                    <th>Star Rating</th>
                    <th>Contact Person</th>
                    <th>Phone</th>
                    <th>Rate/Night</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHotels.map(hotel => (
                    <tr key={hotel.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, color: '#fff' }}>
                            🏨
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{hotel.name}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{hotel.location || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td><StarRating rating={hotel.star_rating} /></td>
                      <td>{hotel.contact_person || '—'}</td>
                      <td>{hotel.phone || '—'}</td>
                      <td>{hotel.rate_per_night ? `₹${Number(hotel.rate_per_night).toLocaleString('en-IN')}` : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setEditingHotel(hotel)} title="Edit">✏️</button>
                          <button className="btn btn-ghost" style={{ padding: 8, color: '#EF4444' }} onClick={() => handleDelete(hotel.id)} title="Delete">🗑️</button>
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

      {(showAdd || editingHotel) && (
        <HotelModal
          hotel={editingHotel}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingHotel(null) }}
        />
      )}

      <style jsx>{`
        .hotels-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .hotels-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .hotels-header .btn { white-space: nowrap; }

        .filter-row {
          margin-bottom: 20px;
        }
        .search-input {
          max-width: 300px;
        }

        .hotels-table-card {
          padding: 0;
          overflow: hidden;
        }
        .hotels-table-scroll {
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
          .hotels-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .hotels-header h1 { font-size: 22px; }
          .hotels-header .btn { width: 100%; justify-content: center; }
          .search-input { max-width: 100%; }
        }
      `}</style>
    </div>
  )
}
