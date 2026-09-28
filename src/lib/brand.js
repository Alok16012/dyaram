// Company branding — one place to change the name, logo and contact details
// shown across the CRM, invoices, itinerary PDFs, emails and WhatsApp text.
// Settings → Company Profile can override the contact fields per browser.
export const BRAND = {
  name: 'Dayare Haram',
  legalName: 'Dayare Haram Hajj Umrah Tours Pvt Ltd',
  tagline: 'Hajj Umrah Tours Pvt Ltd',
  slogan: 'Your journey to the Haramain',
  logo: '/logo.png',
  mark: '/logo-mark.png',
  phone: '9555659996, 06272-351228',
  phones: ['9555659996', '06272-351228'],
  whatsapp: '919555659996',
  email: 'info@dayareharam.com',
  website: 'https://www.dayareharam.com',
  address: 'Karamganj Road, Near Shiksha Bhawan, P.O & P.S - Laheriasarai, Darbhanga, Bihar, 846001 India',
  gst: '10AAKCD2064Q2ZI',
  state: '10-Bihar',
  stateCode: '10',
  bank: {
    name: 'IndusInd Bank, Darbhanga',
    account: '259555659996',
    ifsc: 'INDB0001070',
    holder: 'Dayare Haram Hajj Umrah Tours Private Limited',
  },
  invoiceTerms: [
    'Payment terms are subject to details listed in agreements: 50% Advance, rest before travel.',
    'All visas and tickets are subject to final embassy approvals and airline rules.',
    'Any dispute arising out of this agreement is subject to local Bareilly jurisdiction.',
  ],
  // Booking reference, e.g. DH-EU-OCT2026-00163 (EU = Economy Umrah)
  refPrefix: 'DH',
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// Package-type code used in booking references.
export function packageCode(text = '') {
  const t = text.toLowerCase()
  if (t.includes('hajj')) return 'HJ'
  if (t.includes('ramadan')) return 'RU'
  if (t.includes('premium') || t.includes('luxury')) return 'PU'
  if (t.includes('ziyarat') || t.includes('aqsa') || t.includes('turkey')) return 'ZT'
  return 'EU'
}

// DH-EU-OCT2026-00163 — month/year of travel (or today), zero-padded sequence.
export function bookingRef({ destination = '', travelDate, seq }) {
  const d = travelDate ? new Date(travelDate) : new Date()
  const n = seq ?? Math.floor(Math.random() * 90000) + 10000
  return `${BRAND.refPrefix}-${packageCode(destination)}-${MONTHS[d.getMonth()]}${d.getFullYear()}-${String(n).padStart(5, '0')}`
}
