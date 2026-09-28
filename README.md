# Dayare Haram CRM

CRM for **Dayare Haram Hajj Umrah Tours Pvt Ltd** — leads, bookings, Umrah/Hajj itineraries, invoices, payments and reports (React + Vite).

Brand name, logo, contact, GST and bank details live in `src/lib/brand.js`.

## Run

```bash
npm install
npm run dev
```

## Demo mode

Without Supabase credentials the app runs in **demo mode**: all data lives in
the browser's localStorage and is pre-seeded with sample leads, bookings,
Umrah/Hajj itineraries, invoices, Makkah & Madinah hotels, transport, income, expenses and more
(`src/lib/demoData.js`).

Demo logins:

| User  | Password | Access |
|-------|----------|--------|
| admin | admin123 | Full admin |
| sales | demo123  | Leads, Bookings, Itinerary, Invoices |
| imran | demo123  | Bookings, Hotels, Cabs, Photos, Expenses |

Settings → **Reset Demo Data** restores the original sample data.

## Going live (Supabase)

1. Run `supabase-schema.sql` in the Supabase SQL editor.
2. Create a `.env` file:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_RAZORPAY_KEY_ID=...
```
