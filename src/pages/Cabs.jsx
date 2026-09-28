import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Car, Users, IndianRupee, CarTaxiFront, Pencil, Trash2, Phone, X } from 'lucide-react'
import { PageHeader, StatCard, EmptyState, Pill } from '../components/ui'
import { inr } from '../lib/ui'

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
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
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
    return !q || c.vendor_name?.toLowerCase().includes(q) || c.vehicle_type?.toLowerCase().includes(q) || c.contact_person?.toLowerCase().includes(q)
  })
  const vehicleTypes = new Set(cabs.map(c => c.vehicle_type).filter(Boolean))
  const daily = cabs.filter(c => c.rate_unit === 'per day')
  const avgDaily = daily.length ? daily.reduce((a, c) => a + (Number(c.rate) || 0), 0) / daily.length : 0

  return (
    <div>
      <PageHeader
        title="Cabs"
        subtitle={`${cabs.length} cab vendors and vehicles`}
        actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add Cab Vendor</button>}
      />

      <div className="kpi-grid">
        <StatCard icon={Users} tone="blue" label="Cab Vendors" value={cabs.length} />
        <StatCard icon={Car} tone="green" label="Vehicle Types" value={vehicleTypes.size} />
        <StatCard icon={IndianRupee} tone="orange" label="Avg. Daily Rate" value={inr(avgDaily)} />
        <StatCard icon={CarTaxiFront} tone="purple" label="Per-Trip Vendors" value={cabs.filter(c => c.rate_unit === 'per trip').length} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search by vendor, vehicle or contact..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filteredCabs.length === 0 ? (
          <EmptyState icon={Car} title="No cab vendors found" text="Add your first cab vendor to get started."
            action={<button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Cab Vendor</button>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Vehicle Type</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCabs.map(cab => (
                  <tr key={cab.id} onClick={() => setEditingCab(cab)}>
                    <td>
                      <div className="person-cell">
                        <span className="entity-icon blue"><Car size={17} /></span>
                        <div>
                          <div className="cell-strong">{cab.vendor_name}</div>
                          {cab.notes && <div className="cell-sub">{cab.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td><Pill tone="gray">{cab.vehicle_type || '—'}</Pill></td>
                    <td>{cab.contact_person || '—'}</td>
                    <td>{cab.phone || '—'}</td>
                    <td className="text-right"><span className="cell-strong">{cab.rate ? inr(cab.rate) : '—'}</span> <span className="dim">{cab.rate ? cab.rate_unit : ''}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        {cab.phone && <a className="icon-action blue" href={`tel:${cab.phone.replace(/\s/g, '')}`} title="Call"><Phone size={15} /></a>}
                        <button className="icon-action" onClick={() => setEditingCab(cab)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-action danger" onClick={() => handleDelete(cab.id)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showAdd || editingCab) && (
        <CabModal
          cab={editingCab}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingCab(null) }}
        />
      )}

    </div>
  )
}
