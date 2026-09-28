import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { X, Download, Receipt } from 'lucide-react'
import { BRAND } from '../lib/brand'
import { amountInWords } from '../lib/ui'
// Reference public/ asset by URL instead of importing (avoids base64-inlining
// the logo into this chunk).
const logoUrl = BRAND.logo

// Company details printed on invoices/receipts. Settings → Company Profile
// (localStorage "company_defaults") overrides the brand defaults.
function companyInfo() {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem('company_defaults') || '{}') } catch { saved = {} }
  return {
    name: (saved.name || BRAND.legalName).toUpperCase(),
    phone: saved.phone || BRAND.phone,
    email: saved.email || BRAND.email,
    website: BRAND.website.replace(/^https?:\/\//, ''),
    address: saved.addr || BRAND.address,
    gst: saved.gst || BRAND.gst,
    state: BRAND.state,
  }
}

const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh',
}

const ITEM_PRESETS = ['Umrah Package', 'Hajj Package', 'Air Ticket', 'Umrah Visa', 'Hotel Accommodation', 'Ziyarat / Transport']

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Card', 'Cheque']

function newItem(description = '') {
  return { id: crypto.randomUUID(), description, details: '', passport: '', hsn: '', qty: 1, rate: '', discount: '', cgst: '', sgst: '', igst: '' }
}

function newPayment() {
  return { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), amount: '', mode: 'UPI', reference: '' }
}

