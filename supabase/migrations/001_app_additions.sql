-- Additions the app needs on top of the existing schema. Safe to run more than once.

-- How much of each monthly/camp charge has been paid (for partial payments).
alter table public.child_activity add column if not exists paid_amount numeric not null default 0;
update public.child_activity
   set paid_amount = coalesce(price, (select default_price from public.activities a where a.id = activity_id), 0)
 where payment_status = 'paid' and paid_amount = 0;

-- One row per processed screenshot / receipt.
create table if not exists public.payment_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  paid_at date,
  payer_id uuid references public.temp_parents(morning_customer_id),
  raw_name text,
  amount numeric not null,
  method text,
  note text,
  reference text,
  morning_document_id text,
  morning_document_number text,
  morning_document_url text,
  allocations jsonb
);

-- When a WhatsApp reminder was opened for a payer.
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null,
  sent_at timestamptz not null default now(),
  total numeric,
  message text
);

-- The settings row the app reads (prices are set from the Activities screen).
insert into public.settings (id) values ('default') on conflict (id) do nothing;

-- Aliases point at a Morning customer.
create index if not exists payer_name_aliases_payer_idx on public.payer_name_aliases(payer_id);
create unique index if not exists payer_name_aliases_unique on public.payer_name_aliases(payer_id, raw_name);
