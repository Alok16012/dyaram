// ── Demo data ────────────────────────────────────────────────────────────
// Seeds localStorage with realistic Hajj & Umrah sample records so the CRM
// can be shown without a Supabase backend. Runs once per browser (tracked by
// DEMO_SEED_KEY); edits made during a demo persist until resetDemoData().
// All dates are relative to "today" so charts and "this month" stats are
// always populated. All customer names and numbers are fictional.

import { BRAND, bookingRef } from './brand'
import { artTile } from './artTiles'

const DEMO_SEED_KEY = 'demo_seed_version'
const DEMO_SEED_VERSION = 'dh-2'

// Login: admin / admin123 (full access), sales / demo123, imran / demo123
const ADMIN_HASH = '$2b$10$LIni/cQRHOqDOWnbW7lsC.gFwy/u98bAVRCYsz9Fa9Q02gp8mUCVe'
const DEMO_HASH = '$2b$10$UbtaTSOTnqaEL5oUfPlZZOndNayUaY3mIMiYdm5wfBLqlEJ1v4z3C'

const DAY = 24 * 60 * 60 * 1000
const ago = (days) => new Date(Date.now() - days * DAY).toISOString()
const dateIn = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)

const PHOTO = {
  haram: artTile({ scene: 'kaaba', palette: 'navy' }),
  nabawi: artTile({ scene: 'madinah', palette: 'teal' }),
  ramadan: artTile({ scene: 'mosque', palette: 'dusk' }),
  hajj: artTile({ scene: 'kaaba', palette: 'night' }),
  desert: artTile({ scene: 'desert', palette: 'sand' }),
  quba: artTile({ scene: 'mosque', palette: 'teal' }),
  flight: artTile({ scene: 'plane', palette: 'navy' }),
  hotelMakkah: artTile({ scene: 'hotel', palette: 'navy' }),
  hotelMadinah: artTile({ scene: 'hotel', palette: 'teal' }),
}

const UMRAH_INCLUSIONS = [
  'Return Air Ticket', 'Umrah Visa with Insurance', 'Accommodation in Makkah & Madinah',
  'Indian Meals 3 Times', 'Air-conditioned Transportation', 'Local Ziyarats in Makkah & Madinah',
  '5 Liters Zamzam', '2 Time Laundry', 'Gifted Umrah Kit',
]
const HAJJ_INCLUDES_TEXT = 'Package Includes: Hajj Visa & Insurance | Return Air Ticket | Aziziyah Accommodation | Mina & Arafat Camps (Cat. A) | Indian Meals 3 Time | AC Transport | Qurbani Coupon | Hajj Guide | Gifted Hajj Kit'
const INCLUDES_TEXT = 'Package Includes: Return Air Ticket | Umrah Visa with Insurance | Accommodation Mak & Med | Bus Service Makkah | Indian Meals 3 Time | Air-conditioned Transportation | Local Ziyarats in Makkah & Madinah | 5 Liters Zam Zam | 2 Time Laundry | Gifted Umrah Kit'

// Day-by-day Umrah programme: arrive Makkah, Umrah, stay, Ziyarat, train to
// Madinah, stay, Ziyarat, depart.
function umrahDays({ makkahNights, madinahNights, makkahHotel, madinahHotel, madinahFirst = false }) {
  const mk = (title, description, hotspots, extra = {}) => ({ title, description, hotspots, accommodation: makkahHotel.name, accom_star: makkahHotel.star, hotel: PHOTO.hotelMakkah, photo: PHOTO.haram, ...extra })
  const md = (title, description, hotspots, extra = {}) => ({ title, description, hotspots, accommodation: madinahHotel.name, accom_star: madinahHotel.star, hotel: PHOTO.hotelMadinah, photo: PHOTO.nabawi, ...extra })
  const makkah = [
    mk(madinahFirst ? 'Madinah → Makkah by Haramain Train' : 'Departure from India – Arrival Jeddah → Makkah',
      madinahFirst ? 'Wear Ihram at Dhul Hulaifa (Masjid Shajarah), travel to Makkah by Haramain high-speed train and check in.' : 'Group assembles at the airport in Ihram. On arrival at Jeddah, our representative receives you and transfers you by AC bus to your hotel in Makkah.',
      madinahFirst ? ['Masjid Shajarah', 'Haramain Train'] : ['Jeddah Airport', 'Makkah'], { photo: madinahFirst ? PHOTO.desert : PHOTO.flight }),
    mk('Perform Umrah', 'Perform Umrah with our group leader — Tawaf, Sa\'i between Safa and Marwah, and Halq/Taqsir. Rest of the day for ibadah in Masjid al-Haram.', ['Masjid al-Haram', 'Safa & Marwah']),
  ]
  for (let i = makkah.length; i < makkahNights; i++) {
    if (i === 3) makkah.push(mk('Makkah Ziyarat', 'Guided Ziyarat of Jabal al-Nour (Ghar Hira), Jabal Thawr, Mina, Muzdalifah and Arafat (Jabal al-Rahmah).', ['Jabal al-Nour', 'Mina', 'Arafat', 'Muzdalifah'], { photo: PHOTO.desert }))
    else makkah.push(mk('Ibadah in Makkah', 'Free day for prayers in Masjid al-Haram, nafl Tawaf and personal ibadah. Meals at the hotel.', ['Masjid al-Haram']))
  }
  const madinah = [
    md(madinahFirst ? 'Departure from India – Arrival Madinah' : 'Makkah → Madinah by Haramain Train',
      madinahFirst ? 'Arrive at Madinah airport, transfer to your hotel near Masjid an-Nabawi.' : 'After Fajr, check out and travel to Madinah by Haramain high-speed train. Check in near Masjid an-Nabawi.',
      madinahFirst ? ['Madinah Airport'] : ['Haramain Train', 'Masjid an-Nabawi'], { photo: madinahFirst ? PHOTO.flight : PHOTO.nabawi }),
  ]
  for (let i = 1; i < madinahNights; i++) {
    if (i === 2) madinah.push(md('Madinah Ziyarat', 'Guided Ziyarat of Masjid Quba, Masjid Qiblatain, Mount Uhud and the Martyrs of Uhud, and the Seven Mosques.', ['Masjid Quba', 'Masjid Qiblatain', 'Mount Uhud'], { photo: PHOTO.quba }))
    else madinah.push(md('Ibadah in Madinah', 'Prayers in Masjid an-Nabawi, visit to Riyadh ul-Jannah (as per permit) and salam at Rawdah.', ['Masjid an-Nabawi', 'Riyadh ul-Jannah']))
  }
  const out = madinahFirst ? [...madinah, ...makkah] : [...makkah, ...madinah]
  out.push({ title: madinahFirst ? 'Departure from Jeddah' : 'Departure from Madinah', description: 'Check out after breakfast and transfer to the airport for your flight home with 5 L Zamzam.', hotspots: [], accommodation: '', accom_star: 3, hotel: null, photo: PHOTO.flight })
  return out
}

function hajjDays() {
  const H = { name: 'Al Kiswah Towers Hotel (Aziziyah)', star: 4 }
  const base = umrahDays({ makkahNights: 4, madinahNights: 5, makkahHotel: H, madinahHotel: { name: 'Dar Al Iman InterContinental', star: 5 } })
  const makkahPart = base.slice(0, 4)
  const rest = base.slice(4)
  const hajj = [
    { title: '8 Dhul Hijjah – Yawm at-Tarwiyah (Mina)', description: 'Enter Ihram for Hajj and proceed to the Mina camps. Prayers in Mina.', hotspots: ['Mina'], accommodation: 'Mina Camp (Category A)', accom_star: 4, hotel: null, photo: PHOTO.desert },
    { title: '9 Dhul Hijjah – Day of Arafah', description: 'Wuquf at Arafat from Dhuhr to Maghrib, then proceed to Muzdalifah for the night.', hotspots: ['Arafat', 'Jabal al-Rahmah', 'Muzdalifah'], accommodation: 'Arafat Camp', accom_star: 4, hotel: null, photo: PHOTO.hajj },
    { title: '10 Dhul Hijjah – Eid ul-Adha', description: 'Rami of Jamarat al-Aqabah, Qurbani, Halq, and Tawaf al-Ifadah in Masjid al-Haram.', hotspots: ['Jamarat', 'Masjid al-Haram'], accommodation: 'Mina Camp (Category A)', accom_star: 4, hotel: null, photo: PHOTO.hajj },
    { title: '11–12 Dhul Hijjah – Days of Tashreeq', description: 'Rami of all three Jamarat each day and stay in Mina.', hotspots: ['Jamarat', 'Mina'], accommodation: 'Mina Camp (Category A)', accom_star: 4, hotel: null, photo: PHOTO.desert },
    { ...makkahPart[2], title: 'Return to Makkah – Farewell Tawaf', description: 'Return to the Makkah hotel, rest and perform Tawaf al-Wada before leaving Makkah.' },
  ]
  return [...makkahPart, ...hajj, ...rest]
}

function buildDemoData() {
  const users = [
    { id: 'u-admin', username: 'admin', password_hash: ADMIN_HASH, full_name: 'Administrator', role: 'Admin', is_admin: true, permissions: {}, active: true, created_at: ago(300) },
    { id: 'u-ayesha', username: 'sales', password_hash: DEMO_HASH, full_name: 'Ayesha Khan', role: 'Sales Executive', is_admin: false, permissions: { leads: true, bookings: true, itinerary: true, invoices: true }, active: true, created_at: ago(220) },
    { id: 'u-imran', username: 'imran', password_hash: DEMO_HASH, full_name: 'Imran Sheikh', role: 'Operations', is_admin: false, permissions: { bookings: true, hotels: true, cabs: true, photos: true, expenses: true }, active: true, created_at: ago(180) },
  ]
  const owner = (i) => users[i % users.length]

  const company = {
    company_name: BRAND.legalName,
    company_addr: BRAND.address,
    company_email: BRAND.email,
    company_phone: BRAND.phone,
    company_gst: BRAND.gst,
  }

  // ── Itinerary packages ──
  const SWISS = { name: 'Swissôtel Al Maqam Makkah', star: 5 }
  const KISWAH = { name: 'Al Kiswah Towers Hotel (Aziziyah)', star: 4 }
  const ELAF = { name: 'Elaf Ajyad Hotel', star: 4 }
  const ANWAR = { name: 'Anwar Al Madinah Mövenpick', star: 5 }
  const DAR = { name: 'Dar Al Iman InterContinental', star: 5 }
  const HARAM_MD = { name: 'Al Haram Hotel Madinah', star: 4 }
  const pkgDefs = [
    { title: '15 Days Economy Umrah Package', nights: 14, client: 'Mohammad Arif Ansari', photo: PHOTO.haram, from: 'Darbhanga → Jeddah',
      days: umrahDays({ makkahNights: 9, madinahNights: 5, makkahHotel: ELAF, madinahHotel: HARAM_MD }),
      prices: [['Adult (Quad sharing)', '12+ yrs', 82000], ['Adult (Triple sharing)', '12+ yrs', 89000], ['Adult (Double sharing)', '12+ yrs', 99000], ['Child (with bed)', '2–11 yrs', 72000], ['Infant', 'Below 2 yrs', 25000]] },
    { title: '10 Days Premium Umrah Package', nights: 9, client: 'Farhan Qureshi', photo: artTile({ scene: 'kaaba', palette: 'dusk' }), from: 'Patna → Jeddah',
      days: umrahDays({ makkahNights: 5, madinahNights: 4, makkahHotel: SWISS, madinahHotel: ANWAR }),
      prices: [['Adult (Quad sharing)', '12+ yrs', 115000], ['Adult (Triple sharing)', '12+ yrs', 125000], ['Adult (Double sharing)', '12+ yrs', 145000], ['Child (with bed)', '2–11 yrs', 95000], ['Infant', 'Below 2 yrs', 30000]] },
    { title: '21 Days Ramadan Umrah (Last Ashra)', nights: 20, client: 'Nadia Rahman', photo: PHOTO.ramadan, from: 'Delhi → Madinah',
      days: umrahDays({ makkahNights: 14, madinahNights: 6, makkahHotel: ELAF, madinahHotel: HARAM_MD, madinahFirst: true }),
      prices: [['Adult (Quad sharing)', '12+ yrs', 135000], ['Adult (Triple sharing)', '12+ yrs', 145000], ['Adult (Double sharing)', '12+ yrs', 165000], ['Child (with bed)', '2–11 yrs', 115000], ['Infant', 'Below 2 yrs', 35000]] },
    { title: 'Hajj 2027 – Standard Hajj Package', nights: 14, client: 'Abdul Kareem', photo: PHOTO.hajj, from: 'Kolkata → Jeddah',
      days: hajjDays(),
      prices: [['Adult (Quad sharing)', '12+ yrs', 675000], ['Adult (Triple sharing)', '12+ yrs', 725000], ['Adult (Double sharing)', '12+ yrs', 795000]] },
  ]

  const packages = []
  const prices = []
  const days = []
  const day_photos = []
  pkgDefs.forEach((p, i) => {
    const pkgId = `pkg-${i + 1}`
    packages.push({
      id: pkgId, title: p.title, sub_title: `${BRAND.name} — ${BRAND.slogan}`,
      nights: p.nights, days: p.nights + 1, start_location: p.from,
      hero_photo_url: p.photo, client_name: p.client, created_by: owner(i).id,
      inclusions: i === 3 ? ['Hajj Visa & Insurance', 'Return Air Ticket', 'Aziziyah Accommodation', 'Mina & Arafat Camps (Cat. A)', 'Indian Meals 3 Times', 'AC Transport', 'Qurbani Coupon', 'Experienced Hajj Guide', 'Gifted Hajj Kit'] : UMRAH_INCLUSIONS,
      exclusions: ['Personal Expenses', 'Extra Baggage', 'Anything not mentioned in inclusions'],
      tc_payment: BRAND.invoiceTerms[0],
      tc_cancel: 'Visa fee and air tickets are non-refundable once issued.\nHotel cancellation charges apply as per hotel policy.',
      tc_notes: BRAND.invoiceTerms[1],
      ...company,
      created_at: ago(4 + i * 11), updated_at: ago(1 + i),
    })
    p.prices.forEach(([pax_type, age_limit, price], j) => {
      prices.push({ id: `${pkgId}-price-${j}`, package_id: pkgId, pax_type, age_limit, price, sort_order: j })
    })
    p.days.forEach((d, j) => {
      const dayId = `${pkgId}-day-${j + 1}`
      days.push({
        id: dayId, package_id: pkgId, day_number: j + 1, title: d.title, description: d.description,
        distance: '', hotspots: d.hotspots, themes: ['Ibadah', 'Ziyarat'],
        meals: d.accommodation ? ['Stay', 'Breakfast', 'Lunch', 'Dinner'] : ['Breakfast'],
        accommodation: d.accommodation, accom_star: d.accom_star, hotel_photo_url: d.hotel,
        sort_order: j, created_at: ago(4 + i * 11),
      })
      day_photos.push({ id: `${dayId}-ph`, day_id: dayId, photo_url: d.photo, tag_name: d.hotspots[0] || d.title, tag_type: 'location', slot_index: 0, created_at: ago(4) })
    })
  })

  // ── Leads, bookings & payments (deterministic pseudo-random) ──
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const NAMES = [
    'Mohammad Arif Ansari', 'Ayesha Siddiqui', 'Farhan Qureshi', 'Imran Ahmed', 'Zainab Fatima', 'Salman Shaikh',
    'Nadia Rahman', 'Abdul Kareem', 'Rukhsar Bano', 'Tariq Hussain', 'Sana Mirza', 'Faisal Khan', 'Hina Kausar',
    'Junaid Alam', 'Mehwish Parveen', 'Irfan Malik', 'Nargis Khatoon', 'Shahid Raza', 'Tabassum Ara', 'Aftab Alam',
    'Rizwan Haider', 'Shabnam Perween', 'Naushad Ali', 'Gulnaz Begum', 'Asad Iqbal', 'Kaif Rizvi', 'Arshad Jamal',
    'Samina Khatun', 'Mustafa Kamal', 'Yasmin Ara', 'Danish Anwar', 'Firoz Alam', 'Rehana Sultana', 'Zeeshan Akhtar',
    'Farzana Nasreen', 'Mohammad Sajid', 'Uzma Parvez', 'Obaidullah Khan', 'Shaista Anjum', 'Nadeem Akhtar',
    'Mohammad Zubair', 'Afreen Jahan', 'Anwar Hussain', 'Kulsum Bano', 'Tanveer Ahmad', 'Rubina Khatoon',
  ]
  const CITIES = ['Darbhanga', 'Laheriasarai', 'Madhubani', 'Sitamarhi', 'Muzaffarpur', 'Samastipur', 'Patna', 'Kolkata', 'Delhi']
  // [destination, package id, nights, price per person]
  const TRIPS = [
    ['Economy Umrah', 'pkg-1', 14, 82000], ['Economy Umrah', 'pkg-1', 14, 82000], ['Economy Umrah', 'pkg-1', 14, 82000],
    ['Premium Umrah', 'pkg-2', 9, 115000], ['Premium Umrah', 'pkg-2', 9, 115000],
    ['Ramadan Umrah', 'pkg-3', 20, 135000], ['Hajj 2027', 'pkg-4', 14, 675000],
    ['Umrah + Taif Ziyarat', 'pkg-1', 14, 92000], ['Umrah + Dubai', null, 12, 105000],
    ['Turkey Ziyarat Tour', null, 8, 95000], ['Al-Aqsa Ziyarat', null, 7, 110000],
  ]
  const SOURCES = ['Walk-in', 'WhatsApp', 'Referral', 'Phone Call', 'Social Media', 'Website', 'Referral', 'WhatsApp']
  const STAGES = ['new_inquiry', 'new_inquiry', 'contacted', 'contacted', 'itinerary_sent', 'negotiation', 'advance_paid', 'documents', 'completed', 'lost']
  const STATUS = ['confirmed', 'advance_paid', 'advance_paid', 'balance_due', 'fully_paid', 'fully_paid', 'completed', 'cancelled']
  const METHODS = [['upi', 'UPI IndusInd Bank'], ['upi', 'UPI'], ['bank_transfer', 'IndusInd Bank'], ['cash', 'Cash']]
  const txn = () => `T26${String(Math.floor(1e11 + rnd() * 9e11))}`
  const passport = () => `${pick('TRSUVWZ'.split(''))}${Math.floor(1000000 + rnd() * 8999999)}`

  const leads = []
  const bookings = []
  const payments = []
  let refSeq = 120

  NAMES.forEach((name, i) => {
    const [destination, package_id, nights, perPerson] = pick(TRIPS)
    const age = i < 6 ? i * 0.4 : Math.round(Math.pow(rnd(), 1.7) * 170)
    const u = owner(i)
    const phone = `+91 ${pick(['6', '7', '8', '9'])}${String(Math.floor(100000000 + rnd() * 899999999))}`
    const travelIn = destination === 'Hajj 2027' ? 250 + Math.round(rnd() * 20) : Math.round(rnd() * 100) - 25
    const adults = 1 + Math.floor(rnd() * 4)
    const children = rnd() < 0.3 ? 1 : 0
    const stage = i < 5 ? pick(['new_inquiry', 'contacted', 'new_inquiry']) : pick(STAGES)
    const lead = {
      id: `lead-${i + 1}`, name, phone, whatsapp: phone,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${i}@example.com`,
      destination, travel_date: dateIn(travelIn), return_date: dateIn(travelIn + nights),
      adults, children, infants: 0,
      budget_min: perPerson * (adults + children) - 20000, budget_max: perPerson * (adults + children) + 20000,
      stage, source: pick(SOURCES), package_id,
      assigned_to: u.id, assigned_name: u.full_name,
      notes: i % 4 === 0 ? `Family from ${pick(CITIES)}. Wants hotel close to Haram.` : i % 5 === 0 ? 'Senior citizen — needs wheelchair assistance.' : '',
      created_at: ago(age + rnd()), updated_at: ago(Math.max(0, age - 1)),
    }
    leads.push(lead)

    // Leads further down the funnel (and most older ones) become bookings.
    const converts = ['advance_paid', 'documents', 'trip_ongoing', 'completed'].includes(stage) || (i >= 5 && rnd() < 0.55)
    if (!converts) return
    const pax = adults + children
    const discount = rnd() < 0.5 ? pax * 2000 : 0
    const total = perPerson * pax - discount
    const status = ['completed'].includes(stage) ? 'completed' : pick(STATUS)
    const advance = Math.round(total * 0.5 / 100) * 100
    const paid = status === 'confirmed' || status === 'cancelled' ? 0
      : ['fully_paid', 'completed'].includes(status) ? total
      : status === 'balance_due' ? Math.round(total * 0.3 / 100) * 100 : advance
    const created = Math.max(0, Math.round(age * 0.8))
    const id = `bk-${bookings.length + 1}`
    refSeq += 1
    const b = {
      id, booking_ref: bookingRef({ destination, travelDate: lead.travel_date, seq: refSeq }), lead_id: lead.id, package_id,
      customer_name: pax > 1 ? `${name} +${pax - 1}` : name, customer_email: lead.email, customer_phone: phone, customer_whatsapp: phone,
      destination, travel_date: lead.travel_date, return_date: lead.return_date,
      adults, children, infants: 0, nights,
      total_amount: total, advance_percent: 50, advance_amount: advance,
      balance_amount: total - paid, paid_amount: paid, status,
      booking_token: `demo-token-${bookings.length + 1}`, notes: '',
      passport_no: passport(), discount, price_per_person: perPerson,
      created_at: ago(created + rnd() * 0.9), updated_at: ago(Math.max(0, created - 1)),
    }
    bookings.push(b)
    // Split what was paid into 1–3 instalments, like real UPI part-payments.
    let left = paid
    const parts = paid === 0 ? 0 : paid >= total && total > 150000 ? 3 : paid > 60000 ? 2 : 1
    for (let k = 0; k < parts; k++) {
      const amt = k === parts - 1 ? left : Math.round((paid / parts) / 100) * 100
      left -= amt
      const d = Math.max(0, created - k * (2 + Math.floor(rnd() * 5)))
      const [method, label] = pick(METHODS)
      payments.push({
        id: `pay-${id}-${k}`, booking_id: id, amount: amt, type: k === 0 ? 'advance' : 'balance', method,
        razorpay_payment_id: method === 'cash' ? null : txn(), status: 'success',
        notes: method === 'cash' ? 'Cash at office' : label, paid_at: ago(d), created_at: ago(d),
      })
    }
  })

  // ── Newsletter subscribers (website signups) ──
  ;['Shoaib Akhtar', 'Nazia Hasan', 'Adil Raza', 'Sadia Afreen', 'Mohsin Ali', 'Tahira Begum', 'Wajid Hussain', 'Asma Khatoon', 'Rafiq Ahmad', 'Heena Kauser'].forEach((name, i) => {
    leads.push({
      id: `lead-nl${i + 1}`, name, phone: null, whatsapp: null,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      destination: null, travel_date: null, return_date: null, adults: 1, children: 0, infants: 0,
      budget_min: null, budget_max: null, stage: 'new_inquiry', source: 'Newsletter', package_id: null,
      assigned_to: null, assigned_name: null, notes: 'Newsletter signup from website',
      created_at: ago(3 + i * 11), updated_at: ago(3 + i * 11),
    })
  })

  // ── Invoices (numbered like the real ones, e.g. 163) ──
  const invoiced = bookings.filter(b => b.status !== 'cancelled').sort((a, z) => new Date(a.created_at) - new Date(z.created_at)).slice(-16)
  const invoices = invoiced.map((b, i) => {
    const pays = payments.filter(p => p.booking_id === b.id)
    const pax = b.adults + b.children
    const trip = new Date(b.travel_date).toLocaleString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()
    const pkgName = b.package_id ? pkgDefs[Number(b.package_id.split('-')[1]) - 1].title : `${b.destination} Package`
    const paidAmt = pays.reduce((s, p) => s + p.amount, 0)
    return {
      id: `inv-${i + 1}`, invoice_number: String(148 + i), invoice_title: 'Hajj Umrah Package Booking',
      booking_ref: b.booking_ref,
      client_name: b.customer_name.toUpperCase(), client_phone: b.customer_phone, client_address: `${pick(CITIES)}, Bihar`,
      client_gstin: '', client_state_code: '10', booking_id: b.id,
      items: [{ id: `it-${i}`, description: `${pkgName} ${trip}`, details: b.destination.includes('Hajj') ? HAJJ_INCLUDES_TEXT : INCLUDES_TEXT, passport: b.passport_no, hsn: '', qty: pax, rate: b.price_per_person, discount: b.discount || '', cgst: '', sgst: '', igst: '' }],
      payments: pays.map(p => ({ id: p.id, date: p.paid_at.slice(0, 10), amount: p.amount, mode: p.method === 'cash' ? 'Cash' : p.method === 'upi' ? 'UPI' : 'Bank Transfer', reference: p.razorpay_payment_id ? `${p.notes} ${p.razorpay_payment_id}` : '' })),
      amount_paid: paidAmt,
      subtotal: b.total_amount, tax_amount: 0, amount: b.total_amount,
      status: paidAmt >= b.total_amount ? 'paid' : paidAmt > 0 ? 'partial' : i % 5 === 2 ? 'overdue' : 'unpaid',
      issue_date: b.created_at.slice(0, 10), due_date: new Date(new Date(b.created_at).getTime() + 15 * DAY).toISOString().slice(0, 10), notes: 'Thanks for doing business with us',
      created_at: b.created_at,
    }
  })

  // ── Hotels (Makkah & Madinah partners) ──
  const hotels = [
    ['Swissôtel Al Maqam Makkah', 'Makkah (Abraj Al Bait)', 5, 'Reservations Desk', 22000, 'Haram view rooms on request'],
    ['Hilton Suites Makkah', 'Makkah (Jabal Omar)', 5, 'Group Sales', 18500, ''],
    ['Elaf Ajyad Hotel', 'Makkah (Ajyad)', 4, 'Mr. Saeed', 9800, '400 m from Haram, shuttle available'],
    ['Al Kiswah Towers Hotel', 'Makkah (Aziziyah)', 4, 'Mr. Khalid', 6500, 'Used for Hajj groups (Aziziyah)'],
    ['Anwar Al Madinah Mövenpick', 'Madinah (Central Area)', 5, 'Group Sales', 16500, ''],
    ['Dar Al Iman InterContinental', 'Madinah (Central Area)', 5, 'Reservations Desk', 15000, ''],
    ['Al Haram Hotel Madinah', 'Madinah (Central Area)', 4, 'Mr. Yusuf', 11000, 'Economy package partner'],
  ].map(([name, location, star_rating, contact_person, rate_per_night, notes], i) => ({
    id: `hotel-${i + 1}`, name, location, star_rating, contact_person,
    phone: `+966 5${String(40000000 + i * 1357913).slice(0, 8)}`, email: `groups${i + 1}@example.com`,
    rate_per_night, notes, created_at: ago(120 - i),
  }))

  // ── Transport vendors (Cabs page) ──
  const cabs = [
    ['Al Safwa Transport', 'GMC Yukon (7 seater)', 'Abdul Rahman', 12500, 'per trip', 'Jeddah Airport → Makkah'],
    ['Makkah Ziyarat Bus Service', 'Coaster Bus (25 seater)', 'Yusuf', 18000, 'per day', 'Group Ziyarat'],
    ['Haramain Transport Co.', 'Hyundai H1 (10 seater)', 'Khalid', 9500, 'per trip', 'Makkah ↔ Madinah by road'],
    ['Madinah Taxi Services', 'Toyota Camry', 'Faisal', 6500, 'per trip', 'Madinah Airport transfers'],
    ['Darbhanga Travels', 'Innova Crysta', 'Naushad', 4500, 'per trip', 'Home → Darbhanga / Patna airport'],
  ].map(([vendor_name, vehicle_type, contact_person, rate, rate_unit, notes], i) => ({
    id: `cab-${i + 1}`, vendor_name, vehicle_type, contact_person,
    phone: i === 4 ? `+91 9${String(430000000 + i * 1111111)}` : `+966 5${String(50000000 + i * 2468013).slice(0, 8)}`,
    rate, rate_unit, notes, created_at: ago(100 - i),
  }))

  // ── Income & expenses (spread over the last 6 months) ──
  const income = payments.map((p, i) => {
    const b = bookings.find(x => x.id === p.booking_id)
    return { id: `inc-${i + 1}`, date: p.paid_at.slice(0, 10), source: `${b.customer_name} (${b.booking_ref})`, category: 'Booking Payment', amount: p.amount, booking_id: b.id, notes: p.notes || '', created_at: p.paid_at }
  })
  ;[[20, 18500], [55, 24000], [95, 15500], [140, 21000]].forEach(([d, amt], i) => {
    income.push({ id: `inc-c-${i + 1}`, date: ago(d).slice(0, 10), source: 'Airline group ticket commission', category: 'Commission', amount: amt, booking_id: null, notes: '', created_at: ago(d) })
  })
  const expenses = []
  const expDefs = [
    ['Hotel', 'Elaf Ajyad Hotel', 98000], ['Hotel', 'Al Haram Hotel Madinah', 66000],
    ['Cab/Transport', 'Al Safwa Transport', 37500], ['Staff Salary', 'Monthly payroll', 85000],
    ['Marketing', 'Facebook & Instagram ads', 15000], ['Office', 'Office rent – Laheriasarai', 18000],
    ['Other', 'Umrah kits & ihram', 12000], ['Other', 'Visa processing charges', 28000],
  ]
  for (let m = 0; m < 6; m++) {
    expDefs.forEach(([category, vendor, amount], j) => {
      if ((j + m) % 3 === 2) return
      const d = m * 30 + j * 3 + 1
      expenses.push({ id: `exp-${m}-${j}`, date: ago(d).slice(0, 10), category, vendor, amount: Math.round(amount * (0.85 + ((m + j) % 4) * 0.08)), notes: '', created_at: ago(d) })
    })
  }

  // ── Photo library ──
  const photo_library = [
    ['Masjid al-Haram', 'location', PHOTO.haram], ['Masjid an-Nabawi', 'location', PHOTO.nabawi],
    ['Jabal al-Nour', 'location', PHOTO.desert], ['Masjid Quba', 'location', PHOTO.quba],
    ['Arafat', 'location', PHOTO.hajj], ['Ramadan nights', 'location', PHOTO.ramadan],
    ['Swissôtel Al Maqam', 'hotel', PHOTO.hotelMakkah], ['Anwar Al Madinah Mövenpick', 'hotel', PHOTO.hotelMadinah],
  ].map(([tag_name, tag_type, photo_url], i) => ({
    id: `photo-${i + 1}`, photo_url, file_name: `${tag_name.toLowerCase().replace(/\s+/g, '-')}.svg`, tag_name, tag_type, created_at: ago(60 - i),
  }))

  // ── Audit logs ──
  const firstBooking = bookings[0]
  const audit_logs = [
    ['Administrator', 'Login', 'Logged in as admin', 0],
    ['Ayesha Khan', 'Lead Created', `New lead: ${leads[0].name} (${leads[0].destination})`, 0],
    ['Ayesha Khan', 'Booking Created', `${firstBooking?.booking_ref} for ${firstBooking?.customer_name}`, 1],
    ['Imran Sheikh', 'Expense Added', 'Elaf Ajyad Hotel — ₹98,000', 2],
    ['Administrator', 'Invoice Generated', `Invoice ${invoices[invoices.length - 1]?.invoice_number} for ${invoices[invoices.length - 1]?.client_name}`, 2],
    ['Ayesha Khan', 'Lead Stage Changed', `${leads[3].name} → Itinerary Sent`, 3],
    ['Administrator', 'User Created', 'Imran Sheikh (Operations)', 5],
    ['Imran Sheikh', 'Hotel Added', 'Anwar Al Madinah Mövenpick, Madinah', 6],
  ].map(([actor, action, details, d], i) => ({ id: `log-${i + 1}`, actor, action, details, created_at: ago(d + i * 0.05) }))

  // ── Website packages (site_content) ──
  const webPkg = (i, title, location, image, price, originalPrice, days, category, badge, highlights) => ({
    id: i, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, location, state: 'Saudi Arabia',
    image, gallery: [image], price, originalPrice, duration: `${days - 1}N/${days}D`, days, nights: days - 1,
    groupSize: '10-45', minAge: 0, rating: 4.9, reviews: 60 + i * 15, dates: [dateIn(20), dateIn(45)],
    difficulty: 'Easy', badge, category, overview: `${title} by ${BRAND.legalName} — hotels in Makkah & Madinah, meals, transport and guided Ziyarat.`,
    highlights, itinerary: [], inclusions: UMRAH_INCLUSIONS, exclusions: ['Personal expenses', 'Extra baggage'],
    importantNotes: ['Passport must be valid for at least 6 months', 'Meningitis vaccination certificate required'], thingsToCarry: ['Ihram (2 sets)', 'Passport & ID', 'Comfortable footwear'],
  })
  const site_content = [
    { key: 'packages', value: [
      webPkg(1, '15 Days Economy Umrah', 'Makkah & Madinah', PHOTO.haram, 82000, 90000, 15, 'Umrah', 'Bestseller', ['Hotel near Haram with shuttle', 'Indian meals 3 times', 'Guided Ziyarat']),
      webPkg(2, '10 Days Premium Umrah', 'Makkah & Madinah', artTile({ scene: 'kaaba', palette: 'dusk' }), 115000, 125000, 10, 'Umrah', 'Popular', ['5-star hotels at walking distance', 'Haramain train', 'Private transfers']),
      webPkg(3, '21 Days Ramadan Umrah', 'Madinah & Makkah', PHOTO.ramadan, 135000, 150000, 21, 'Ramadan Umrah', 'Limited Seats', ['Last Ashra in Makkah', 'Iftar & Suhoor included', 'Experienced group leader']),
    ], updated_at: ago(3) },
  ]

  return {
    app_users: users, packages, prices, days, day_photos, photo_library,
    leads, lead_notes: [], bookings, payments, invoices, hotels, cabs,
    income, expenses, audit_logs, site_content,
  }
}

export function seedDemoData(force = false) {
  try {
    if (!force && localStorage.getItem(DEMO_SEED_KEY) === DEMO_SEED_VERSION) return
    const data = buildDemoData()
    for (const [table, rows] of Object.entries(data)) {
      localStorage.setItem(`mock_${table}`, JSON.stringify(rows))
    }
    localStorage.setItem(DEMO_SEED_KEY, DEMO_SEED_VERSION)
  } catch (e) {
    console.warn('Could not seed demo data:', e)
  }
}

// Wipe everything changed during a demo and restore the original sample data.
export function resetDemoData() {
  seedDemoData(true)
}

