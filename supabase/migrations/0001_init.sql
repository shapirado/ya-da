-- Ya-Da initial schema
-- Six tables per spec Data model section.

create extension if not exists "pgcrypto";

create table if not exists class_groups (
  id uuid primary key default gen_random_uuid(),
  day text,
  time text,
  color text
);

create table if not exists payers (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  role text,
  phone text,
  email text
);

create table if not exists payer_name_aliases (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references payers(id),
  raw_name text
);

create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  family_name text,
  class_group_id uuid references class_groups(id),
  gender text,
  payer_id uuid references payers(id),
  enrollment_start date,
  active boolean default true
);

create table if not exists child_prices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id),
  amount integer,
  effective_from date
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  external_doc_number text,
  received_at timestamptz,
  source text check (source in ('morning_webhook', 'manual')),
  raw_payload jsonb,
  status text check (status in ('matched', 'needs_review'))
);

create table if not exists receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id),
  child_id uuid references children(id),
  month date,
  amount integer,
  payer_id uuid references payers(id)
);
