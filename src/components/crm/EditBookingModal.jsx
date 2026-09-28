import { useState } from 'react'
import { BOOKING_STATUSES } from '../../context/BookingContext'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function EditBookingModal({ booking, onSave, onClose }) {
  const [form, setForm] = useState({
    customer_name: booking.customer_name || '',
    customer_phone: booking.customer_phone || '',
    customer_email: booking.customer_email || '',
    total_amount: booking.total_amount || 0,
    paid_amount: booking.paid_amount || 0,
    status: booking.status || 'pending',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.customer_name.trim()) { toast.error('Customer name is required'); return }
    setSaving(true)
    const total = Number(form.total_amount) || 0
    const paid = Number(form.paid_amount) || 0
    try {
      await onSave(booking.id, {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim(),
        total_amount: total,
        paid_amount: paid,
        balance_amount: Math.max(0, total - paid),
        status: form.status,
      })
      toast.success('Booking updated')
      onClose()
    } catch {
      // onSave (updateBooking) already surfaces an error toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>Edit booking · {booking.booking_ref}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="edit-field">
            <span>Customer name</span>
            <input className="glass-input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
          </label>
          <label className="edit-field">
            <span>Phone</span>
            <input className="glass-input" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} />
          </label>
          <label className="edit-field">
            <span>Email</span>
            <input className="glass-input" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="edit-field">
              <span>Total amount (₹)</span>
              <input className="glass-input" type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} />
            </label>
            <label className="edit-field">
              <span>Paid amount (₹)</span>
              <input className="glass-input" type="number" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: e.target.value })} />
            </label>
          </div>
          <label className="edit-field">
            <span>Status</span>
            <select className="glass-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {BOOKING_STATUSES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <p className="text-dim" style={{ fontSize: 12 }}>Balance: {fmt(Math.max(0, (Number(form.total_amount) || 0) - (Number(form.paid_amount) || 0)))}</p>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={saving} style={{ background: '#F1F5F9' }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      <style jsx>{`
        .edit-field { display: flex; flex-direction: column; gap: 6px; }
        .edit-field span { font-size: 12px; font-weight: 700; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
