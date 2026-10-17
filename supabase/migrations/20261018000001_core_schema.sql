-- =============================================================================
-- Gym Manager — 001 core schema
-- Tables, constraints, indexes, sequences and timestamp triggers.
-- Single-gym system: one owner (plus optional staff), one settings row.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles: who may use the system. A Supabase Auth user WITHOUT a row here
-- (or with is_active = false) has no access to any gym data.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  role        text not null default 'staff' check (role in ('owner', 'staff')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Gym settings: exactly one row (id = 1).
-- -----------------------------------------------------------------------------
create table public.gym_settings (
  id                  smallint primary key default 1 check (id = 1),
  gym_name            text not null default 'Gym Manager'
                        check (char_length(btrim(gym_name)) between 1 and 120),
  contact_phone       text check (contact_phone is null or char_length(contact_phone) <= 30),
  email               text check (email is null or char_length(email) <= 254),
  address             text check (address is null or char_length(address) <= 300),
  currency            text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  timezone            text not null default 'Asia/Karachi',
  expiry_warning_days integer not null default 7 check (expiry_warning_days between 1 and 60),
  receipt_footer      text check (receipt_footer is null or char_length(receipt_footer) <= 300),
  logo_path           text,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users (id) on delete set null
);

create or replace function public.validate_gym_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  new.gym_name := btrim(new.gym_name);
  return new;
end;
$$;

create trigger gym_settings_validate
  before insert or update on public.gym_settings
  for each row execute function public.validate_gym_settings();

create trigger gym_settings_set_updated_at
  before update on public.gym_settings
  for each row execute function public.set_updated_at();

insert into public.gym_settings (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Membership packages
-- -----------------------------------------------------------------------------
create table public.packages (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 80),
  duration_value  integer not null check (duration_value between 1 and 3650),
  duration_unit   text not null check (duration_unit in ('days', 'months')),
  price           numeric(12, 2) not null check (price >= 0 and price <= 100000000),
  description     text check (description is null or char_length(description) <= 500),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint packages_months_range check (duration_unit <> 'months' or duration_value <= 120)
);

create unique index packages_name_unique on public.packages (lower(btrim(name)));
create index packages_active_idx on public.packages (is_active);

create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Trainers
-- -----------------------------------------------------------------------------
create sequence public.trainer_code_seq start 1;

create table public.trainers (
  id              uuid primary key default gen_random_uuid(),
  trainer_code    text not null unique
                    default ('TR-' || lpad(nextval('public.trainer_code_seq')::text, 3, '0')),
  full_name       text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone           text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email           text check (email is null or char_length(email) <= 254),
  specialization  text check (specialization is null or char_length(specialization) <= 120),
  joining_date    date not null default current_date,
  is_active       boolean not null default true,
  notes           text check (notes is null or char_length(notes) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index trainers_name_idx on public.trainers (lower(full_name));
create index trainers_phone_idx on public.trainers (phone);

create trigger trainers_set_updated_at
  before update on public.trainers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Members
-- -----------------------------------------------------------------------------
create sequence public.member_code_seq start 1;

create table public.members (
  id                   uuid primary key default gen_random_uuid(),
  member_code          text not null
                         check (member_code ~ '^[A-Z0-9-]{1,20}$'),
  full_name            text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone                text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email                text check (email is null or char_length(email) <= 254),
  joining_date         date not null,
  notes                text check (notes is null or char_length(notes) <= 1000),
  is_active            boolean not null default true,
  deactivated_at       timestamptz,
  deactivation_reason  text check (deactivation_reason is null or char_length(deactivation_reason) <= 300),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index members_code_unique on public.members (member_code);
create index members_name_idx on public.members (lower(full_name));
create index members_phone_idx on public.members (phone);
create index members_joining_date_idx on public.members (joining_date);
create index members_active_idx on public.members (is_active);

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Memberships: one row per assignment / renewal. History is never overwritten.
-- package_name and price are snapshots taken at assignment time.
-- -----------------------------------------------------------------------------
create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members (id) on delete restrict,
  package_id      uuid references public.packages (id) on delete restrict,
  package_name    text not null,
  duration_value  integer not null check (duration_value > 0),
  duration_unit   text not null check (duration_unit in ('days', 'months')),
  start_date      date not null,
  end_date        date not null,
  price           numeric(12, 2) not null check (price >= 0),
  status          text not null default 'active' check (status in ('active', 'cancelled')),
  cancelled_at    timestamptz,
  cancel_reason   text,
  notes           text check (notes is null or char_length(notes) <= 500),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint memberships_dates_valid check (end_date >= start_date)
);

create index memberships_member_idx on public.memberships (member_id, end_date desc);
create index memberships_package_idx on public.memberships (package_id);
create index memberships_end_date_idx on public.memberships (end_date) where status = 'active';

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fee invoices. amount_paid is maintained ONLY by the payment functions.
-- "Overdue" is derived (due_date < gym today AND balance > 0), never stored.
-- -----------------------------------------------------------------------------
create sequence public.invoice_no_seq start 1;

create table public.fee_invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_no      text not null unique
                    default ('INV-' || lpad(nextval('public.invoice_no_seq')::text, 6, '0')),
  member_id       uuid not null references public.members (id) on delete restrict,
  membership_id   uuid unique references public.memberships (id) on delete restrict,
  description     text not null check (char_length(description) between 1 and 200),
  amount_due      numeric(12, 2) not null check (amount_due > 0),
  amount_paid     numeric(12, 2) not null default 0,
  balance         numeric(12, 2) generated always as (amount_due - amount_paid) stored,
  due_date        date not null,
  status          text not null default 'unpaid'
                    check (status in ('unpaid', 'partially_paid', 'paid', 'void')),
  void_reason     text,
  voided_at       timestamptz,
  voided_by       uuid references auth.users (id) on delete set null,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint fee_invoices_paid_range check (amount_paid >= 0 and amount_paid <= amount_due),
  constraint fee_invoices_status_consistent check (
    status = 'void'
    or (status = 'unpaid' and amount_paid = 0)
    or (status = 'partially_paid' and amount_paid > 0 and amount_paid < amount_due)
    or (status = 'paid' and amount_paid = amount_due)
  )
);

create index fee_invoices_member_idx on public.fee_invoices (member_id);
create index fee_invoices_status_idx on public.fee_invoices (status);
create index fee_invoices_due_date_idx on public.fee_invoices (due_date);
create index fee_invoices_open_idx on public.fee_invoices (due_date)
  where status in ('unpaid', 'partially_paid');

create trigger fee_invoices_set_updated_at
  before update on public.fee_invoices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Payments. Never deleted. Mistakes are corrected by voiding (with a reason).
-- idempotency_key prevents duplicate records from double-clicks / retries.
-- -----------------------------------------------------------------------------
create sequence public.receipt_no_seq start 1;

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  receipt_no       text not null unique
                     default ('RCP-' || lpad(nextval('public.receipt_no_seq')::text, 6, '0')),
  invoice_id       uuid not null references public.fee_invoices (id) on delete restrict,
  member_id        uuid not null references public.members (id) on delete restrict,
  amount           numeric(12, 2) not null check (amount > 0),
  method           text not null
                     check (method in ('cash', 'bank_transfer', 'easypaisa', 'jazzcash', 'other')),
  payment_date     date not null,
  reference        text check (reference is null or char_length(reference) <= 120),
  notes            text check (notes is null or char_length(notes) <= 500),
  idempotency_key  uuid not null unique,
  is_void          boolean not null default false,
  void_reason      text,
  voided_at        timestamptz,
  voided_by        uuid references auth.users (id) on delete set null,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint payments_void_consistent check (
    (is_void and void_reason is not null and voided_at is not null)
    or (not is_void and void_reason is null and voided_at is null)
  )
);

create index payments_invoice_idx on public.payments (invoice_id);
create index payments_member_idx on public.payments (member_id);
create index payments_date_idx on public.payments (payment_date desc);
create index payments_method_idx on public.payments (method);

-- -----------------------------------------------------------------------------
-- Attendance: one row per member per gym day (enforced by unique constraint).
-- -----------------------------------------------------------------------------
create table public.attendance (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.members (id) on delete restrict,
  attendance_date  date not null,
  check_in_at      timestamptz not null default now(),
  check_out_at     timestamptz,
  is_override      boolean not null default false,
  override_reason  text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint attendance_one_per_day unique (member_id, attendance_date),
  constraint attendance_checkout_after_checkin
    check (check_out_at is null or check_out_at >= check_in_at),
  constraint attendance_override_reason
    check (not is_override or (override_reason is not null and char_length(btrim(override_reason)) > 0))
);

create index attendance_date_idx on public.attendance (attendance_date desc);

-- -----------------------------------------------------------------------------
-- Audit trail (append-only).
-- -----------------------------------------------------------------------------
create table public.audit_events (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_created_idx on public.audit_events (created_at desc);
