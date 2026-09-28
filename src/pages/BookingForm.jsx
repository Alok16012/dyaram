// ── PUBLIC BOOKING FORM ────────────────────────────────────
// Route: /booking/form/:token
// Customer fills their details + pays advance online
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBooking } from '../context/BookingContext'
import { openRazorpayCheckout, isRazorpayConfigured } from '../lib/razorpay'
import { sendReceiptEmail, printReceipt, isEmailConfigured } from '../lib/email'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function BookingForm() {
  const { token }   = useParams()
  const { fetchBookingByToken, updateFromPublicForm, recordPayment } = useBooking()

  const [booking, setBooking]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [step, setStep]           = useState('form')   // 'form' | 'summary' | 'paid'
  const [paying, setPaying]       = useState(false)
  const [receiptData, setReceiptData] = useState(null) // { justPaid, newPaidTotal, newBalance }

  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '', customer_whatsapp: '',
    adults: 1, children: 0, infants: 0,
    travel_date: '', return_date: '',
  })
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  useEffect(() => {
    fetchBookingByToken(token).then(b => {
      if (!b) { setNotFound(true); setLoading(false); return }
      setBooking(b)
      setForm({
        customer_name:      b.customer_name      || '',
        customer_email:     b.customer_email     || '',
        customer_phone:     b.customer_phone     || '',
        customer_whatsapp:  b.customer_whatsapp  || '',
        adults:             b.adults             || 1,
        children:           b.children           || 0,
        infants:            b.infants            || 0,
        travel_date:        b.travel_date        || '',
        return_date:        b.return_date        || '',
      })
      setLoading(false)
    })
  }, [token, fetchBookingByToken])

  const totalAmt   = booking ? Number(booking.total_amount) : 0
  const advancePct = booking ? Number(booking.advance_percent || 20) : 20
  const advanceAmt = Math.round((totalAmt * advancePct) / 100)
  const balanceAmt = totalAmt - advanceAmt

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    const updated = await updateFromPublicForm(token, {
      ...form, 
      adults: parseInt(form.adults), 
      children: parseInt(form.children), 
      infants: parseInt(form.infants)
    })
    if (updated) setBooking(updated)
    setStep('summary')
  }

  const handlePayNow = async () => {
    if (!isRazorpayConfigured) {
      toast.error('Payment system offline. Please contact us.')
      return
    }
    setPaying(true)
    try {
      const response = await openRazorpayCheckout({
        amount:  advanceAmt,
        booking: { ...booking, ...form, company_name: 'Shera Travels' },
      })
      await recordPayment(booking.id, {
        amount: advanceAmt,
        type:   'advance',
        method: 'razorpay',
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id:   response.razorpay_order_id,
      })

      // Calculate receipt data
      const prevPaid    = Number(booking.paid_amount || 0)
      const newPaidTotal = prevPaid + advanceAmt
      const newBalance   = Math.max(0, Number(booking.total_amount || 0) - newPaidTotal)
      const rd = { justPaid: advanceAmt, newPaidTotal, newBalance }
      setReceiptData(rd)

      // Update local booking state so receipt shows correct numbers
      setBooking(prev => ({ ...prev, paid_amount: newPaidTotal }))

      setStep('paid')

      // Auto-send receipt + admin notification via Hostinger SMTP
      sendReceiptEmail(
        { ...booking, paid_amount: newPaidTotal },
        advanceAmt,
        newPaidTotal,
        newBalance,
        { amount: advanceAmt, method: 'razorpay', razorpay_payment_id: response.razorpay_payment_id }
      )
        .then(() => toast.success('Receipt email sent!'))
        .catch(() => {}) // silent fail — print is always available
    } catch (err) {
      if (err.message !== 'Payment cancelled by user') toast.error(err.message)
    }
    setPaying(false)
  }

  if (loading) return <div className="public-loading"><div className="spinner" /></div>

  if (notFound) return (
    <div className="public-canvas">
       <div className="glass-card error-box">
          <h2>Link Expired</h2>
          <p>Please contact Shera Travels for a new booking link.</p>
       </div>
    </div>
  )

  const StepIndicator = ({ current }) => (
    <div className="step-bar">
       <div className={`step-dot ${step === 'form' ? 'active' : 'done'}`}>1</div>
       <div className="step-line" />
       <div className={`step-dot ${step === 'summary' ? 'active' : step === 'paid' ? 'done' : ''}`}>2</div>
       <div className="step-line" />
       <div className={`step-dot ${step === 'paid' ? 'active' : ''}`}>3</div>
    </div>
  )

  return (
    <div className="public-canvas">
      <div className="branding-top">
         <h3>✈️ Shera Travels</h3>
         <p>Personalized Booking Desk</p>
      </div>

      <StepIndicator />

      <div className="public-content-wrap">
        {step === 'form' && (
          <div className="form-scene animate-in">
             <div className="glass-card pkg-summary-card">
                <div className="pkg-info">
                   <span className="badge">Limited Offer</span>
                   <h2>{booking.packages?.title || 'Custom Tour'}</h2>
                   <div className="price-tag-big">{fmt(totalAmt)}</div>
                </div>
             </div>

             <form className="glass-card main-booking-form" onSubmit={handleFormSubmit}>
                <h3>Passenger Information</h3>
                <div className="input-row">
                   <div className="field"><label>Full Name</label><input required className="glass-input" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
                   <div className="field"><label>Email</label><input required className="glass-input" type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} /></div>
                </div>
                <div className="input-row">
                   <div className="field"><label>Phone</label><input required className="glass-input" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></div>
                   <div className="field"><label>WhatsApp</label><input className="glass-input" value={form.customer_whatsapp} onChange={e => set('customer_whatsapp', e.target.value)} /></div>
                </div>
                <div className="input-row split-3">
                   <div className="field"><label>Adults</label><input className="glass-input" type="number" min="1" value={form.adults} onChange={e => set('adults', e.target.value)} /></div>
                   <div className="field"><label>Children</label><input className="glass-input" type="number" min="0" value={form.children} onChange={e => set('children', e.target.value)} /></div>
                   <div className="field"><label>Infants</label><input className="glass-input" type="number" min="0" value={form.infants} onChange={e => set('infants', e.target.value)} /></div>
                </div>
                <button type="submit" className="btn btn-primary full-btn">Confirm Details →</button>
             </form>
          </div>
        )}

        {step === 'summary' && (
          <div className="summary-scene animate-in">
             <div className="glass-card summary-card">
                <h2>Total Summary</h2>
                <div className="summary-list">
                   <div className="sum-row"><span>Total Package Cost</span><span>{fmt(totalAmt)}</span></div>
                   <div className="sum-row highlight"><span>Advance to Pay (Now)</span><span>{fmt(advanceAmt)}</span></div>
                   <div className="sum-row"><span>Remaining Balance</span><span>{fmt(balanceAmt)}</span></div>
                </div>
                <div className="summary-actions">
                   <button className="btn btn-primary full-btn" onClick={handlePayNow} disabled={paying}>
                      {paying ? 'Processing...' : `Pay ${fmt(advanceAmt)} Now`}
                   </button>
                   <button className="btn btn-ghost" onClick={() => setStep('form')}>← Edit Details</button>
                </div>
             </div>
          </div>
        )}

        {step === 'paid' && receiptData && (
          <div className="success-scene animate-in">
             <div className="glass-card success-card">
                <div className="check-icon">✓</div>
                <h2>Payment Received!</h2>
                <div className="ref-number">{booking.booking_ref}</div>

                <div className="receipt-box">
                  <div className="receipt-row">
                    <span>Total Package</span>
                    <span>{fmt(totalAmt)}</span>
                  </div>
                  <div className="receipt-row receipt-paid-now">
                    <span>✅ Paid Now</span>
                    <strong>{fmt(receiptData.justPaid)}</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Total Paid</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(receiptData.newPaidTotal)}</span>
                  </div>
                  <div className="receipt-row receipt-balance">
                    <span>{receiptData.newBalance <= 0 ? '🎉 Fully Paid' : '⏳ Balance Due'}</span>
                    <strong>{fmt(receiptData.newBalance)}</strong>
                  </div>
                </div>

                {form.customer_email && (
                  <p style={{ fontSize: 13, opacity: 0.7, margin: '12px 0 0' }}>
                    Receipt sent to {form.customer_email}
                  </p>
                )}

                <button
                  className="btn btn-primary full-btn"
                  style={{ marginTop: 20 }}
                  onClick={() => printReceipt(booking, receiptData.justPaid, receiptData.newPaidTotal, receiptData.newBalance)}
                >
                  🖨️ Print / Download Receipt
                </button>
             </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .public-canvas {
          min-height: 100vh;
          background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=2000');
          background-size: cover;
          background-position: center;
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
        }

        .branding-top { text-align: center; margin-bottom: 40px; }
        .branding-top h3 { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }

        .step-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; }
        .step-dot { width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.4); }
        .step-dot.active { border-color: var(--primary); color: var(--primary); background: rgba(99, 102, 241, 0.1); }
        .step-dot.done { border-color: #10b981; color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .step-line { width: 40px; height: 2px; background: rgba(255,255,255,0.1); }

        .public-content-wrap { width: 100%; max-width: 600px; }
        .animate-in { animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

        .pkg-summary-card { padding: 32px; margin-bottom: 24px; text-align: center; }
        .price-tag-big { font-size: 40px; font-weight: 900; color: var(--primary); margin-top: 12px; }

        .main-booking-form { padding: 40px; }
        .main-booking-form h3 { margin-bottom: 30px; font-size: 20px; font-weight: 800; border-bottom: 1px solid var(--border-glass); padding-bottom: 12px; }

        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .input-row.split-3 { grid-template-columns: 1fr 1fr 1fr; }
        
        .field { display: flex; flex-direction: column; gap: 8px; }
        .field label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }

        .full-btn { padding: 16px; font-size: 16px; margin-top: 20px; }

        .summary-card { padding: 40px; text-align: center; }
        .summary-list { margin: 32px 0; display: flex; flex-direction: column; gap: 16px; }
        .sum-row { display: flex; justify-content: space-between; font-size: 15px; }
        .sum-row.highlight { color: #10b981; font-weight: 800; font-size: 18px; padding: 12px 0; border-top: 1px solid var(--border-glass); border-bottom: 1px solid var(--border-glass); }

        .success-card { padding: 40px; text-align: center; }
        .check-icon { width: 80px; height: 80px; background: #10b981; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 0 auto 24px; animation: pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .ref-number { background: rgba(255,255,255,0.05); padding: 10px 20px; border-radius: 12px; font-family: var(--mono); font-weight: 800; font-size: 18px; margin: 16px 0; color: var(--primary); }
        .receipt-box { background: rgba(255,255,255,0.05); border-radius: 14px; padding: 16px 20px; margin: 16px 0 0; text-align: left; display: flex; flex-direction: column; gap: 10px; }
        .receipt-row { display: flex; justify-content: space-between; font-size: 14px; color: rgba(255,255,255,0.75); }
        .receipt-paid-now { background: rgba(16,185,129,0.15); padding: 8px 12px; border-radius: 8px; font-size: 15px; color: #10b981; }
        .receipt-balance { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; font-size: 15px; color: #f59e0b; }

        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { scale: 0.5; opacity: 0; } to { scale: 1; opacity: 1; } }

        @media (max-width: 600px) {
          .input-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────
const pageStyle   = { minHeight: '100vh', background: '#F1F5F9', fontFamily: 'Inter,sans-serif', paddingBottom: 40 }
const headerStyle = { background: 'linear-gradient(135deg,#4F6EF7,#6366F1)', color: '#fff', padding: '20px 24px', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }
const cardStyle   = { background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }
const rowStyle    = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }
const labelStyle  = { color: '#64748B', fontWeight: 600 }
const valStyle    = { fontWeight: 700, color: '#0F172A', textAlign: 'right', maxWidth: '60%' }
const fieldStyle  = { display: 'flex', flexDirection: 'column', gap: 6 }
const labelStyleForm = { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }
const inputStyle  = { border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', color: '#0F172A', outline: 'none', width: '100%', boxSizing: 'border-box' }
const gridStyle   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const spinnerStyle = { width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#4F6EF7', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto', display: 'block' }
const payBtnStyle = { background: 'linear-gradient(135deg,#4F6EF7,#6366F1)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter,sans-serif', boxShadow: '0 4px 14px rgba(79,110,247,0.3)', width: '100%', transition: 'all 0.18s' }
const ghostBtnStyle = { background: 'transparent', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', width: '100%' }
const formSectionStyle = { fontSize: 11, fontWeight: 800, color: '#4F6EF7', textTransform: 'uppercase', letterSpacing: '0.8px', paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }
