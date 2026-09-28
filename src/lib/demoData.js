// ── Demo data ────────────────────────────────────────────────────────────
// Seeds localStorage with realistic sample records so the CRM can be shown
// without a Supabase backend. Runs once per browser (tracked by
// DEMO_SEED_KEY); edits made during a demo persist until resetDemoData().
// All dates are relative to "today" so charts and "this month" stats are
// always populated.

const DEMO_SEED_KEY = 'demo_seed_version'
const DEMO_SEED_VERSION = '4'

// Login: admin / admin123 (full access), sales / demo123 (limited access)
const ADMIN_HASH = '$2b$10$LIni/cQRHOqDOWnbW7lsC.gFwy/u98bAVRCYsz9Fa9Q02gp8mUCVe'
const DEMO_HASH = '$2b$10$UbtaTSOTnqaEL5oUfPlZZOndNayUaY3mIMiYdm5wfBLqlEJ1v4z3C'

const DAY = 24 * 60 * 60 * 1000
const ago = (days) => new Date(Date.now() - days * DAY).toISOString()
const dateIn = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)

const img = (id) => `https://images.unsplash.com/${id}?w=900&q=70`
const PHOTOS = {
  dal: img('photo-1605649461784-eec84f8e5f0f'),
  gulmarg: img('photo-1506905925346-21bda4d32df4'),
  pahalgam: img('photo-1464822759023-fed622ff2c3b'),
  sonamarg: img('photo-1551632811-561732d1e306'),
  houseboat: img('photo-1589182373726-e4f658ab50f0'),
  hotel: img('photo-1566073771259-6a8506099945'),
  resort: img('photo-1582719508461-905c673771fd'),
  ladakh: img('photo-1455156218388-5e61b526818b'),
}

