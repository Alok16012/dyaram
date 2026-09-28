// Shared presentation helpers: status → badge tone, formatting, avatars.

export const BOOKING_TONE = {
  confirmed:    { tone: 'green',  label: 'Confirmed' },
  advance_paid: { tone: 'orange', label: 'Advance Paid' },
  balance_due:  { tone: 'orange', label: 'Balance Due' },
  fully_paid:   { tone: 'green',  label: 'Fully Paid' },
  completed:    { tone: 'blue',   label: 'Completed' },
  cancelled:    { tone: 'red',    label: 'Cancelled' },
  draft:        { tone: 'gray',   label: 'Draft' },
}

export const LEAD_TONE = {
  new_inquiry:    { tone: 'green',  label: 'New' },
  contacted:      { tone: 'blue',   label: 'Contacted' },
  itinerary_sent: { tone: 'purple', label: 'Itinerary Sent' },
  negotiation:    { tone: 'orange', label: 'Negotiation' },
  advance_paid:   { tone: 'green',  label: 'Advance Paid' },
  documents:      { tone: 'blue',   label: 'Docs Collected' },
  trip_ongoing:   { tone: 'blue',   label: 'Trip Ongoing' },
  completed:      { tone: 'gray',   label: 'Completed' },
  lost:           { tone: 'red',    label: 'Lost' },
}

export const INVOICE_TONE = {
  paid:    { tone: 'green',  label: 'Paid' },
  unpaid:  { tone: 'orange', label: 'Unpaid' },
  overdue: { tone: 'red',    label: 'Overdue' },
}

export const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

// Compact Indian notation for chart axes: 1.2L, 75K, 950
export const inrShort = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `${+(v / 1e7).toFixed(1)}Cr`
  if (v >= 1e5) return `${+(v / 1e5).toFixed(1)}L`
  if (v >= 1e3) return `${+(v / 1e3).toFixed(0)}K`
  return String(v)
}

export const fmtDate = (d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-GB', opts) : '—'

export const timeAgo = (iso) => {
  if (!iso) return ''
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return fmtDate(iso, { day: 'numeric', month: 'short' })
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

// Soft tinted avatar colours (text colour + background), stable per name.
const AVATAR_TONES = [
  ['#3B6FF6', '#EAF0FF'], ['#12A15A', '#E8F6EE'], ['#8B5CF6', '#F2EDFF'],
  ['#E08A00', '#FFF4E0'], ['#0E9CB5', '#E3F6FA'], ['#E5484D', '#FDECEC'],
]
export const avatarTone = (name = '') => {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const [color, background] = AVATAR_TONES[h % AVATAR_TONES.length]
  return { color, background }
}

// 320000 → "Three Lakh Twenty Thousand Rupees only" (Indian numbering)
export function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`)
  const three = (n) => {
    const h = Math.floor(n / 100), r = n % 100
    return [h ? `${ones[h]} Hundred` : '', r ? two(r) : ''].filter(Boolean).join(' ')
  }
  const words = (n) => {
    if (n === 0) return 'Zero'
    const parts = []
    const crore = Math.floor(n / 1e7); n %= 1e7
    const lakh = Math.floor(n / 1e5); n %= 1e5
    const thousand = Math.floor(n / 1e3); n %= 1e3
    if (crore) parts.push(`${words(crore)} Crore`)
    if (lakh) parts.push(`${two(lakh)} Lakh`)
    if (thousand) parts.push(`${two(thousand)} Thousand`)
    if (n) parts.push(three(n))
    return parts.join(' ')
  }
  const total = Math.max(0, Number(amount) || 0)
  const rupees = Math.floor(total)
  const paise = Math.round((total - rupees) * 100)
  return `${words(rupees)} Rupees${paise ? ` and ${two(paise)} Paise` : ''} only`
}
