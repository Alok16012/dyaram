import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Hotel, MapPin, Star, IndianRupee, Pencil, Trash2, Phone, X } from 'lucide-react'
import { PageHeader, StatCard, EmptyState } from '../components/ui'
import { inr } from '../lib/ui'

function StarRating({ rating = 0 }) {
  const full = Math.max(0, Math.min(5, Number(rating) || 0))
  return (
    <span className="stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} fill={i < full ? '#F5A623' : 'none'} color={i < full ? '#F5A623' : '#D5DCE4'} strokeWidth={1.6} />
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
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
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
    return !q || h.name?.toLowerCase().includes(q) || h.location?.toLowerCase().includes(q) || h.contact_person?.toLowerCase().includes(q)
  })
  const locations = new Set(hotels.map(h => (h.location || '').split(',').pop().trim()).filter(Boolean))
  const avgStar = hotels.length ? (hotels.reduce((a, h) => a + (Number(h.star_rating) || 0), 0) / hotels.length).toFixed(1) : '0'
  const avgRate = hotels.length ? hotels.reduce((a, h) => a + (Number(h.rate_per_night) || 0), 0) / hotels.length : 0

  return (
    <div>
      <PageHeader
        title="Hotels"
        subtitle={`${hotels.length} hotel partners across ${locations.size} locations`}
        actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add Hotel</button>}
      />

      <div className="kpi-grid">
        <StatCard icon={Hotel} tone="blue" label="Hotel Partners" value={hotels.length} />
        <StatCard icon={MapPin} tone="green" label="Locations" value={locations.size} />
        <StatCard icon={Star} tone="orange" label="Avg. Star Rating" value={avgStar} />
        <StatCard icon={IndianRupee} tone="purple" label="Avg. Rate / Night" value={inr(avgRate)} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search by name, location or contact..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filteredHotels.length === 0 ? (
          <EmptyState icon={Hotel} title="No hotels found" text="Add your first hotel partner to get started."
            action={<button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Hotel</button>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Rating</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th className="text-right">Rate / Night</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHotels.map(hotel => (
                  <tr key={hotel.id} onClick={() => setEditingHotel(hotel)}>
                    <td>
                      <div className="person-cell">
                        <span className="entity-icon"><Hotel size={17} /></span>
                        <div>
                          <div className="cell-strong">{hotel.name}</div>
                          <div className="cell-sub">{hotel.location || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td><StarRating rating={hotel.star_rating} /></td>
                    <td>{hotel.contact_person || '—'}</td>
                    <td>{hotel.phone || '—'}</td>
                    <td>{hotel.email || '—'}</td>
                    <td className="cell-strong text-right">{hotel.rate_per_night ? inr(hotel.rate_per_night) : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        {hotel.phone && <a className="icon-action blue" href={`tel:${hotel.phone.replace(/\s/g, '')}`} title="Call"><Phone size={15} /></a>}
                        <button className="icon-action" onClick={() => setEditingHotel(hotel)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-action danger" onClick={() => handleDelete(hotel.id)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showAdd || editingHotel) && (
        <HotelModal
          hotel={editingHotel}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingHotel(null) }}
        />
      )}

    </div>
  )
}
