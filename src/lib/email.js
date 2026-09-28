// ── Email via Vercel API → Hostinger SMTP ─────────────────
// All email sending goes through /api/send-email (server-side)
// Credentials are secure in Vercel env vars — never exposed to browser

export const isEmailConfigured = true // always available via server API

async function callEmailAPI(payload) {
  const res = await fetch('/api/send-email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  // 404 = API not available on local dev server — silently skip
  if (res.status === 404) return { skipped: true }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Email failed: ${res.status}`)
  }
  return res.json()
}

// ── Invoice Email HTML ─────────────────────────────────────
function invoiceHTML(booking, payments = []) {
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance   = Math.max(0, Number(booking.total_amount || 0) - paidTotal)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #F1F5F9; margin: 0; padding: 20px; color: #0F172A; }
    .wrap { max-width: 620px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg,#4F6EF7,#6366F1); padding: 32px; color: #fff; }
    .header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 900; }
    .header p  { margin: 0; opacity: 0.85; font-size: 14px; }
    .section   { padding: 24px 32px; border-bottom: 1px solid #E2E8F0; }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }
    .row  { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .row .label { color: #64748B; }
    .row .value { font-weight: 700; }
    .amount-box { background: #F8FAFC; border-radius: 12px; padding: 16px 20px; margin-top: 8px; }
    .amount-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
    .amount-row:last-child { border-bottom: none; padding-top: 10px; }
    .total-row { font-size: 16px; font-weight: 900; color: #4F6EF7; }
    .balance { font-size: 15px; font-weight: 800; color: #F59E0B; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; }
    .paid  { background: #D1FAE5; color: #059669; }
    .due   { background: #FEF3C7; color: #D97706; }
    .footer { background: #F8FAFC; padding: 20px 32px; text-align: center; font-size: 12px; color: #94A3B8; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>✈️ Booking Confirmed!</h1>
    <p>Booking Ref: <strong>${booking.booking_ref || '—'}</strong></p>
  </div>

  <div class="section">
    <div class="section-title">Dear ${booking.customer_name || 'Traveller'},</div>
    <p style="font-size:14px;color:#334155;line-height:1.7;margin:0">
      Your tour booking with <strong>Shera Travels</strong> has been confirmed.
      We're excited to plan your perfect trip! Below are your booking details.
    </p>
  </div>

  <div class="section">
    <div class="section-title">Trip Details</div>
    <div class="row"><span class="label">Destination</span><span class="value">${booking.destination || '—'}</span></div>
    <div class="row"><span class="label">Travel Date</span><span class="value">${booking.travel_date ? new Date(booking.travel_date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span></div>
    <div class="row"><span class="label">Return Date</span><span class="value">${booking.return_date ? new Date(booking.return_date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span></div>
    <div class="row"><span class="label">Pax</span><span class="value">${booking.adults||0} Adults${booking.children ? `, ${booking.children} Children` : ''}${booking.infants ? `, ${booking.infants} Infants` : ''}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Payment Summary</div>
    <div class="amount-box">
      <div class="amount-row"><span>Total Package Amount</span><span style="font-weight:700">${fmt(booking.total_amount)}</span></div>
      <div class="amount-row"><span>Advance Paid (${booking.advance_percent || 20}%)</span><span style="font-weight:700;color:#10B981">${fmt(booking.advance_amount)}</span></div>
      ${payments.length > 0 ? `<div class="amount-row"><span>Total Paid</span><span style="font-weight:700;color:#10B981">${fmt(paidTotal)}</span></div>` : ''}
      <div class="amount-row total-row"><span>Balance Due</span><span class="balance">${fmt(balance)}</span></div>
    </div>
    <div style="margin-top:12px;text-align:center">
      <span class="badge ${balance > 0 ? 'due' : 'paid'}">${balance > 0 ? `⏳ Balance Due: ${fmt(balance)}` : '✅ Fully Paid'}</span>
    </div>
  </div>

  <div class="footer">
    <strong>Shera Travels</strong><br/>
    ${booking.company_addr || 'Budgam, Jammu & Kashmir, India'}<br/>
    📞 ${booking.company_phone || '+91-9149406965'} &nbsp;|&nbsp; ✉ ${booking.company_email || 'sheratravels21@gmail.com'}<br/><br/>
    <em>Thank you for choosing Shera Travels. We'll be in touch soon!</em>
  </div>
</div>
</body>
</html>`
}

// ── Itinerary Email HTML ───────────────────────────────────
function itineraryHTML(booking, pkg, days = [], prices = []) {
  const dayRows = days.map((d, i) => `
    <div style="margin-bottom:18px;padding:16px;background:#F8FAFC;border-radius:10px;border-left:4px solid #4F6EF7">
      <div style="font-weight:800;color:#4F6EF7;margin-bottom:6px">Day ${i+1}: ${(d.title||'').replace(/^Day \d+:\s*/,'')}</div>
      ${d.description ? `<p style="font-size:13px;color:#334155;margin:0 0 8px;line-height:1.6">${d.description}</p>` : ''}
      ${d.accommodation ? `<div style="font-size:12px;color:#64748B">🏨 ${d.accommodation} ${'★'.repeat(d.accom_star||3)}</div>` : ''}
      ${(d.meals||[]).length ? `<div style="font-size:12px;color:#64748B;margin-top:4px">🍽 ${d.meals.join(' • ')}</div>` : ''}
    </div>`).join('')

  const priceRows = prices.map(p => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">${p.pax_type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;color:#64748B">${p.age_limit||''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:700;color:#4F6EF7">₹${Number(p.price||0).toLocaleString('en-IN')}/person</td>
    </tr>`).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>body{font-family:Inter,Arial,sans-serif;background:#F1F5F9;margin:0;padding:20px;color:#0F172A}
.wrap{max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.header{background:linear-gradient(135deg,#4F6EF7,#6366F1);padding:32px;color:#fff}
.section{padding:24px 32px;border-bottom:1px solid #E2E8F0}
.st{font-size:11px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px}
.footer{background:#F8FAFC;padding:20px 32px;text-align:center;font-size:12px;color:#94A3B8}
</style></head>
<body><div class="wrap">
  <div class="header">
    <div style="font-size:13px;opacity:.8;margin-bottom:6px">Prepared exclusively for</div>
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:900">${booking.customer_name}</h1>
    <p style="margin:0;opacity:.85;font-size:14px">${pkg?.title || 'Kashmir Tour Package'}</p>
  </div>
  <div class="section">
    <div class="st">Trip Overview</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:14px">
      <div>📍 <strong>${booking.destination||'Kashmir'}</strong></div>
      <div>🌙 <strong>${pkg?.nights||0} Nights / ${pkg?.days||0} Days</strong></div>
      <div>📅 <strong>${booking.travel_date ? new Date(booking.travel_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}</strong></div>
      <div>👤 <strong>${(booking.adults||0)+(booking.children||0)} Pax</strong></div>
    </div>
  </div>
  ${days.length ? `<div class="section"><div class="st">Day-wise Itinerary</div>${dayRows}</div>` : ''}
  ${prices.length ? `
  <div class="section">
    <div class="st">Pricing</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#F8FAFC">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748B">Pax Type</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748B">Age</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748B">Price</th>
      </tr></thead>
      <tbody>${priceRows}</tbody>
    </table>
  </div>` : ''}
  <div class="footer">
    <strong>Shera Travels</strong> | 📞 ${booking.company_phone||'+91-9149406965'}<br/>
    <em style="margin-top:6px;display:block">This itinerary has been prepared exclusively for ${booking.customer_name}. Prices are indicative and subject to availability.</em>
  </div>
</div></body></html>`
}

// ── Payment Receipt HTML (customer ke liye — ek payment ka) ──
function receiptHTML(booking, justPaid, newPaidTotal, newBalance) {
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
  const isFullyPaid = newBalance <= 0
  const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Payment Receipt — ${booking.booking_ref}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, Arial, sans-serif; background: #F1F5F9; color: #0F172A; padding: 20px; }
    .wrap { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg,#4F6EF7,#6366F1); padding: 32px; color: #fff; text-align: center; }
    .header h1 { font-size: 28px; font-weight: 900; margin-bottom: 4px; }
    .header p  { opacity: 0.85; font-size: 14px; }
    .check { width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 16px; }
    .section { padding: 24px 32px; border-bottom: 1px solid #E2E8F0; }
    .section:last-of-type { border-bottom: none; }
    .sec-title { font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .row .label { color: #64748B; }
    .row .val { font-weight: 700; }
    .amount-box { background: #F8FAFC; border-radius: 12px; padding: 16px 20px; }
    .a-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
    .a-row:last-child { border-bottom: none; padding-top: 12px; }
    .paid-now { color: #10B981; font-weight: 800; font-size: 20px; }
    .balance   { color: #F59E0B; font-weight: 800; font-size: 18px; }
    .fully-paid { color: #059669; font-weight: 800; font-size: 18px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 800; margin-top: 12px; }
    .badge-due  { background: #FEF3C7; color: #D97706; }
    .badge-paid { background: #D1FAE5; color: #059669; }
    .ref-box { background: #EEF2FF; border-radius: 10px; padding: 12px 20px; text-align: center; margin-top: 16px; }
    .ref-num { font-size: 18px; font-weight: 900; color: #4F6EF7; letter-spacing: 1px; }
    .footer { background: #F8FAFC; padding: 20px 32px; text-align: center; font-size: 12px; color: #94A3B8; }
    @media print {
      body { background: white; padding: 0; }
      .wrap { box-shadow: none; border-radius: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="check">✓</div>
    <h1>Payment Received!</h1>
    <p>${now}</p>
  </div>

  <div class="section">
    <div class="sec-title">Dear ${booking.customer_name || 'Traveller'},</div>
    <p style="font-size:14px;color:#334155;line-height:1.7">
      Thank you for your payment! Here is your receipt for the booking with <strong>Shera Travels</strong>.
    </p>
    <div class="ref-box">
      <div style="font-size:11px;font-weight:700;color:#6366F1;margin-bottom:4px">BOOKING REFERENCE</div>
      <div class="ref-num">${booking.booking_ref || '—'}</div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Trip Details</div>
    <div class="row"><span class="label">Destination</span><span class="val">${booking.destination || '—'}</span></div>
    <div class="row"><span class="label">Travel Date</span><span class="val">${booking.travel_date ? new Date(booking.travel_date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span></div>
    <div class="row"><span class="label">Passengers</span><span class="val">${booking.adults||0} Adults${booking.children ? `, ${booking.children} Children` : ''}${booking.infants ? `, ${booking.infants} Infants` : ''}</span></div>
  </div>

  <div class="section">
    <div class="sec-title">Payment Summary</div>
    <div class="amount-box">
      <div class="a-row"><span>Total Package Amount</span><span style="font-weight:700">${fmt(booking.total_amount)}</span></div>
      <div class="a-row" style="background:#F0FDF4;margin:0 -4px;padding:8px 4px;border-radius:6px">
        <span style="font-weight:700">✅ Amount Paid (This Payment)</span>
        <span class="paid-now">${fmt(justPaid)}</span>
      </div>
      <div class="a-row"><span>Total Paid So Far</span><span style="font-weight:700;color:#10B981">${fmt(newPaidTotal)}</span></div>
      <div class="a-row">
        <span style="font-weight:800">${isFullyPaid ? '🎉 Fully Paid' : '⏳ Balance Remaining'}</span>
        <span class="${isFullyPaid ? 'fully-paid' : 'balance'}">${fmt(newBalance)}</span>
      </div>
    </div>
    <div style="text-align:center">
      <span class="badge ${isFullyPaid ? 'badge-paid' : 'badge-due'}">
        ${isFullyPaid ? '✅ Trip Fully Confirmed!' : `⏳ Balance Due at Check-in: ${fmt(newBalance)}`}
      </span>
    </div>
  </div>

  <div class="footer">
    <strong>Shera Travels</strong><br/>
    ${booking.company_addr || 'Radio Colony, Srinagar, Lawaypora, Srinagar, J&K 190017'}<br/>
    📞 ${booking.company_phone || '+91-9149406965'} &nbsp;|&nbsp; ✉ ${booking.company_email || 'sheratravels21@gmail.com'}<br/><br/>
    <em>Please save this receipt for your records. Thank you for choosing Shera Travels! ✈️</em>
  </div>
</div>
</body>
</html>`
}

// ── Print Invoice in new window ────────────────────────────
export function printInvoice(booking, payments = []) {
  const html = invoiceHTML(booking, payments)
  const win = window.open('', '_blank', 'width=700,height=900')
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 500)
}

// ── Print Receipt in new window ───────────────────────────
export function printReceipt(booking, justPaid, newPaidTotal, newBalance) {
  const html = receiptHTML(booking, justPaid, newPaidTotal, newBalance)
  const win = window.open('', '_blank', 'width=700,height=900')
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 500)
}

// ── Public API ─────────────────────────────────────────────
// ── Send receipt + admin/owner notifications (one API call) ──
export async function sendReceiptEmail(booking, justPaid, newPaidTotal, newBalance, payment = null) {
  return callEmailAPI({
    type:       'payment',
    booking,
    payment:    payment || { amount: justPaid },
    justPaid,
    newPaidTotal,
    newBalance,
  })
}

// ── Send full invoice to customer + admin notification ────
export async function sendInvoiceEmail(booking, payments = []) {
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance   = Math.max(0, Number(booking.total_amount || 0) - paidTotal)
  return callEmailAPI({
    type:        'invoice',
    booking,
    justPaid:    paidTotal,
    newPaidTotal: paidTotal,
    newBalance:  balance,
  })
}

// ── New booking notification (no payment yet) ──────────────
export async function sendNewBookingEmail(booking) {
  return callEmailAPI({
    type:    'new_booking',
    booking,
    justPaid: 0,
    newPaidTotal: 0,
    newBalance: Number(booking.total_amount || 0),
  })
}

export async function sendItineraryEmail(booking, pkg, days = [], prices = []) {
  if (!booking.customer_email) throw new Error('Customer email nahi hai.')
  return sendEmail({
    to:      booking.customer_email,
    subject: `Your Personalised Itinerary — ${booking.destination || 'Kashmir'} | Shera Travels`,
    html:    itineraryHTML(booking, pkg, days, prices),
  })
}

// ── WhatsApp wa.me link ────────────────────────────────────
export function buildWhatsAppLink(phone, message) {
  const num = (phone || '').replace(/\D/g, '')
  if (!num) return null
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`
}

export function bookingConfirmationWA(booking) {
  const msg = `Hi ${booking.customer_name}! 🙏

*Booking Confirmed — Shera Travels*
📋 Ref: *${booking.booking_ref}*
📍 Destination: *${booking.destination || 'Kashmir'}*
📅 Travel Date: *${booking.travel_date ? new Date(booking.travel_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}*
👥 Pax: *${(booking.adults||0)+(booking.children||0)+(booking.infants||0)} persons*

💰 *Amount Summary*
Total: ₹${Number(booking.total_amount||0).toLocaleString('en-IN')}
Advance Paid: ₹${Number(booking.advance_amount||0).toLocaleString('en-IN')}
Balance Due: ₹${Number(booking.balance_amount||0).toLocaleString('en-IN')}

Your detailed itinerary has been sent to your email. 📧

For any queries, call/WhatsApp us anytime!
*Shera Travels* | ${booking.company_phone || '+91-9149406965'}
_Let's Travel The World_ ✈️`

  return buildWhatsAppLink(booking.customer_whatsapp || booking.customer_phone, msg)
}

export function paymentReminderWA(booking) {
  const balance = Math.max(0, Number(booking.total_amount||0) - Number(booking.paid_amount||0))
  const msg = `Hi ${booking.customer_name}! 👋

*Balance Payment Reminder — Shera Travels*
📋 Booking Ref: *${booking.booking_ref}*
📍 Trip: *${booking.destination || 'Kashmir'}*

💰 Balance Due: *₹${balance.toLocaleString('en-IN')}*

Kindly complete your payment before the travel date to confirm your bookings. 🙏

Thank you for choosing Shera Travels!
*${booking.company_phone || '+91-9149406965'}*`

  return buildWhatsAppLink(booking.customer_whatsapp || booking.customer_phone, msg)
}
