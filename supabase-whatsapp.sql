-- ════════════════════════════════════════════════════════════════════════
-- WhatsApp (Meta Cloud API) — bulk campaigns, message log & enquiry automation
-- Run this in the Supabase SQL editor AFTER supabase-schema.sql.
-- Then follow "WhatsApp setup" in README.md to deploy the edge functions.
-- ════════════════════════════════════════════════════════════════════════

-- 1. LEADS: normalised phone key (last 10 digits) + WhatsApp opt-out flag.
--    phone_key is kept in sync by a trigger (not a generated column) so the
--    CRM can keep sending whole lead objects in updates without errors.
alter table leads add column if not exists phone_key text;
alter table leads add column if not exists wa_opt_out boolean default false;
create index if not exists leads_phone_key_idx on leads (phone_key);

create or replace function leads_set_phone_key() returns trigger language plpgsql as $$
begin
  new.phone_key := nullif(right(regexp_replace(coalesce(nullif(new.whatsapp, ''), new.phone, ''), '\D', '', 'g'), 10), '');
  return new;
end $$;

drop trigger if exists leads_phone_key on leads;
create trigger leads_phone_key before insert or update on leads
  for each row execute function leads_set_phone_key();

-- Backfill existing rows
update leads set phone_key = nullif(right(regexp_replace(coalesce(nullif(whatsapp, ''), phone, ''), '\D', '', 'g'), 10), '');

-- 2. CAMPAIGNS (one row per bulk send)
create table if not exists wa_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_name text not null,
  template_language text default 'en',
  audience jsonb default '{}',          -- filters used to build the recipient list
  total int default 0,
  status text default 'sending',        -- sending | completed | stopped
  created_by text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- 3. MESSAGES (every inbound + outbound WhatsApp message)
create table if not exists wa_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null,              -- 'out' | 'in'
  phone text not null,                  -- full international number, digits only
  lead_id uuid references leads(id) on delete set null,
  campaign_id uuid references wa_campaigns(id) on delete set null,
  kind text default 'template',         -- template | text | auto_reply | welcome | inbound | bot
  template_name text,
  body text,
  wa_message_id text unique,            -- Meta's message id (wamid.…)
  status text default 'queued',         -- queued | sent | delivered | read | failed | received
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists wa_messages_campaign_idx on wa_messages (campaign_id);
create index if not exists wa_messages_phone_idx on wa_messages (phone, created_at desc);

-- 4. AUTOMATION SETTINGS (key → jsonb config)
create table if not exists wa_automations (
  key text primary key,                 -- 'inbound_auto_reply' | 'new_lead_welcome' | 'menu_bot'
  enabled boolean default false,
  config jsonb default '{}',
  updated_at timestamptz default now()
);

-- 4b. MENU-BOT CONVERSATION STATE (one row per WhatsApp number)
create table if not exists wa_sessions (
  phone text primary key,               -- full international number, digits only
  lead_id uuid references leads(id) on delete set null,
  node text,                            -- bot step waiting for an answer
  status text default 'bot',            -- bot | agent (staff handling) | done
  data jsonb default '{}',              -- answers collected so far
  retries int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Per-campaign delivery counts for the Campaigns screen.
create or replace view wa_campaign_stats as
select campaign_id,
  count(*) filter (where status <> 'failed')                 as sent,
  count(*) filter (where status in ('delivered', 'read'))    as delivered,
  count(*) filter (where status = 'read')                    as read,
  count(*) filter (where status = 'failed')                  as failed
from wa_messages
where campaign_id is not null
group by campaign_id;

-- Same access model as the rest of this CRM (RLS off, app handles auth).
alter table wa_campaigns   disable row level security;
alter table wa_messages    disable row level security;
alter table wa_automations disable row level security;
alter table wa_sessions    disable row level security;

-- 5. NEW-LEAD AUTOMATION TRIGGER
--    Every new lead (CRM form, website form, import…) pings the webhook
--    function, which sends the welcome template if that automation is on.
--    Replace the two placeholders before running:
--      <PROJECT_REF>        → your Supabase project ref (from the project URL)
--      <AUTOMATION_SECRET>  → same value as the WA_AUTOMATION_SECRET function secret
create extension if not exists pg_net;

create or replace function notify_whatsapp_new_lead() returns trigger
language plpgsql security definer as $$
begin
  perform net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook?event=lead_created',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', '<AUTOMATION_SECRET>'
    ),
    body    := jsonb_build_object('lead_id', new.id)
  );
  return new;
end $$;

drop trigger if exists leads_whatsapp_welcome on leads;
create trigger leads_whatsapp_welcome after insert on leads
  for each row execute function notify_whatsapp_new_lead();
