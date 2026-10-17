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

## WhatsApp (bulk campaigns + enquiry automation)

The **WhatsApp** page (sidebar → Marketing) uses Meta's official **WhatsApp Cloud API**:

- **Bulk Send** — pick leads (by stage / source / package / date), booked customers or pasted numbers, choose an approved template, map its variables (first name, package, travel date, fixed text), send a test, then send to everyone with live progress. Invalid, duplicate and opted-out numbers are skipped.
- **Campaigns** — sent / delivered / read / failed per campaign, with per-number errors.
- **Automation**
  - *Instant reply*: anyone who messages your WhatsApp number gets an automatic reply and is added to Leads (source WhatsApp, stage New Inquiry). Later messages are added to the lead's notes.
  - *Welcome new leads*: every new lead (website form, CRM, import) gets a welcome template.
  - Replies of `STOP` / `START` opt a number out of / back into messages.
- **Messages** — log of all incoming and outgoing messages.

The Meta token never reaches the browser: it lives in two Supabase Edge Functions (`supabase/functions/`). In demo mode everything is simulated.

### WhatsApp setup

1. Meta side (see WhatsApp → Setup in the app for the click-by-click list): create a Business app with the WhatsApp product, verify your number, create a **System User** token with `whatsapp_business_messaging` + `whatsapp_business_management`, note the *Phone number ID*, *WhatsApp Business Account ID* and *App secret*.
2. Edit the bottom of `supabase-whatsapp.sql` (replace `<PROJECT_REF>` and `<AUTOMATION_SECRET>`), then run it in the Supabase SQL editor.
3. Deploy the functions and set secrets (Supabase CLI, from this folder):

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_WABA_ID=... WHATSAPP_APP_SECRET=... WHATSAPP_VERIFY_TOKEN=<any-text> WA_AUTOMATION_SECRET=<same-as-in-sql>
supabase functions deploy whatsapp
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

4. Meta → WhatsApp → Configuration → Webhook: callback URL `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, then subscribe to **messages**.
5. Create templates in WhatsApp Manager; approved ones show up in the CRM automatically.

Non-admin users need the **WhatsApp** permission (Users & Roles) to use the page.
