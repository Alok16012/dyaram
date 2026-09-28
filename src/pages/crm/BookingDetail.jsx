import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBooking, BOOKING_STATUSES } from '../../context/BookingContext'
import { supabase } from '../../lib/supabase'
import { sendInvoiceEmail, printInvoice, printReceipt } from '../../lib/email'
import EditBookingModal from '../../components/crm/EditBookingModal'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentBooking: booking, payments, loading, fetchBooking, fetchPayments, updateBooking, deleteBooking, recordPayment } = useBooking()

  const [activeTab, setActiveTab] = useState('summary')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [pkg, setPkg] = useState(null)
  const [showEdit, setShowEdit] = useState(false)

  const handleDelete = async () => {
    if (window.confirm(`Delete booking ${booking?.booking_ref} for ${booking?.customer_name}? This cannot be undone.`)) {
      await deleteBooking(booking.id)
      navigate('/bookings')
    }
  }

  useEffect(() => {
    fetchBooking(id)
    fetchPayments(id)
  }, [id, fetchBooking, fetchPayments])

  useEffect(() => {
    if (!booking?.package_id) return
    supabase.from('packages').select('*').eq('id', booking.package_id).single()
      .then(({ data }) => setPkg(data))
  }, [booking?.package_id])

  if (loading || !booking) {
    if (loading) return <div className="page-content center">Loading...</div>
    // Not loading and still no booking → true not-found state
    return (
      <div className="page-content center" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
        <h2 style={{ marginBottom: '8px' }}>Booking not found</h2>
        <p className="text-dim" style={{ marginBottom: '24px' }}>
          This booking doesn't exist on this device. It may have been created in another browser
          or removed.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/bookings')}>
          ← Back to Bookings
        </button>
      </div>
    )
  }

  const paidAmt = Number(booking?.paid_amount || 0)
  const totalAmt = Number(booking?.total_amount || 0)
  const balance = Math.max(0, totalAmt - paidAmt)
  const paidPct = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0

  return (
    <div className="booking-detail-page page-content">
      <div className="detail-header animate-fade">
        <div className="header-left">
          <button className="icon-btn back-btn" onClick={() => navigate('/bookings')}>←</button>
          <div className="title-block">
            <h2 className="text-gradient">{booking?.booking_ref}</h2>
            <p className="text-dim">{booking?.customer_name} • {booking?.destination || 'Trip'}</p>
          </div>
        </div>
        <div className="header-right">
          <select
            className="glass-input status-select"
            value={booking?.status}
            onChange={e => updateBooking(id, { status: e.target.value })}
          >
            {BOOKING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn action-edit" onClick={() => setShowEdit(true)}>✏️ Edit</button>
          <button className="btn action-delete" onClick={handleDelete}>🗑️ Delete</button>
        </div>
      </div>

      {showEdit && (
        <EditBookingModal
          booking={booking}
          onSave={updateBooking}
          onClose={() => setShowEdit(false)}
        />
      )}

      <div className="glass-card progress-grid animate-fade" style={{ animationDelay: '0.1s' }}>
        <div className="stat-pill">
          <span className="label">Total Contract</span>
          <h3 className="val">{fmt(totalAmt)}</h3>
        </div>
        <div className="stat-pill">
          <span className="label">Amount Paid</span>
          <h3 className="val text-success">{fmt(paidAmt)}</h3>
        </div>
        <div className="stat-pill">
          <span className="label">Balance Due</span>
          <h3 className="val text-warning">{fmt(balance)}</h3>
        </div>
        <div className="progress-section">
          <div className="progress-meta">
            <span className="pct">{paidPct}% Collected</span>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      </div>

      <div className="detail-workspace animate-fade" style={{ animationDelay: '0.2s' }}>
        <aside className="detail-tabs glass-card">
          <button className={`detail-tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
            📋 Trip Summary
          </button>
          <button className={`detail-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
            💳 Payment History
          </button>
          <button className={`detail-tab ${activeTab === 'share' ? 'active' : ''}`} onClick={() => setActiveTab('share')}>
            📤 Guest Access
          </button>
        </aside>

        <div className="detail-main glass-card">
          {activeTab === 'summary' && (
            <div className="summary-view">
              <div className="info-group">
                <h4>Customer Information</h4>
                <div className="info-grid">
                  <div className="info-item"><label>Email</label><span>{booking?.customer_email || '—'}</span></div>
                  <div className="info-item"><label>Phone</label><span>{booking?.customer_phone || '—'}</span></div>
                  <div className="info-item"><label>WhatsApp</label><span>{booking?.customer_whatsapp || '—'}</span></div>
                </div>
              </div>
              <div className="info-group">
                <h4>Trip Details</h4>
                <div className="info-grid">
                  <div className="info-item"><label>Package</label><span>{pkg?.title || 'Custom'}</span></div>
                  <div className="info-item"><label>Travel Date</label><span>{booking?.travel_date ? new Date(booking.travel_date).toLocaleDateString() : '—'}</span></div>
                  <div className="info-item"><label>Pax</label><span>{booking?.adults} Adults, {booking?.children} Children</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="payments-view">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <h4 style={{ fontSize: 14, fontWeight: 800 }}>Payment History</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}
                    onClick={() => printInvoice(booking, payments)}>
                    🖨️ Print Invoice
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}
                    onClick={async () => {
                      try {
                        await sendInvoiceEmail(booking, payments)
                        toast.success(booking.customer_email ? `Invoice sent to ${booking.customer_email}` : 'Admin notified')
                      } catch (e) {
                        toast.error(e.message)
                      }
                    }}>
                    📧 Email Invoice
                  </button>
                </div>
              </div>

              <table className="modern-table">
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th>Receipt</th></tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const paidSoFar = payments
                      .filter(x => new Date(x.created_at) <= new Date(p.created_at))
                      .reduce((s, x) => s + Number(x.amount || 0), 0)
                    const balAfter = Math.max(0, Number(booking?.total_amount || 0) - paidSoFar)
                    return (
                      <tr key={p.id}>
                        <td>{new Date(p.created_at).toLocaleDateString()}</td>
                        <td>{fmt(p.amount)}</td>
                        <td style={{ textTransform: 'capitalize' }}>{p.method}</td>
                        <td><span className="badge-mini">Success</span></td>
                        <td>
                          <button
                            style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}
                            onClick={() => printReceipt(booking, Number(p.amount), paidSoFar, balAfter)}
                            title="Print receipt for this payment"
                          >🖨️</button>
                        </td>
                      </tr>
                    )
                  })}
                  {payments.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>No payments recorded</td></tr>
                  )}
                </tbody>
              </table>
              <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => setShowPaymentModal(true)}>+ Record Manual Payment</button>
            </div>
          )}

          {showPaymentModal && (
            <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 400 }}>
                <h3>Record Payment</h3>
                <div className="field">
                  <label>Amount (INR)</label>
                  <input className="glass-input" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter amount" />
                </div>
                <div className="field">
                  <label>Method</label>
                  <select className="glass-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={async () => {
                    if (!paymentAmount) return toast.error('Enter amount')
                    const amt = Number(paymentAmount)
                    await recordPayment(booking.id, { amount: amt, method: paymentMethod, type: 'advance', status: 'success' })
                    setPaymentAmount('')
                    setShowPaymentModal(false)
                    // Email receipt sent automatically by recordPayment in BookingContext
                  }}>Save Payment</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="share-view">
              <p className="text-dim">Share this link with the guest to let them view their itinerary and make payments.</p>
              <div className="link-box">
                <input className="glass-input" readOnly value={`${window.location.origin}/booking/form/${booking?.booking_token}`} />
                <button className="btn btn-primary" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/booking/form/${booking?.booking_token}`)
                  toast.success('Link copied!')
                }}>Copy Link</button>
              </div>
              {!booking?.booking_token && (
                <p style={{ color: '#ef4444', fontSize: 13, marginTop: 12 }}>
                  ⚠️ Booking token missing. Please re-save the booking or contact support.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .title-block h2 { font-size: 28px; font-weight: 800; margin-bottom: 2px; }
        .status-select { width: 160px; height: 42px; padding: 0 12px; font-weight: 700; }
        .action-edit, .action-delete { height: 42px; font-size: 13px; font-weight: 700; padding: 0 16px; }
        .action-edit { background: #F1F5F9; color: var(--text-bright); border: 1px solid var(--border-glass); }
        .action-edit:hover { background: rgba(99,102,241,0.12); border-color: var(--primary); }
        .action-delete { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
        .action-delete:hover { background: rgba(239,68,68,0.18); }

        .progress-grid { padding: 32px; display: grid; grid-template-columns: repeat(3, 1fr) 2fr; gap: 32px; margin-bottom: 32px; align-items: center; }
        .stat-pill .label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; display: block; }
        .stat-pill .val { font-size: 24px; font-weight: 800; }
        
        .progress-section { display: flex; flex-direction: column; gap: 12px; }
        .progress-meta { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; }
        .progress-track { height: 10px; background: #F1F5F9; border-radius: 5px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, var(--primary), #8b5cf6); border-radius: 5px; }

        .detail-workspace { display: grid; grid-template-columns: 280px 1fr; gap: 32px; }
        .detail-tabs { padding: 12px; height: fit-content; display: flex; flex-direction: column; gap: 6px; }
        .detail-tab { padding: 12px 16px; border: none; background: none; color: var(--text-dim); text-align: left; font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: var(--transition); }
        .detail-tab:hover { background: #F1F5F9; color: var(--text-bright); }
        .detail-tab.active { background: var(--primary); color: #fff; }

        .detail-main { padding: 32px; min-height: 400px; }
        .info-group { margin-bottom: 32px; }
        .info-group h4 { font-size: 14px; font-weight: 800; color: var(--primary); margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-item label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px; }
        .info-item span { font-size: 15px; font-weight: 600; }

        .link-box { display: flex; gap: 12px; margin-top: 20px; }
        .text-success { color: #10b981; }
        .text-warning { color: #f59e0b; }
        .badge-mini { background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }

        .icon-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border-glass); background: #F1F5F9; color: var(--text-bright); cursor: pointer; transition: var(--transition); }
        .icon-btn:hover { background: #E2E8F0; }
      `}</style>
    </div>
  )
}
