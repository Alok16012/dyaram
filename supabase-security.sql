-- ════════════════════════════════════════════════════════════════════════
-- Access control: Supabase Auth login + row level security per CRM module.
-- Run AFTER supabase-schema.sql and supabase-whatsapp.sql.
--
-- Every CRM user is a Supabase Auth user linked to an app_users row
-- (app_users.auth_id). The module checkboxes in Users & Roles
-- (app_users.permissions) are enforced here, in the database, so a user
-- can only read/write the tables of the modules they were given — even
-- if they bypass the UI. Admins (is_admin) can do everything.
-- Users are created/edited through the `admin-users` edge function.
-- ════════════════════════════════════════════════════════════════════════

alter table app_users add column if not exists auth_id uuid unique references auth.users(id) on delete set null;
alter table app_users alter column password_hash drop not null;

-- ── Permission helpers (security definer so they can read app_users) ─────
create or replace function public.is_app_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users where auth_id = auth.uid() and active is not false)
$$;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from app_users where auth_id = auth.uid() and active is not false limit 1), false)
$$;

-- has_perm('leads', 'bookings') → true if the user is admin or has ANY of the modules.
create or replace function public.has_perm(variadic modules text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select u.is_admin or exists (select 1 from unnest(modules) m where u.permissions ->> m = 'true')
    from app_users u
    where u.auth_id = auth.uid() and u.active is not false
    limit 1
  ), false)
$$;

revoke all on function public.is_app_user(), public.is_app_admin(), public.has_perm(text[]) from public, anon;
grant execute on function public.is_app_user(), public.is_app_admin(), public.has_perm(text[]) to authenticated;

-- ── Turn on RLS everywhere ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'packages','prices','days','day_photos','photo_library','leads','lead_notes','bookings','payments',
    'invoices','hotels','cabs','income','expenses','audit_logs','app_users','site_content',
    'wa_campaigns','wa_messages','wa_automations','wa_sessions'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Helper to (re)create a policy idempotently.
create or replace function pg_temp.pol(tbl text, name text, cmd text, expr text) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on %I', name, tbl);
  if cmd = 'insert' then
    execute format('create policy %I on %I for insert to authenticated with check (%s)', name, tbl, expr);
  elsif cmd = 'all' then
    execute format('create policy %I on %I for all to authenticated using (%s) with check (%s)', name, tbl, expr, expr);
  else
    execute format('create policy %I on %I for %s to authenticated using (%s)', name, tbl, cmd, expr);
  end if;
end $$;

-- Itineraries (packages are also read by bookings / invoices / leads screens)
select pg_temp.pol('packages',   'packages_rw',   'all',    $p$has_perm('itinerary','admin')$p$);
select pg_temp.pol('packages',   'packages_read', 'select', $p$has_perm('bookings','invoices','leads')$p$);
select pg_temp.pol('prices',     'prices_rw',     'all',    $p$has_perm('itinerary','admin')$p$);
select pg_temp.pol('prices',     'prices_read',   'select', $p$has_perm('bookings','invoices','leads')$p$);
select pg_temp.pol('days',       'days_rw',       'all',    $p$has_perm('itinerary','admin')$p$);
select pg_temp.pol('days',       'days_read',     'select', $p$has_perm('bookings','invoices','leads')$p$);
select pg_temp.pol('day_photos', 'day_photos_rw', 'all',    $p$has_perm('itinerary','admin')$p$);
select pg_temp.pol('photo_library', 'photo_library_rw', 'all', $p$has_perm('itinerary','photos')$p$);

-- Leads (bookings staff move the lead stage when converting)
select pg_temp.pol('leads',      'leads_rw',      'all',    $p$has_perm('leads','bookings')$p$);
select pg_temp.pol('leads',      'leads_read',    'select', $p$has_perm('customers','whatsapp','itinerary')$p$);
select pg_temp.pol('lead_notes', 'lead_notes_rw', 'all',    $p$has_perm('leads','whatsapp')$p$);

-- Bookings
select pg_temp.pol('bookings', 'bookings_rw',     'all',    $p$has_perm('bookings')$p$);
select pg_temp.pol('bookings', 'bookings_read',   'select', $p$has_perm('leads','customers','payments','whatsapp','invoices')$p$);
select pg_temp.pol('bookings', 'bookings_convert','insert', $p$has_perm('leads')$p$);
select pg_temp.pol('bookings', 'bookings_pay',    'update', $p$has_perm('payments')$p$);

