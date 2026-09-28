-- ═══════════════════════════════════════
-- SHERA TRAVELS — ITINERARY MAKER
-- Supabase SQL Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════

-- 1. PACKAGES TABLE
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  title text,
  sub_title text,
  nights int default 5,
  days int default 6,
  start_location text,
  hero_photo_url text,
  inclusions text[] default '{}',
  exclusions text[] default '{}',
  tc_payment text,
  tc_cancel text,
  tc_notes text,
  company_name text default 'Shera Travels',
  company_addr text default 'Radio Colony, Srinagar, Lawaypora, Srinagar, Jammu and Kashmir 190017',
  company_email text default 'sheratravels21@gmail.com',
  company_phone text default '+91-9149406965, 9858966518',
  company_gst text default '01KODPS7232P1ZE',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. PRICES TABLE
create table if not exists prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id) on delete cascade,
  pax_type text,
  age_limit text,
  price numeric default 0,
  sort_order int default 0
);

-- 3. DAYS TABLE
create table if not exists days (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id) on delete cascade,
  day_number int default 1,
  title text,
  description text,
  distance text,
  hotspots text[] default '{}',
  themes text[] default '{}',
  meals text[] default '{"Stay","Breakfast","Dinner"}',
  accommodation text,
  accom_star int default 3,
  hotel_photo_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 4. DAY PHOTOS TABLE
create table if not exists day_photos (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references days(id) on delete cascade,
  photo_url text not null,
  tag_name text,
  tag_type text,
  slot_index int default 0,
  created_at timestamptz default now()
);

-- 5. PHOTO LIBRARY TABLE
create table if not exists photo_library (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  file_name text,
  tag_name text,
  tag_type text,  -- 'hotel' | 'location'
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- CRM TABLES
-- ═══════════════════════════════════════

-- 6. LEADS TABLE
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  email text,
  destination text,
  travel_date date,
  return_date date,
  adults int default 1,
  children int default 0,
  infants int default 0,
  budget_min numeric,
  budget_max numeric,
  stage text default 'new_inquiry',
  source text default 'whatsapp',
  package_id uuid references packages(id) on delete set null,
  assigned_to text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. LEAD NOTES / TIMELINE TABLE
create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  content text not null,
  type text default 'note',   -- 'note' | 'call' | 'whatsapp' | 'email' | 'stage_change'
  created_at timestamptz default now()
);

alter table leads disable row level security;
alter table lead_notes disable row level security;

-- 8. BOOKINGS TABLE
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text unique,                        -- e.g. ST-2026-0001
  lead_id uuid references leads(id) on delete set null,
  package_id uuid references packages(id) on delete set null,

  -- Customer details (copied from lead at booking time)
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_whatsapp text,

  -- Trip details
  destination text,
  travel_date date,
  return_date date,
  adults int default 1,
  children int default 0,
  infants int default 0,
  nights int default 0,

  -- Amounts
  total_amount numeric default 0,
  advance_percent numeric default 20,
  advance_amount numeric default 0,
  balance_amount numeric default 0,
  paid_amount numeric default 0,

  -- Status: draft | confirmed | advance_paid | balance_due | fully_paid | completed | cancelled
  status text default 'confirmed',

  -- Public form token (for customer self-fill)
  booking_token text unique default gen_random_uuid()::text,

  -- Razorpay
  razorpay_order_id text,
  razorpay_payment_link_id text,
  razorpay_payment_link_url text,

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 9. PAYMENTS TABLE
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  amount numeric not null,
  type text default 'advance',           -- 'advance' | 'balance' | 'full'
  method text default 'razorpay',        -- 'razorpay' | 'cash' | 'bank_transfer' | 'upi'
  razorpay_payment_id text,
  razorpay_order_id text,
  status text default 'success',         -- 'pending' | 'success' | 'failed'
  notes text,
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table bookings disable row level security;
alter table payments disable row level security;

-- ═══════════════════════════════════════
-- RLS POLICIES (Disable for personal use, or set up properly)
-- For a personal tool, you can disable RLS:
-- ═══════════════════════════════════════

