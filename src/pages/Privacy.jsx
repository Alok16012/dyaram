// Public privacy policy (linked from the Meta / WhatsApp app settings).
import { BRAND } from '../lib/brand'

const UPDATED = '5 November 2026'

const S = {
  page: { minHeight: '100vh', background: '#F6F8FA', padding: '32px 16px', fontFamily: 'Poppins, system-ui, sans-serif', color: '#334155' },
  card: { maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 12, padding: '32px 28px', boxShadow: '0 1px 2px rgba(16,24,40,.06)', lineHeight: 1.7, fontSize: 15 },
  h1: { color: '#0D2A7D', fontSize: 26, margin: '12px 0 4px' },
  h2: { color: '#0F172A', fontSize: 18, margin: '26px 0 6px' },
  muted: { color: '#64748B', fontSize: 13 },
}

export default function Privacy() {
  return (
    <div style={S.page}>
      <article style={S.card}>
        <img src={BRAND.logo} alt={BRAND.legalName} style={{ height: 56 }} />
        <h1 style={S.h1}>Privacy Policy</h1>
        <div style={S.muted}>{BRAND.legalName} · Last updated {UPDATED}</div>

        <p>
          This policy explains how {BRAND.legalName} (“we”, “us”) collects, uses and protects personal information when you
          enquire about or book Hajj, Umrah and related travel with us — including when you contact us on WhatsApp, by phone,
          through our website or in person.
        </p>

        <h2 style={S.h2}>Information we collect</h2>
        <ul>
          <li>Contact details: name, phone / WhatsApp number, email address and city.</li>
          <li>Travel details: package of interest, travel dates, number of travellers and preferences you share with us.</li>
          <li>Booking details needed to arrange your trip, such as passport and visa information, when you choose to book.</li>
          <li>Messages you send us on WhatsApp and replies to our automated menu (for example the package or travel time you select).</li>
          <li>Payment records for bookings (we do not store full card numbers; online payments are handled by our payment provider).</li>
        </ul>

        <h2 style={S.h2}>How we use it</h2>
        <ul>
          <li>To answer your enquiry, share itineraries and prices, and manage your booking.</li>
          <li>To send booking confirmations, payment reminders, travel updates and documents.</li>
          <li>To send offers about Hajj and Umrah packages on WhatsApp, only where you have agreed to hear from us.</li>
          <li>To meet legal, tax and visa requirements.</li>
        </ul>

        <h2 style={S.h2}>WhatsApp</h2>
        <p>
          We use the WhatsApp Business Platform (provided by Meta) to send and receive messages. Your WhatsApp number and messages
          are processed by Meta as described in WhatsApp’s own privacy policy. You can reply <b>STOP</b> at any time to stop
          promotional messages, and <b>START</b> to receive them again.
        </p>

        <h2 style={S.h2}>Sharing</h2>
        <p>
          We share information only as needed to deliver your trip — for example with airlines, hotels, transport providers,
          visa authorities and our payment and messaging service providers — or when required by law. We do not sell your data.
        </p>

        <h2 style={S.h2}>Storage and security</h2>
        <p>
          Your information is stored in our secure CRM with access limited to authorised staff. We keep it for as long as needed
          for your booking and our legal and accounting obligations, and then delete it.
        </p>

        <h2 style={S.h2}>Your choices and data deletion</h2>
        <p>
          You can ask us to see, correct or delete your information, or to stop contacting you, by writing to{' '}
          <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>, calling {BRAND.phones[0]}, or messaging us on WhatsApp.
          We will act on deletion requests within 30 days, except for records we must keep by law.
        </p>

        <h2 style={S.h2}>Contact</h2>
        <p>
          {BRAND.legalName}<br />
          {BRAND.address}<br />
          Phone: {BRAND.phone} · Email: <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
        </p>
      </article>
    </div>
  )
}