function computeItem(item) {
  const qty = Number(item.qty) || 0
  const rate = Number(item.rate) || 0
  const discount = Number(item.discount) || 0
  const gross = qty * rate
  const taxable = Math.max(0, gross - discount)
  const cgstAmt = taxable * (Number(item.cgst) || 0) / 100
  const sgstAmt = taxable * (Number(item.sgst) || 0) / 100
  const igstAmt = taxable * (Number(item.igst) || 0) / 100
  return { gross, taxable, cgstAmt, sgstAmt, igstAmt, total: taxable + cgstAmt + sgstAmt + igstAmt }
}

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function InvoiceGenerator() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('unpaid')
  const [notes, setNotes] = useState('Thanks for doing business with us')
  const [invoiceTitle, setInvoiceTitle] = useState('Hajj Umrah Package Booking')
  const [bookingRefNo, setBookingRefNo] = useState('')
  const company = companyInfo()

  const [client, setClient] = useState({ name: '', gstin: '', phone: '', address: '', stateCode: '' })
  const [items, setItems] = useState([newItem('Umrah Package')])
  const [payments, setPayments] = useState([])
  const [draftPayment, setDraftPayment] = useState(newPayment())
  const [receipt, setReceipt] = useState(null) // payment currently being printed as a receipt

  useEffect(() => {
    if (!id) {
      // Sequential numeric invoice numbers (e.g. 163), continuing from the highest so far.
      supabase.from('invoices').select('invoice_number').then(({ data }) => {
        const max = (data || []).reduce((m, r) => Math.max(m, Number(String(r.invoice_number || '').replace(/\D/g, '').slice(-6)) || 0), 0)
        setInvoiceNumber(String(max + 1))
      })
      return
    }
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
      if (error || !data) {
        toast.error('Invoice not found')
        navigate('/invoices')
        return
      }
      setInvoiceNumber(data.invoice_number || '')
      setIssueDate(data.issue_date || new Date().toISOString().slice(0, 10))
      setDueDate(data.due_date || '')
      setStatus(data.status || 'unpaid')
      setNotes(data.notes || '')
      setInvoiceTitle(data.invoice_title || 'Hajj Umrah Package Booking')
      setBookingRefNo(data.booking_ref || '')
      setClient({
        name: data.client_name || '',
        gstin: data.client_gstin || '',
        phone: data.client_phone || '',
        address: data.client_address || '',
        stateCode: data.client_state_code || '',
      })
      setItems(Array.isArray(data.items) && data.items.length ? data.items : [newItem()])
      setPayments(Array.isArray(data.payments) ? data.payments : [])
      setLoading(false)
    }
    load()
  }, [id, navigate])

  const handleGstinChange = (value) => {
    const upper = value.toUpperCase()
    const code = upper.slice(0, 2)
    setClient(c => ({ ...c, gstin: upper, stateCode: GST_STATE_CODES[code] ? code : c.stateCode }))
  }

  const updateItem = (itemId, changes) => {
    setItems(list => list.map(it => it.id === itemId ? { ...it, ...changes } : it))
  }
  const removeItem = (itemId) => setItems(list => list.filter(it => it.id !== itemId))
  const addItem = (description = '') => setItems(list => [...list, newItem(description)])

  const computed = items.map(it => ({ ...it, ...computeItem(it) }))
  const subtotal = computed.reduce((s, it) => s + it.taxable, 0)
  const grossTotal = computed.reduce((s, it) => s + it.gross, 0)
  const discountTotal = computed.reduce((s, it) => s + (Number(it.discount) || 0), 0)
  const taxAmount = computed.reduce((s, it) => s + it.cgstAmt + it.sgstAmt + it.igstAmt, 0)
  const grandTotal = subtotal + taxAmount
  const hasTax = taxAmount > 0
  const pct = (part, whole) => `${whole ? +((Number(part) / whole) * 100).toFixed(3) : 0}%`
  const fmtD = (d, sep = '-') => {
    if (!d) return '—'
    const x = new Date(d)
    return [String(x.getDate()).padStart(2, '0'), String(x.getMonth() + 1).padStart(2, '0'), x.getFullYear()].join(sep)
  }

  // ── Payments / balance ──────────────────────────────────────────────
  const amountPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balanceDue = Math.max(0, grandTotal - amountPaid)
  // Effective status is driven by payments once any money is recorded:
  // fully covered → paid, some received → partial, otherwise the manual pick.
  const effectiveStatus = amountPaid > 0
    ? (balanceDue <= 0 ? 'paid' : 'partial')
    : status

  const addPayment = () => {
    const amt = Number(draftPayment.amount) || 0
    if (amt <= 0) { toast.error('Enter a payment amount'); return }
    setPayments(list => [...list, { ...draftPayment, amount: amt }])
    setDraftPayment(newPayment())
  }
  const removePayment = (pid) => setPayments(list => list.filter(p => p.id !== pid))
  const lastPaymentDate = payments.reduce((d, p) => (!d || (p.date && p.date > d) ? p.date : d), '')

  const downloadReceipt = async (payment) => {
    setReceipt(payment)
    // Let the hidden receipt template render before capturing it.
    await new Promise(r => setTimeout(r, 80))
    const genToastId = toast.loading('Generating receipt...')
    try {
      const el = document.getElementById('receipt-preview')
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, logging: false, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const imgH = (canvas.height * pageW) / canvas.width
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, imgH)
      pdf.save(`Receipt - ${invoiceNumber || 'INV'} - ${client.name}.pdf`)
      toast.dismiss(genToastId)
      toast.success('Receipt downloaded!')
    } catch (err) {
      toast.dismiss(genToastId)
      toast.error('Could not generate receipt. Try again.')
      console.error('Receipt generation error:', err)
    } finally {
      setReceipt(null)
    }
  }

  const saveAndDownload = async () => {
    if (!client.name.trim()) {
      toast.error('Client / company name is required')
      return
    }
    setSaving(true)
    const toastId = toast.loading('Saving invoice...')
    try {
      const payload = {
        invoice_number: invoiceNumber,
        client_name: client.name.trim(),
        client_gstin: client.gstin || null,
        client_phone: client.phone || null,
        client_address: client.address || null,
        client_state_code: client.stateCode || null,
        issue_date: issueDate || null,
        due_date: dueDate || null,
        status: effectiveStatus,
        notes,
        invoice_title: invoiceTitle,
        booking_ref: bookingRefNo || null,
        items,
        payments,
        amount_paid: amountPaid,
        subtotal,
        tax_amount: taxAmount,
        amount: grandTotal,
      }
      if (id) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('invoices').insert([payload]).select().single()
        if (error) throw error
        navigate(`/invoices/${data.id}/edit`, { replace: true })
      }
      toast.dismiss(toastId)
      toast.success('Invoice saved')
    } catch (err) {
      toast.dismiss(toastId)
      toast.error(`Save failed: ${err.message || 'check RLS/schema'}`)
      console.error('Save invoice error:', err)
      setSaving(false)
      return
    }

    const genToastId = toast.loading('Generating PDF...')
    try {
      const el = document.getElementById('invoice-preview')
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, logging: false, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const imgW = pageW
      const imgH = (canvas.height * pageW) / canvas.width
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgW, imgH)
      pdf.save(`${invoiceNumber || 'Invoice'} - ${client.name}.pdf`)
      toast.dismiss(genToastId)
      toast.success('PDF downloaded!')
    } catch (err) {
      toast.dismiss(genToastId)
      toast.error('Could not generate PDF. Try Print → Save as PDF instead.')
      console.error('PDF generation error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="spinner" /></div>
  }

  return (
    <div className="invoice-gen">
      <div className="ig-header">
        <div>
          <Link to="/invoices" className="ig-back">← Back to Invoices</Link>
          <h1 className="text-gradient">Invoice Generator</h1>
        </div>
        <button className="btn btn-primary" onClick={saveAndDownload} disabled={saving}>
          {saving ? 'Working...' : <><Download size={16} /> Save &amp; Download PDF</>}
        </button>
      </div>

      <div className="ig-grid">
        {/* ── EDIT PANEL ───────────────────────────────── */}
        <div className="ig-edit">
          <div className="glass-card ig-card">
            <h3>Bill To</h3>
            <div className="form-field">
              <label>Client / Company Name</label>
              <input className="glass-input" value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} placeholder="Traveler / Company Name" />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Client GSTIN</label>
                <input className="glass-input" value={client.gstin} onChange={e => handleGstinChange(e.target.value)} placeholder="Auto-fills state" />
              </div>
              <div className="form-field">
                <label>State</label>
                <input className="glass-input" value={GST_STATE_CODES[client.stateCode] || ''} readOnly placeholder="From GSTIN" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Phone</label>
                <input className="glass-input" value={client.phone} onChange={e => setClient(c => ({ ...c, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div className="form-field">
                <label>Address</label>
                <input className="glass-input" value={client.address} onChange={e => setClient(c => ({ ...c, address: e.target.value }))} placeholder="City, State" />
              </div>
            </div>
          </div>

          <div className="glass-card ig-card">
            <h3>Invoice Details</h3>
            <div className="form-row">
              <div className="form-field">
                <label>Invoice No.</label>
                <input className="glass-input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Status</label>
                <select className="glass-input" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
            <div className="form-field">
              <label>Invoice title</label>
              <input className="glass-input" value={invoiceTitle} onChange={e => setInvoiceTitle(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Booking Reference No.</label>
              <input className="glass-input" value={bookingRefNo} onChange={e => setBookingRefNo(e.target.value.toUpperCase())} placeholder="e.g. DH-EU-OCT2026-00163" />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Issue Date</label>
                <input className="glass-input" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Due Date</label>
                <input className="glass-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="glass-card ig-card">
            <div className="ig-items-head">
              <h3>Line Items</h3>
              <div className="ig-presets">
                {ITEM_PRESETS.map(p => (
                  <button key={p} className="btn btn-ghost ig-preset-btn" onClick={() => addItem(p)}>+ {p}</button>
                ))}
              </div>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} className="ig-item-row">
                <div className="ig-item-row-head">
                  <span className="ig-item-num">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <button className="ig-item-remove" onClick={() => removeItem(item.id)}><X size={13} /> Remove</button>
                  )}
                </div>
                <div className="form-field">
                  <label>Service name</label>
                  <input className="glass-input" value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} placeholder="e.g. 15 Days Economy Umrah Package OCT 2026" />
                </div>
                <div className="form-field">
                  <label>Package includes</label>
                  <textarea className="glass-input" rows={2} value={item.details || ''} onChange={e => updateItem(item.id, { details: e.target.value })} placeholder="Return Air Ticket | Umrah Visa with Insurance | Accommodation ..." />
                </div>
                <div className="form-field">
                  <label>Passport No.</label>
                  <input className="glass-input" value={item.passport || ''} onChange={e => updateItem(item.id, { passport: e.target.value.toUpperCase() })} placeholder="e.g. T2089132" />
                </div>
                <div className="ig-item-grid">
                  <div className="form-field">
                    <label>HSN/SAC</label>
                    <input className="glass-input" value={item.hsn} onChange={e => updateItem(item.id, { hsn: e.target.value })} placeholder="998552" />
                  </div>
                  <div className="form-field">
                    <label>Qty</label>
                    <input className="glass-input" type="number" value={item.qty} onChange={e => updateItem(item.id, { qty: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Rate (₹)</label>
                    <input className="glass-input" type="number" value={item.rate} onChange={e => updateItem(item.id, { rate: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Discount (₹)</label>
                    <input className="glass-input" type="number" value={item.discount} onChange={e => updateItem(item.id, { discount: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>CGST %</label>
                    <input className="glass-input" type="number" value={item.cgst} onChange={e => updateItem(item.id, { cgst: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>SGST %</label>
                    <input className="glass-input" type="number" value={item.sgst} onChange={e => updateItem(item.id, { sgst: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>IGST %</label>
                    <input className="glass-input" type="number" value={item.igst} onChange={e => updateItem(item.id, { igst: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => addItem()}>+ Add Line Item</button>
          </div>

          <div className="glass-card ig-card">
            <h3>Payments Received</h3>

            <div className="pay-summary">
              <div className="pay-summary-cell">
                <span>Grand Total</span>
                <strong>{fmt(grandTotal)}</strong>
              </div>
              <div className="pay-summary-cell">
                <span>Paid</span>
                <strong style={{ color: '#059669' }}>{fmt(amountPaid)}</strong>
              </div>
              <div className="pay-summary-cell">
                <span>Balance Due</span>
                <strong style={{ color: balanceDue > 0 ? '#B45309' : '#059669' }}>{fmt(balanceDue)}</strong>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="pay-list">
                {payments.map((p) => (
                  <div key={p.id} className="pay-row">
                    <div className="pay-row-main">
                      <span className="pay-amt">{fmt(p.amount)}</span>
                      <span className="pay-meta">
                        {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                        {' · '}{p.mode}{p.reference ? ` · ${p.reference}` : ''}
                      </span>
                    </div>
                    <div className="pay-row-actions">
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => downloadReceipt(p)} title="Download receipt"><Receipt size={13} /> Receipt</button>
                      <button className="pay-remove" onClick={() => removePayment(p.id)} title="Remove"><X size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pay-add">
              <div className="ig-item-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 0 }}>
                <div className="form-field">
                  <label>Amount (₹)</label>
                  <input className="glass-input" type="number" value={draftPayment.amount} onChange={e => setDraftPayment(d => ({ ...d, amount: e.target.value }))} placeholder="e.g. 99900" />
                </div>
                <div className="form-field">
                  <label>Date</label>
                  <input className="glass-input" type="date" value={draftPayment.date} onChange={e => setDraftPayment(d => ({ ...d, date: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Mode</label>
                  <select className="glass-input" value={draftPayment.mode} onChange={e => setDraftPayment(d => ({ ...d, mode: e.target.value }))}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Reference / Note</label>
                  <input className="glass-input" value={draftPayment.reference} onChange={e => setDraftPayment(d => ({ ...d, reference: e.target.value }))} placeholder="e.g. IndusInd UPI T2609232259..." />
                </div>
              </div>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={addPayment}>+ Record Payment</button>
            </div>
          </div>

          <div className="glass-card ig-card">
            <h3>Notes</h3>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Standard terms and bank details are printed automatically.</p>
            <textarea className="glass-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra note for this invoice" />
          </div>
        </div>

        {/* ── PREVIEW PANEL ───────────────────────────────── */}
        <div className="ig-preview-wrap">
          <div id="invoice-preview" className="ig-preview">
            <div className="ig-pv-header">
              <div className="ig-pv-company">
                <h1>{company.name}</h1>
                <p>{company.address}</p>
                <p>Phone no. : {company.phone}</p>
                <p>Email : {company.email}{company.website ? ` · Web ${company.website}` : ''}</p>
                {company.gst && <p>GSTIN : {company.gst}</p>}
                <p>State: {company.state}</p>
              </div>
              <img src={logoUrl} alt={BRAND.legalName} className="ig-pv-logo" />
            </div>

            <h2 className="ig-pv-title">{invoiceTitle || 'Tax Invoice'}</h2>

            <div className="ig-pv-parties">
              <div>
                <div className="ig-pv-label">Bill To</div>
                <div className="ig-pv-bill-name">{client.name || 'Client Name'}</div>
                {client.address && <div>{client.address}</div>}
                {client.phone && <div>Ph: {client.phone}</div>}
                {client.gstin && <div>GSTIN: {client.gstin}{GST_STATE_CODES[client.stateCode] ? ` (${GST_STATE_CODES[client.stateCode]})` : ''}</div>}
              </div>
              <div className="ig-pv-details">
                <div className="ig-pv-label">Invoice Details</div>
                <div>Invoice No. : {invoiceNumber || '—'}</div>
                <div>Date : {fmtD(issueDate)}</div>
                {bookingRefNo && <div>Booking Reference No.: {bookingRefNo}</div>}
                {lastPaymentDate && <div>Payment Date: {fmtD(lastPaymentDate, '/')}</div>}
                {dueDate && <div>Due Date : {fmtD(dueDate)}</div>}
              </div>
            </div>

            <table className="ig-pv-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Service Name &amp; Description</th>
                  <th>Passport No</th>
                  <th className="num">Quantity</th>
                  <th className="num">Price/ Unit</th>
                  <th className="num">Discount</th>
                  {hasTax && <th className="num">GST</th>}
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {computed.map((it, i) => (
                  <tr key={it.id}>
                    <td>{i + 1}</td>
                    <td className="ig-pv-desc">
                      <strong>{it.description || '—'}</strong>
                      {it.details && <span>({it.details})</span>}
                      {it.hsn && <span>HSN/SAC: {it.hsn}</span>}
                    </td>
                    <td>{it.passport || '—'}</td>
                    <td className="num">{it.qty || 0}</td>
                    <td className="num">{fmt(it.rate)}</td>
                    <td className="num">
                      {Number(it.discount) ? <>{fmt(it.discount)}<br /><small>({pct(it.discount, it.gross)})</small></> : '—'}
                    </td>
                    {hasTax && <td className="num">{fmt(it.cgstAmt + it.sgstAmt + it.igstAmt)}</td>}
                    <td className="num">{fmt(it.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td>Total</td>
                  <td /><td /><td />
                  <td className="num">{fmt(discountTotal)}</td>
                  {hasTax && <td className="num">{fmt(taxAmount)}</td>}
                  <td className="num">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="ig-pv-bottom">
              <div className="ig-pv-left">
                <div className="ig-pv-label">Invoice Amount In Words</div>
                <p>{amountInWords(grandTotal)}</p>
                <div className="ig-pv-label" style={{ marginTop: 14 }}>Terms and Conditions</div>
                <ol>
                  {BRAND.invoiceTerms.map(t => <li key={t}>{t}</li>)}
                </ol>
                {notes && <p className="ig-pv-note">{notes}</p>}
              </div>
              <div className="ig-pv-summary">
                <div className="row"><span>Sub Total</span><span>{fmt(grossTotal)}</span></div>
                {discountTotal > 0 && <div className="row"><span>Discount</span><span>{fmt(discountTotal)}</span></div>}
                {hasTax && <div className="row"><span>GST</span><span>{fmt(taxAmount)}</span></div>}
                <div className="row total"><span>Total</span><span>{fmt(grandTotal)}</span></div>
                <div className="row"><span>Received</span><span>{fmt(amountPaid)}</span></div>
                <div className="row"><span>Balance</span><span>{fmt(balanceDue)}</span></div>
                {payments.length > 0 && (
                  <div className="row mode"><span>Payment mode</span><span>{payments.map(p => `${p.mode}${p.reference ? ` (${p.reference})` : ''}`).join(', ')}</span></div>
                )}
                {discountTotal > 0 && <div className="row saved"><span>You Saved</span><span>{fmt(discountTotal)}</span></div>}
              </div>
            </div>

            <div className="ig-pv-foot">
              <div className="ig-pv-bank">
                <div className="ig-pv-label">Pay To:</div>
                <div>Bank Name : {BRAND.bank.name}</div>
                <div>Bank Account No. : {BRAND.bank.account}</div>
                <div>Bank IFSC code : {BRAND.bank.ifsc}</div>
                <div>Account holder's name : {BRAND.bank.holder.toUpperCase()}</div>
              </div>
              <div className="ig-pv-sign">
                <div>For : {company.name}</div>
                <div className="ig-pv-sign-space" />
                <strong>Authorized Signatory</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hidden receipt template (rendered only while generating a PDF) ── */}
      {receipt && (
        <div style={{ position: 'fixed', left: -99999, top: 0, width: 794 }}>
          <div id="receipt-preview" className="rc-preview">
            <div className="rc-header">
              <div className="ig-pv-company">
                <h1>{company.name}</h1>
                <p>{company.address}</p>
                <p>Phone no. : {company.phone} · Email : {company.email}</p>
                {company.gst && <p>GSTIN : {company.gst} · State: {company.state}</p>}
              </div>
              <img src={logoUrl} alt={BRAND.legalName} className="ig-pv-logo" />
            </div>
            <h2 className="ig-pv-title">Payment Receipt</h2>

            <div className="rc-meta">
              <div>
                <p><span>Receipt No:</span> <strong>RCPT-{invoiceNumber || '—'}</strong></p>
                {bookingRefNo && <p><span>Booking Ref:</span> <strong>{bookingRefNo}</strong></p>}
                <p><span>Against Invoice:</span> <strong>{invoiceNumber || '—'}</strong></p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p><span>Date:</span> <strong>{receipt.date ? new Date(receipt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</strong></p>
                <p><span>Mode:</span> <strong>{receipt.mode}</strong></p>
              </div>
            </div>

            <div className="rc-body">
              <p>Received with thanks from <strong>{client.name || 'Client'}</strong></p>
              <div className="rc-amount-box">
                <span>Amount Received</span>
                <strong>{fmt(receipt.amount)}</strong>
              </div>
              {receipt.reference && <p className="rc-ref">Reference: {receipt.reference}</p>}
            </div>

            <div className="rc-summary">
              <div className="rc-summary-row"><span>Invoice Total</span><span>{fmt(grandTotal)}</span></div>
              <div className="rc-summary-row"><span>Total Paid to Date</span><span>{fmt(amountPaid)}</span></div>
              <div className="rc-summary-row rc-summary-bal"><span>Balance Due</span><span>{fmt(balanceDue)}</span></div>
            </div>

            <div className="rc-sign">
              <div className="rc-sign-line">
                <div className="rc-sign-rule" />
                <span>For {company.name}<br /><strong>Authorized Signatory</strong></span>
              </div>
            </div>

            <div className="rc-footer">
              <p className="rc-footer-strong">{company.name}</p>
              <p>{company.phone} · {company.email}{company.website ? ` · ${company.website}` : ''}</p>
              <p>This is a system-generated payment receipt.</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ig-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 20px;
          gap: 16px;
        }
        .ig-back { font-size: 12.5px; font-weight: 700; color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 6px; }
        .ig-back:hover { color: var(--primary); }
        .ig-header h1 { font-size: 26px; font-weight: 800; }

        .ig-grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 20px;
          align-items: start;
        }

        .ig-edit { display: flex; flex-direction: column; gap: 16px; }
        .ig-card { padding: 20px; }
        .ig-card h3 { font-size: 14px; font-weight: 800; margin-bottom: 14px; }
        .ig-card .form-field { margin-bottom: 12px; }
        .ig-card .form-field:last-child { margin-bottom: 0; }
        .ig-card .form-row { margin-bottom: 12px; }
        .ig-card textarea.glass-input { resize: vertical; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }

        .ig-items-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
        .ig-items-head h3 { margin-bottom: 0; }
        .ig-presets { display: flex; flex-wrap: wrap; gap: 6px; }
        .ig-preset-btn { font-size: 11px; padding: 5px 10px; }

        .ig-item-row {
          border: 1px solid var(--border-glass);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 12px;
          background: #F8FAFC;
        }
        .ig-item-row-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .ig-item-num { font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .ig-item-remove { border: none; background: none; color: #ef4444; font-size: 11px; font-weight: 700; cursor: pointer; }
        .ig-item-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }

        /* ── Payments card ── */
        .pay-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }
        .pay-summary-cell {
          background: #F8FAFC;
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pay-summary-cell span { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
        .pay-summary-cell strong { font-size: 15px; font-weight: 800; }

        .pay-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
        .pay-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .pay-row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pay-amt { font-size: 14px; font-weight: 800; color: #059669; }
        .pay-meta { font-size: 11px; color: var(--text-muted); }
        .pay-row-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .pay-remove { border: none; background: none; color: #ef4444; font-size: 14px; font-weight: 700; cursor: pointer; padding: 4px 6px; }
        .pay-add { border-top: 1px dashed var(--border-glass); padding-top: 14px; }

        /* ── Receipt template (off-screen, captured to PDF) ── */
        .rc-preview {
          background: #fff;
          padding: 36px;
          color: #1a1a1a;
          font-family: inherit;
          width: 794px;
        }
        .rc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 20px;
          border-bottom: 2px solid #E2E8F0;
          margin-bottom: 24px;
        }

        .rc-brand h1 { font-size: 24px; font-weight: 900; color: #0D2A7D; text-transform: uppercase; letter-spacing: 0.4px; }
        .rc-tagline { font-size: 12px; font-style: italic; color: #64748B; margin-top: 2px; }
        .rc-badge {
          background: #059669;
          color: #fff;
          font-weight: 800;
          font-size: 14px;
          padding: 12px 24px;
          border-radius: 8px;
          letter-spacing: 1.2px;
          white-space: nowrap;
        }
        .rc-meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12.5px; color: #475569; line-height: 1.9; }
        .rc-meta p { margin: 0; }
        .rc-meta span { color: #94A3B8; margin-right: 6px; }
        .rc-meta strong { color: #1a1a1a; }
        .rc-body { margin-bottom: 24px; font-size: 14px; }
        .rc-amount-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #EEF2FB;
          border: 1px solid #C3CEEC;
          border-radius: 10px;
          padding: 16px 20px;
          margin: 12px 0;
        }
        .rc-amount-box span { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0D2A7D; }
        .rc-amount-box strong { font-size: 26px; font-weight: 800; color: #0D2A7D; }
        .rc-ref { font-size: 12.5px; color: #475569; }
        .rc-summary { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-bottom: 40px; }
        .rc-summary-row { display: flex; justify-content: space-between; gap: 40px; width: 280px; font-size: 13px; }
        .rc-summary-bal { font-weight: 800; font-size: 15px; border-top: 2px solid #0F172A; padding-top: 8px; margin-top: 4px; color: #B45309; }
        .rc-sign { display: flex; justify-content: flex-end; margin-bottom: 32px; }
        .rc-sign-line { text-align: center; }
        .rc-sign-rule { width: 180px; border-top: 1px solid #94A3B8; margin-bottom: 6px; }
        .rc-sign-line span { font-size: 12px; color: #64748B; }
        .rc-footer { padding-top: 14px; text-align: center; border-top: 1px solid #E2E8F0; font-size: 10.5px; color: #94A3B8; line-height: 1.8; }
        .rc-footer-strong { font-weight: 700; color: #1a1a1a; font-size: 11px; }

        .ig-preview-wrap { position: sticky; top: calc(var(--header-h) + 16px); }
        .ig-preview {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          padding: 34px 36px;
          color: #111;
          display: flex;
          flex-direction: column;
          min-height: 1050px;
          font-size: 12px;
          line-height: 1.5;
        }
        .ig-pv-header, .rc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding-bottom: 12px;
          border-bottom: 2px solid #0D2A7D;
          margin-bottom: 14px;
        }
        .ig-pv-company h1 { font-size: 17px; font-weight: 700; letter-spacing: 0.2px; color: #111; margin-bottom: 4px; max-width: 360px; line-height: 1.3; }
        .ig-pv-company p { margin: 0; font-size: 11.5px; color: #222; max-width: 380px; }
        .ig-pv-logo { width: 210px; height: auto; object-fit: contain; flex-shrink: 0; }
        .ig-pv-title { text-align: center; font-size: 20px; font-weight: 700; color: #0D2A7D; margin: 4px 0 16px; }
        .ig-pv-parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 12px; font-size: 12px; }
        .ig-pv-details { text-align: right; }
        .ig-pv-label { font-size: 12px; font-weight: 700; color: #111; margin-bottom: 4px; }
        .ig-pv-bill-name { font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }

        .ig-pv-table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 18px; }
        .ig-pv-table th {
          background: #0D2A7D;
          color: #fff;
          text-align: left;
          padding: 8px 8px;
          font-weight: 600;
          vertical-align: middle;
        }
        .ig-pv-table td { padding: 10px 8px; border-bottom: 1px solid #CBD5E1; vertical-align: middle; }
        .ig-pv-table .num { text-align: right; white-space: nowrap; }
        .ig-pv-table small { font-size: 10.5px; color: #333; }
        .ig-pv-desc { min-width: 170px; max-width: 220px; }
        .ig-pv-desc strong { display: block; font-size: 12.5px; margin-bottom: 2px; }
        .ig-pv-desc span { display: block; font-size: 10.5px; color: #222; line-height: 1.35; }
        .ig-pv-table tfoot td { font-weight: 700; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 8px; }

        .ig-pv-bottom { display: grid; grid-template-columns: 1fr 300px; gap: 28px; margin-bottom: 22px; }
        .ig-pv-left p { margin: 0 0 4px; }
        .ig-pv-left ol { padding-left: 16px; margin: 0; }
        .ig-pv-left li { margin-bottom: 3px; }
        .ig-pv-note { margin-top: 8px !important; }
        .ig-pv-summary .row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 8px; font-size: 12px; }
        .ig-pv-summary .row span:last-child { text-align: right; }
        .ig-pv-summary .row.total { background: #0D2A7D; color: #fff; font-weight: 700; }
        .ig-pv-summary .row.mode span:last-child { font-size: 11px; max-width: 190px; }
        .ig-pv-summary .row.saved { border-top: 1px solid #111; margin-top: 6px; padding-top: 10px; }

        .ig-pv-foot { display: flex; justify-content: space-between; gap: 24px; margin-top: auto; padding-top: 18px; font-size: 12px; }
        .ig-pv-bank div { margin-bottom: 3px; }
        .ig-pv-sign { text-align: center; min-width: 260px; display: flex; flex-direction: column; align-items: center; }
        .ig-pv-sign-space { height: 56px; width: 200px; border-bottom: 1px solid #94A3B8; margin: 8px 0 6px; }

        @media (max-width: 1100px) {
          .ig-grid { grid-template-columns: 1fr; }
          .ig-preview-wrap { position: static; }
        }
        @media (max-width: 768px) {
          .ig-header { flex-direction: column; align-items: flex-start; }
          .ig-header .btn { width: 100%; justify-content: center; }
          .ig-item-grid { grid-template-columns: 1fr 1fr; }
          .ig-preview { padding: 16px; min-height: 0; font-size: 10px; }
          .ig-pv-logo { width: 110px; }
          .ig-pv-company h1 { font-size: 12px; }
          .ig-pv-company p { font-size: 9px; }
          .ig-pv-bottom { grid-template-columns: 1fr; }
          .ig-pv-foot { flex-direction: column; }
          .ig-preview-wrap { overflow-x: auto; }
        }
      `}</style>
    </div>
  )
}