-- Option A: Disable RLS (simplest for personal use)
alter table packages disable row level security;
alter table prices disable row level security;
alter table days disable row level security;
alter table day_photos disable row level security;
alter table photo_library disable row level security;

-- ═══════════════════════════════════════
-- MIGRATION: Add company_gst if not already present
-- Run this if you already have the packages table from an older schema
-- ═══════════════════════════════════════
alter table packages add column if not exists company_gst text default '01KODPS7232P1ZE';

-- Update existing rows with the correct address and GST (run only if needed)
-- update packages set company_gst = '01KODPS7232P1ZE' where company_gst is null;
-- update packages set company_addr = 'Radio Colony, Srinagar, Lawaypora, Srinagar, Jammu and Kashmir 190017' where company_addr = 'Budgam, Jammu & Kashmir, India';

-- ═══════════════════════════════════════
-- MIGRATION: Add client_name to packages
-- ═══════════════════════════════════════
alter table packages add column if not exists client_name text;

-- ═══════════════════════════════════════
-- MIGRATION: New modules — Invoices, Hotels, Cabs, Income, Expenses, Audit Logs
-- ═══════════════════════════════════════

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  client_name text not null,
  booking_id uuid references bookings(id) on delete set null,
  amount numeric default 0,
  status text default 'unpaid',          -- 'unpaid' | 'paid' | 'overdue'
  issue_date date default current_date,
  due_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  star_rating int default 3,
  contact_person text,
  phone text,
  email text,
  rate_per_night numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists cabs (
  id uuid primary key default gen_random_uuid(),
  vendor_name text not null,
  vehicle_type text,
  contact_person text,
  phone text,
  rate numeric default 0,
  rate_unit text default 'per day',      -- 'per day' | 'per km' | 'per trip'
  notes text,
  created_at timestamptz default now()
);

create table if not exists income (
  id uuid primary key default gen_random_uuid(),
  date date default current_date,
  source text,
  category text,
  amount numeric default 0,
  booking_id uuid references bookings(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date default current_date,
  category text,
  vendor text,
  amount numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text default 'Administrator',
  action text not null,
  details text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- MIGRATION: Invoice Generator — bill-to details + line items
-- ═══════════════════════════════════════
alter table invoices add column if not exists client_gstin text;
alter table invoices add column if not exists client_address text;
alter table invoices add column if not exists client_phone text;
alter table invoices add column if not exists client_state_code text;
alter table invoices add column if not exists items jsonb default '[]';
alter table invoices add column if not exists subtotal numeric default 0;
alter table invoices add column if not exists tax_amount numeric default 0;

alter table invoices disable row level security;
alter table hotels disable row level security;
alter table cabs disable row level security;
alter table income disable row level security;
alter table expenses disable row level security;
alter table audit_logs disable row level security;

-- ═══════════════════════════════════════
-- MIGRATION: User Management — accounts, roles & per-module permissions
-- ═══════════════════════════════════════

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  role text default 'Staff',              -- free-text label, e.g. "Sales Executive"
  is_admin boolean default false,          -- admins always have full, unrestricted access
  permissions jsonb default '{}',          -- { [module_key]: true } — only used when is_admin = false
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table app_users disable row level security;

-- The first login with username "admin" / password "admin123" auto-creates
-- the initial admin account if app_users is empty — no manual insert needed.

-- ═══════════════════════════════════════
-- SITE CONTENT (editable website content)
-- Powers the CRM "Website Content" editor and the public website
-- (travelshera). One row per page, e.g. key = 'about', value = JSON.
-- ═══════════════════════════════════════

create table if not exists site_content (
  key text primary key,             -- page/section key, e.g. 'about'
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table site_content disable row level security;

-- ═══════════════════════════════════════
-- STORAGE BUCKET
-- Create manually in Supabase Dashboard:
-- Storage → New Bucket → Name: "itinerary-photos" → Public: YES
-- ═══════════════════════════════════════