function buildDemoData() {
  const users = [
    { id: 'u-admin', username: 'admin', password_hash: ADMIN_HASH, full_name: 'Administrator', role: 'Admin', is_admin: true, permissions: {}, active: true, created_at: ago(200) },
    { id: 'u-riya', username: 'sales', password_hash: DEMO_HASH, full_name: 'Riya Sharma', role: 'Sales Executive', is_admin: false, permissions: { leads: true, bookings: true, itinerary: true, invoices: true }, active: true, created_at: ago(150) },
    { id: 'u-aman', username: 'aman', password_hash: DEMO_HASH, full_name: 'Aman Verma', role: 'Operations', is_admin: false, permissions: { bookings: true, hotels: true, cabs: true, photos: true, expenses: true }, active: true, created_at: ago(120) },
  ]
  const owner = (i) => users[i % users.length]

  // ── Itinerary packages ──
  const company = {
    company_name: 'Shera Travels',
    company_addr: 'Radio Colony, Lawaypora, Srinagar, Jammu and Kashmir 190017',
    company_email: 'hello@sheratravels.in',
    company_phone: '+91-90000 00000',
    company_gst: '01ABCDE1234F1Z5',
  }
  const pkgDefs = [
    { title: '5 Nights 6 Days Kashmir Tour Package', nights: 5, client: 'Rahul Mehta', photo: PHOTOS.dal,
      days: [
        ['Arrival in Srinagar – Shikara Ride', 'Pickup from Srinagar airport, check-in to houseboat and evening Shikara ride on Dal Lake.', ['Dal Lake', 'Char Chinar'], 'Deluxe Houseboat', PHOTOS.houseboat],
        ['Srinagar → Gulmarg', 'Day trip to Gulmarg, the meadow of flowers. Enjoy the Gondola ride (own cost).', ['Gulmarg Gondola', 'St. Mary Church'], 'Hotel Pine Spring', PHOTOS.gulmarg],
        ['Srinagar → Pahalgam', 'Drive to Pahalgam via saffron fields and Avantipura ruins.', ['Betaab Valley', 'Aru Valley', 'Chandanwari'], 'Pahalgam Retreat', PHOTOS.pahalgam],
        ['Pahalgam Local Sightseeing', 'Explore the valleys of Pahalgam at leisure.', ['Baisaran', 'Lidder River'], 'Pahalgam Retreat', PHOTOS.pahalgam],
        ['Pahalgam → Sonamarg → Srinagar', 'Day excursion to Sonamarg, the meadow of gold.', ['Thajiwas Glacier', 'Zero Point'], 'Hotel Grand Mumtaz', PHOTOS.sonamarg],
        ['Departure', 'Breakfast and transfer to Srinagar airport.', ['Mughal Gardens'], '', PHOTOS.dal],
      ] },
    { title: '3 Nights 4 Days Srinagar & Gulmarg Getaway', nights: 3, client: 'Priya Nair', photo: PHOTOS.gulmarg,
      days: [
        ['Arrival in Srinagar', 'Airport pickup, Mughal Gardens and Dal Lake Shikara ride.', ['Nishat Bagh', 'Shalimar Bagh'], 'Deluxe Houseboat', PHOTOS.houseboat],
        ['Gulmarg Excursion', 'Full-day excursion to Gulmarg with Gondola ride.', ['Gondola Phase 1', 'Golf Course'], 'Hotel Grand Mumtaz', PHOTOS.gulmarg],
        ['Sonamarg Excursion', 'Day trip to Sonamarg and Thajiwas Glacier.', ['Thajiwas Glacier'], 'Hotel Grand Mumtaz', PHOTOS.sonamarg],
        ['Departure', 'Transfer to airport with sweet memories.', [], '', PHOTOS.dal],
      ] },
    { title: '6 Nights 7 Days Leh Ladakh Adventure', nights: 6, client: 'Karan Singh', photo: PHOTOS.ladakh,
      days: [
        ['Arrival in Leh – Acclimatisation', 'Rest day to acclimatise to the altitude.', ['Shanti Stupa', 'Leh Palace'], 'The Zen Ladakh', PHOTOS.ladakh],
        ['Leh → Nubra Valley', 'Cross Khardung La, one of the highest motorable passes.', ['Khardung La', 'Hunder Dunes'], 'Nubra Organic Retreat', PHOTOS.ladakh],
        ['Nubra → Pangong Lake', 'Drive to the stunning Pangong Tso.', ['Pangong Tso'], 'Pangong Camps', PHOTOS.ladakh],
        ['Pangong → Leh', 'Return to Leh via Chang La.', ['Chang La'], 'The Zen Ladakh', PHOTOS.ladakh],
        ['Leh Local', 'Monasteries and Magnetic Hill.', ['Hemis', 'Thiksey', 'Magnetic Hill'], 'The Zen Ladakh', PHOTOS.ladakh],
        ['Sham Valley', 'Sangam and Alchi monastery.', ['Sangam', 'Alchi'], 'The Zen Ladakh', PHOTOS.ladakh],
        ['Departure', 'Transfer to Leh airport.', [], '', PHOTOS.ladakh],
      ] },
    { title: '4 Nights 5 Days Kashmir Honeymoon Special', nights: 4, client: 'Ankit & Sneha', photo: PHOTOS.houseboat,
      days: [
        ['Arrival – Houseboat Stay', 'Candle-light dinner on a luxury houseboat.', ['Dal Lake'], 'Luxury Houseboat', PHOTOS.houseboat],
        ['Gulmarg', 'Snow activities and Gondola.', ['Gulmarg'], 'Khyber Resort', PHOTOS.resort],
        ['Pahalgam', 'Riverside stay in Pahalgam.', ['Betaab Valley'], 'Pahalgam Retreat', PHOTOS.pahalgam],
        ['Srinagar Local', 'Shopping and Mughal Gardens.', ['Lal Chowk'], 'Hotel Grand Mumtaz', PHOTOS.hotel],
        ['Departure', 'Airport drop.', [], '', PHOTOS.dal],
      ] },
  ]

  const packages = []
  const prices = []
  const days = []
  const day_photos = []
  pkgDefs.forEach((p, i) => {
    const pkgId = `pkg-${i + 1}`
    packages.push({
      id: pkgId, title: p.title, sub_title: "Let's Travel The World",
      nights: p.nights, days: p.nights + 1,
      start_location: i === 2 ? 'Leh, Ladakh' : 'Srinagar, Jammu & Kashmir',
      hero_photo_url: p.photo, client_name: p.client, created_by: owner(i).id,
      inclusions: ['MAP (Room + Breakfast + Dinner)', 'Sightseeing', 'Transfers', 'Private Cab', 'Accommodation'],
      exclusions: ['Airfare', 'Personal Expenses', 'Entry Tickets'],
      tc_payment: '20% advance of total booking amount.\nBalance 7 days before travel.',
      tc_cancel: 'Refund after deducting retention amount as per days left before travel.',
      tc_notes: '', ...company,
      created_at: ago(5 + i * 9), updated_at: ago(2 + i),
    })
    const base = 6000 + p.nights * 3500
    ;[['Adult', '12+ yrs', base], ['Child', '5–11 yrs', Math.round(base * 0.6)], ['Infant', '0–4 yrs', 0]].forEach(([pax_type, age_limit, price], j) => {
      prices.push({ id: `${pkgId}-price-${j}`, package_id: pkgId, pax_type, age_limit, price, sort_order: j })
    })
    p.days.forEach(([title, description, hotspots, accommodation, photo], j) => {
      const dayId = `${pkgId}-day-${j + 1}`
      days.push({
        id: dayId, package_id: pkgId, day_number: j + 1, title, description,
        distance: j === 0 || j === p.days.length - 1 ? '15 km' : `${60 + j * 25} km`,
        hotspots, themes: ['Nature', 'Sightseeing'],
        meals: accommodation ? ['Stay', 'Breakfast', 'Dinner'] : ['Breakfast'],
        accommodation, accom_star: accommodation ? 3 + (j % 3 === 0 ? 1 : 0) : 3,
        hotel_photo_url: accommodation ? PHOTOS.hotel : null,
        sort_order: j, created_at: ago(5 + i * 9),
      })
      day_photos.push({ id: `${dayId}-ph`, day_id: dayId, photo_url: photo, tag_name: hotspots[0] || title, tag_type: 'location', slot_index: 0, created_at: ago(5) })
    })
  })

  // ── Leads ──
  const leadDefs = [
    ['Rahul Mehta', 'Kashmir', 'advance_paid', 'Website', 2, 1, 45000, 60000, 3],
    ['Priya Nair', 'Srinagar & Gulmarg', 'itinerary_sent', 'WhatsApp', 2, 0, 30000, 40000, 5],
    ['Karan Singh', 'Leh Ladakh', 'negotiation', 'Referral', 4, 0, 90000, 120000, 8],
    ['Ankit Gupta', 'Kashmir Honeymoon', 'completed', 'Social Media', 2, 0, 50000, 70000, 70],
    ['Neha Kapoor', 'Kashmir', 'new_inquiry', 'Website', 3, 1, 40000, 55000, 0],
    ['Vikram Rao', 'Pahalgam', 'contacted', 'Phone Call', 2, 2, 35000, 50000, 1],
    ['Sana Qureshi', 'Gulmarg', 'new_inquiry', 'JustDial', 2, 0, 25000, 35000, 1],
    ['Arjun Malhotra', 'Kashmir', 'documents', 'Website', 5, 2, 110000, 140000, 15],
    ['Meera Iyer', 'Sonamarg', 'lost', 'WhatsApp', 2, 0, 20000, 30000, 40],
    ['Rohan Das', 'Leh Ladakh', 'trip_ongoing', 'Referral', 3, 0, 85000, 95000, 25],
    ['Fatima Sheikh', 'Kashmir', 'contacted', 'Walk-in', 4, 2, 60000, 80000, 2],
    ['Aditya Joshi', 'Vaishno Devi', 'new_inquiry', 'Social Media', 6, 3, 45000, 60000, 0],
    ['Pooja Reddy', 'Kashmir', 'negotiation', 'Website', 2, 1, 42000, 52000, 6],
    ['Siddharth Jain', 'Gulmarg', 'completed', 'Referral', 2, 0, 38000, 45000, 100],
    ['Kavya Menon', 'Kashmir', 'itinerary_sent', 'WhatsApp', 2, 0, 36000, 48000, 12],
    ['Imran Lone', 'Pahalgam', 'completed', 'Phone Call', 4, 1, 55000, 65000, 130],
    ['Divya Bansal', 'Newsletter', 'new_inquiry', 'Newsletter', 1, 0, null, null, 4],
    ['Harsh Vardhan', 'Newsletter', 'new_inquiry', 'Newsletter', 1, 0, null, null, 9],
  ]
  const leads = leadDefs.map(([name, destination, stage, source, adults, children, bmin, bmax, age], i) => {
    const u = owner(i)
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '.')
    const phone = `+91 98${String(70000000 + i * 1234567).slice(0, 8)}`
    return {
      id: `lead-${i + 1}`, name, phone, whatsapp: phone, email: `${slug}@example.com`,
      destination, travel_date: dateIn(10 + (i % 7) * 9 - (stage === 'completed' ? 120 : 0)),
      return_date: dateIn(15 + (i % 7) * 9 - (stage === 'completed' ? 120 : 0)),
      adults, children, infants: 0, budget_min: bmin, budget_max: bmax,
      stage, source, package_id: i < 4 ? `pkg-${i + 1}` : null,
      assigned_to: u.id, assigned_name: u.full_name,
      notes: source === 'Newsletter' ? 'Newsletter signup from website' : (i % 3 === 0 ? 'Wants houseboat stay for 1 night.' : ''),
      created_at: ago(age), updated_at: ago(Math.max(0, age - 1)),
    }
  })

  // ── Bookings & payments ──
  const bookingDefs = [
    [0, 58000, 11600, 'advance_paid'],
    [3, 64000, 64000, 'completed'],
    [7, 132000, 26400, 'advance_paid'],
    [9, 92000, 92000, 'fully_paid'],
    [13, 42000, 42000, 'completed'],
    [15, 61000, 61000, 'completed'],
    [2, 115000, 0, 'confirmed'],
  ]
  const bookings = []
  const payments = []
  bookingDefs.forEach(([li, total, paid, status], i) => {
    const l = leads[li]
    const id = `bk-${i + 1}`
    const advance = Math.round(total * 0.2)
    const created = Math.max(1, (leadDefs[li][8] || 1) - 2)
    bookings.push({
      id, booking_ref: `ST-2026-${String(i + 1).padStart(4, '0')}`, lead_id: l.id, package_id: l.package_id,
      customer_name: l.name, customer_email: l.email, customer_phone: l.phone, customer_whatsapp: l.whatsapp,
      destination: l.destination, travel_date: l.travel_date, return_date: l.return_date,
      adults: l.adults, children: l.children, infants: 0, nights: 5,
      total_amount: total, advance_percent: 20, advance_amount: advance,
      balance_amount: total - paid, paid_amount: paid, status,
      booking_token: `demo-token-${i + 1}`, notes: '',
      created_at: ago(created), updated_at: ago(Math.max(0, created - 1)),
    })
    if (paid > 0) {
      payments.push({ id: `pay-${i + 1}-a`, booking_id: id, amount: Math.min(paid, advance), type: 'advance', method: i % 2 ? 'upi' : 'razorpay', status: 'success', notes: '', paid_at: ago(created), created_at: ago(created) })
      if (paid > advance) {
        payments.push({ id: `pay-${i + 1}-b`, booking_id: id, amount: paid - advance, type: 'balance', method: 'bank_transfer', status: 'success', notes: '', paid_at: ago(Math.max(0, created - 5)), created_at: ago(Math.max(0, created - 5)) })
      }
    }
  })

  // ── Extra generated volume ──
  // Deterministic pseudo-random so every browser sees the same demo.
  let seed = 42
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const FIRST = ['Aarav', 'Ishita', 'Kabir', 'Ananya', 'Vivaan', 'Saanvi', 'Reyansh', 'Diya', 'Arnav', 'Myra', 'Yash', 'Tanvi', 'Nikhil', 'Riya', 'Manish', 'Shreya', 'Gaurav', 'Nisha', 'Varun', 'Aisha', 'Kunal', 'Sneha', 'Rakesh', 'Payal', 'Deepak', 'Jyoti', 'Mohit', 'Simran', 'Tarun', 'Zoya']
  const LAST = ['Sharma', 'Verma', 'Patel', 'Iyer', 'Khan', 'Gupta', 'Singh', 'Reddy', 'Bose', 'Mishra', 'Chopra', 'Pillai', 'Agarwal', 'Nair', 'Saxena']
  const TRIPS = [
    ['Kashmir', 'pkg-1', 5], ['Srinagar & Gulmarg', 'pkg-2', 3], ['Leh Ladakh', 'pkg-3', 6],
    ['Kashmir Honeymoon', 'pkg-4', 4], ['Pahalgam', 'pkg-1', 5], ['Gulmarg', 'pkg-2', 3],
    ['Sonamarg', 'pkg-1', 4], ['Kashmir', 'pkg-1', 5], ['Leh Ladakh', 'pkg-3', 6],
  ]
  const SOURCES = ['Website', 'WhatsApp', 'Referral', 'Social Media', 'Phone Call', 'JustDial', 'Walk-in']
  const STAGES = ['new_inquiry', 'new_inquiry', 'contacted', 'contacted', 'itinerary_sent', 'negotiation', 'advance_paid', 'completed', 'lost']
  const STATUS = ['confirmed', 'advance_paid', 'advance_paid', 'balance_due', 'fully_paid', 'fully_paid', 'completed', 'cancelled']

  for (let i = 0; i < 46; i++) {
    // Every 6th generated lead is a returning customer from the original list.
    const returning = i % 6 === 5 ? leads[(i * 3) % 16] : null
    const name = returning ? returning.name : `${pick(FIRST)} ${pick(LAST)}`
    const [destination, package_id, nights] = pick(TRIPS)
    // Skew toward recent days so "last 7 / 30 days" views are lively.
    const age = Math.round(Math.pow(rnd(), 1.8) * 170)
    const u = owner(i + 1)
    const phone = returning ? returning.phone : `+91 9${String(Math.floor(100000000 + rnd() * 899999999))}`
    const travelIn = Math.round(rnd() * 90) - 20
    const lead = {
      id: `lead-g${i + 1}`, name, phone, whatsapp: phone,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${i}@example.com`,
      destination, travel_date: dateIn(travelIn), return_date: dateIn(travelIn + nights),
      adults: 1 + Math.floor(rnd() * 4), children: Math.floor(rnd() * 2.4), infants: 0,
      budget_min: 25000 + Math.round(rnd() * 40) * 1000, budget_max: null,
      stage: pick(STAGES), source: pick(SOURCES), package_id,
      assigned_to: u.id, assigned_name: u.full_name, notes: '',
      created_at: ago(age + rnd()), updated_at: ago(Math.max(0, age - 1)),
    }
    lead.budget_max = lead.budget_min + 15000
    leads.push(lead)

    if (i % 4 === 3 && !returning) continue // not every lead converts
    const bIdx = bookings.length
    const id = `bk-g${i + 1}`
    const pax = lead.adults + lead.children
    const total = Math.round((nights * 5200 + 6000) * pax / 500) * 500
    const status = pick(STATUS)
    const advance = Math.round(total * 0.2)
    const paid = status === 'confirmed' || status === 'cancelled' ? 0
      : ['fully_paid', 'completed'].includes(status) ? total
      : status === 'balance_due' ? Math.round(total * 0.5) : advance
    const created = Math.max(0, Math.round(age * 0.8))
    bookings.push({
      id, booking_ref: `ST-2026-${String(bIdx + 1).padStart(4, '0')}`, lead_id: lead.id, package_id,
      customer_name: name, customer_email: lead.email, customer_phone: phone, customer_whatsapp: phone,
      destination, travel_date: lead.travel_date, return_date: lead.return_date,
      adults: lead.adults, children: lead.children, infants: 0, nights,
      total_amount: total, advance_percent: 20, advance_amount: advance,
      balance_amount: total - paid, paid_amount: paid, status,
      booking_token: `demo-token-g${i + 1}`, notes: '',
      created_at: ago(created + rnd() * 0.9), updated_at: ago(Math.max(0, created - 1)),
    })
    if (paid > 0) {
      const first = Math.min(paid, advance)
      payments.push({ id: `pay-g${i + 1}-a`, booking_id: id, amount: first, type: 'advance', method: pick(['razorpay', 'upi', 'bank_transfer']), status: 'success', notes: '', paid_at: ago(created), created_at: ago(created) })
      if (paid > first) {
        const d = Math.max(0, created - 3 - Math.floor(rnd() * 10))
        payments.push({ id: `pay-g${i + 1}-b`, booking_id: id, amount: paid - first, type: 'balance', method: pick(['upi', 'bank_transfer', 'cash']), status: 'success', notes: '', paid_at: ago(d), created_at: ago(d) })
      }
    }
  }

  // ── Newsletter subscribers (website signups) ──
  ;['Ritu Malhotra', 'Sameer Kulkarni', 'Neelam Joshi', 'Arjun Sethi', 'Pallavi Rao', 'Farhan Mir',
    'Kriti Arora', 'Vikas Tiwari', 'Megha Kapoor', 'Hina Wani'].forEach((name, i) => {
    leads.push({
      id: `lead-nl${i + 1}`, name, phone: null, whatsapp: null,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      destination: null, travel_date: null, return_date: null, adults: 1, children: 0, infants: 0,
      budget_min: null, budget_max: null, stage: 'new_inquiry', source: 'Newsletter', package_id: null,
      assigned_to: null, assigned_name: null, notes: 'Newsletter signup from website',
      created_at: ago(3 + i * 11), updated_at: ago(3 + i * 11),
    })
  })

  // ── Invoices ──
  const invoices = bookings.filter(b => b.status !== 'cancelled').slice(0, 14).map((b, i) => {
    const rate = Math.round(b.total_amount / 1.05)
    const tax = b.total_amount - rate
    return {
      id: `inv-${i + 1}`, invoice_number: `INV-2026-${String(101 + i)}`,
      client_name: b.customer_name, client_phone: b.customer_phone, client_address: 'New Delhi, India',
      client_gstin: '', client_state_code: '07', booking_id: b.id,
      items: [{ id: `it-${i}`, description: `${b.nights}N/${b.nights + 1}D ${b.destination} Tour Package`, hsn: '998552', qty: 1, rate, discount: '', cgst: 2.5, sgst: 2.5, igst: '' }],
      subtotal: rate, tax_amount: tax, amount: b.total_amount,
      status: b.balance_amount === 0 ? 'paid' : i % 5 === 2 ? 'overdue' : 'unpaid',
      issue_date: b.created_at.slice(0, 10), due_date: dateIn(10 - i * 3), notes: 'Thank you for travelling with us!',
      created_at: b.created_at,
    }
  })

  // ── Hotels & cabs ──
  const hotels = [
    ['Hotel Grand Mumtaz', 'Srinagar', 4, 'Mr. Bhat', 4500],
    ['Deluxe Houseboat New Golden Flower', 'Dal Lake, Srinagar', 4, 'Ghulam Nabi', 5200],
    ['Hotel Pine Spring', 'Gulmarg', 3, 'Mr. Wani', 3800],
    ['Khyber Himalayan Resort', 'Gulmarg', 5, 'Front Office', 18500],
    ['Pahalgam Retreat', 'Pahalgam', 4, 'Mr. Lone', 5600],
    ['The Zen Ladakh', 'Leh', 4, 'Tsering Dorje', 6200],
  ].map(([name, location, star_rating, contact_person, rate_per_night], i) => ({
    id: `hotel-${i + 1}`, name, location, star_rating, contact_person,
    phone: `+91 94190 ${String(10000 + i * 1111)}`, email: `reservations${i + 1}@example.com`,
    rate_per_night, notes: i === 1 ? 'Includes Shikara pickup' : '', created_at: ago(90 - i),
  }))
  const cabs = [
    ['Kashmir Cab Service', 'Innova Crysta', 'Javid Ahmad', 4500, 'per day'],
    ['Valley Travels', 'Swift Dzire', 'Mushtaq', 2800, 'per day'],
    ['Himalayan Tempo', 'Tempo Traveller (12 seater)', 'Rafiq', 7000, 'per day'],
    ['Ladakh Wheels', 'Toyota Innova', 'Stanzin', 5500, 'per day'],
    ['Airport Express', 'Etios', 'Bilal', 1200, 'per trip'],
  ].map(([vendor_name, vehicle_type, contact_person, rate, rate_unit], i) => ({
    id: `cab-${i + 1}`, vendor_name, vehicle_type, contact_person,
    phone: `+91 70060 ${String(20000 + i * 2222)}`, rate, rate_unit, notes: '', created_at: ago(80 - i),
  }))

  // ── Income & expenses (spread over the last 6 months) ──
  const income = []
  payments.forEach((p, i) => {
    const b = bookings.find(x => x.id === p.booking_id)
    income.push({ id: `inc-${i + 1}`, date: p.paid_at.slice(0, 10), source: `${b.customer_name} (${b.booking_ref})`, category: 'Booking Payment', amount: p.amount, booking_id: b.id, notes: '', created_at: p.paid_at })
  })
  ;[[20, 8500], [55, 12000], [95, 6500], [140, 9000]].forEach(([d, amt], i) => {
    income.push({ id: `inc-c-${i + 1}`, date: ago(d).slice(0, 10), source: 'Hotel partner commission', category: 'Commission', amount: amt, booking_id: null, notes: '', created_at: ago(d) })
  })
  const expenses = []
  const expDefs = [
    ['Hotel', 'Hotel Grand Mumtaz', 18000], ['Cab/Transport', 'Kashmir Cab Service', 13500],
    ['Staff Salary', 'Monthly payroll', 45000], ['Marketing', 'Instagram Ads', 8000],
    ['Office', 'Office rent', 15000], ['Hotel', 'Pahalgam Retreat', 11200],
    ['Cab/Transport', 'Ladakh Wheels', 22000], ['Other', 'Printing & stationery', 1800],
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
    ['Dal Lake', 'location', PHOTOS.dal], ['Gulmarg', 'location', PHOTOS.gulmarg],
    ['Pahalgam', 'location', PHOTOS.pahalgam], ['Sonamarg', 'location', PHOTOS.sonamarg],
    ['Pangong Lake', 'location', PHOTOS.ladakh], ['Luxury Houseboat', 'hotel', PHOTOS.houseboat],
    ['Hotel Grand Mumtaz', 'hotel', PHOTOS.hotel], ['Khyber Resort', 'hotel', PHOTOS.resort],
  ].map(([tag_name, tag_type, photo_url], i) => ({
    id: `photo-${i + 1}`, photo_url, file_name: `${tag_name.toLowerCase().replace(/\s+/g, '-')}.jpg`, tag_name, tag_type, created_at: ago(60 - i),
  }))

  // ── Audit logs ──
  const audit_logs = [
    ['Administrator', 'Login', 'Logged in as admin', 0],
    ['Riya Sharma', 'Lead Created', 'New lead: Neha Kapoor (Kashmir)', 0],
    ['Riya Sharma', 'Booking Created', 'ST-2026-0001 for Rahul Mehta', 1],
    ['Aman Verma', 'Expense Added', 'Hotel Grand Mumtaz — ₹18,000', 2],
    ['Administrator', 'Invoice Generated', 'INV-2026-101 for Rahul Mehta', 2],
    ['Riya Sharma', 'Lead Stage Changed', 'Karan Singh → Negotiation', 3],
    ['Administrator', 'User Created', 'Aman Verma (Operations)', 5],
    ['Aman Verma', 'Hotel Added', 'The Zen Ladakh, Leh', 6],
  ].map(([actor, action, details, d], i) => ({ id: `log-${i + 1}`, actor, action, details, created_at: ago(d + i * 0.05) }))

  // ── Website packages (site_content) ──
  const webPkg = (i, title, location, img, price, originalPrice, days, category, badge) => ({
    id: i, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, location, state: 'Jammu & Kashmir',
    image: img, gallery: [img], price, originalPrice, duration: `${days - 1}N/${days}D`, days, nights: days - 1,
    groupSize: '2-15', minAge: 5, rating: 4.8, reviews: 40 + i * 12, dates: [dateIn(20), dateIn(35)],
    difficulty: 'Easy', badge, category, overview: `Experience the best of ${location} with our handpicked ${days - 1}-night itinerary.`,
    highlights: ['Shikara ride on Dal Lake', 'Gondola ride in Gulmarg', 'Private cab throughout'],
    itinerary: [], inclusions: ['Hotel stay', 'Breakfast & dinner', 'Sightseeing by private cab'],
    exclusions: ['Airfare', 'Personal expenses'], importantNotes: [], thingsToCarry: ['Warm clothes', 'ID proof'],
  })
  const site_content = [
    { key: 'packages', value: [
      webPkg(1, 'Kashmir Paradise Tour', 'Srinagar, Gulmarg, Pahalgam', PHOTOS.dal, 18999, 24999, 6, 'Kashmir', 'Bestseller'),
      webPkg(2, 'Kashmir Honeymoon Special', 'Srinagar, Gulmarg', PHOTOS.houseboat, 22999, 27999, 5, 'Honeymoon', 'Popular'),
      webPkg(3, 'Leh Ladakh Adventure', 'Leh, Nubra, Pangong', PHOTOS.ladakh, 27999, 32999, 7, 'Ladakh', 'New'),
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