-- Payments (revenue on the dashboard / Income needs read access)
select pg_temp.pol('payments', 'payments_rw',   'all',    $p$has_perm('bookings','payments')$p$);
select pg_temp.pol('payments', 'payments_read', 'select', $p$has_perm('income')$p$);

-- One module each
select pg_temp.pol('invoices', 'invoices_rw', 'all', $p$has_perm('invoices')$p$);
select pg_temp.pol('hotels',   'hotels_rw',   'all', $p$has_perm('hotels')$p$);
select pg_temp.pol('cabs',     'cabs_rw',     'all', $p$has_perm('cabs')$p$);
select pg_temp.pol('income',   'income_rw',   'all', $p$has_perm('income')$p$);
select pg_temp.pol('expenses', 'expenses_rw', 'all', $p$has_perm('expenses')$p$);
select pg_temp.pol('expenses', 'expenses_read', 'select', $p$has_perm('income')$p$);

-- Audit log: anyone signed in can write entries, only Audit Logs users read them
select pg_temp.pol('audit_logs', 'audit_logs_read',  'select', $p$has_perm('audit_logs')$p$);
select pg_temp.pol('audit_logs', 'audit_logs_write', 'insert', $p$is_app_user()$p$);

-- Team list is visible to colleagues (names for "assigned to"); only admins edit
select pg_temp.pol('app_users', 'app_users_read',  'select', $p$is_app_user()$p$);
select pg_temp.pol('app_users', 'app_users_admin', 'all',    $p$is_app_admin()$p$);

-- Website content: public read (for the website), admins edit
drop policy if exists site_content_public on site_content;
create policy site_content_public on site_content for select to anon, authenticated using (true);
select pg_temp.pol('site_content', 'site_content_admin', 'all', $p$is_app_admin()$p$);

-- WhatsApp module
select pg_temp.pol('wa_campaigns',   'wa_campaigns_rw',   'all', $p$has_perm('whatsapp')$p$);
select pg_temp.pol('wa_messages',    'wa_messages_rw',    'all', $p$has_perm('whatsapp')$p$);
select pg_temp.pol('wa_automations', 'wa_automations_rw', 'all', $p$has_perm('whatsapp')$p$);
select pg_temp.pol('wa_sessions',    'wa_sessions_rw',    'all', $p$has_perm('whatsapp')$p$);
-- Views run as their owner by default, which would skip RLS.
alter view wa_campaign_stats set (security_invoker = true);

-- ── Public customer booking form (/booking/form/:token) ──────────────────
-- Customers aren't logged in, so they get two narrow functions instead of
-- table access: read one booking by its secret token, and update only
-- their own contact / traveller details.
create or replace function public.public_booking(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select (to_jsonb(b) - 'notes' - 'razorpay_order_id' - 'razorpay_payment_link_id') || jsonb_build_object(
    'packages', (select jsonb_build_object('title', p.title, 'nights', p.nights, 'days', p.days,
                                           'company_name', p.company_name, 'company_phone', p.company_phone)
                 from packages p where p.id = b.package_id))
  from bookings b
  where b.booking_token = p_token and length(p_token) >= 20
$$;

create or replace function public.public_update_booking(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  update bookings set
    customer_name     = coalesce(nullif(trim(p ->> 'customer_name'), ''), customer_name),
    customer_email    = coalesce(nullif(trim(p ->> 'customer_email'), ''), customer_email),
    customer_phone    = coalesce(nullif(trim(p ->> 'customer_phone'), ''), customer_phone),
    customer_whatsapp = coalesce(nullif(trim(p ->> 'customer_whatsapp'), ''), customer_whatsapp),
    adults   = greatest(1, least(99, coalesce(nullif(p ->> 'adults', '')::int, adults))),
    children = greatest(0, least(99, coalesce(nullif(p ->> 'children', '')::int, children))),
    infants  = greatest(0, least(99, coalesce(nullif(p ->> 'infants', '')::int, infants))),
    travel_date = coalesce(nullif(p ->> 'travel_date', '')::date, travel_date),
    return_date = coalesce(nullif(p ->> 'return_date', '')::date, return_date),
    updated_at = now()
  where booking_token = p_token;
  if not found then return null; end if;
  return public_booking(p_token);
end $$;

revoke all on function public.public_booking(text), public.public_update_booking(text, jsonb) from public;
grant execute on function public.public_booking(text), public.public_update_booking(text, jsonb) to anon, authenticated;
