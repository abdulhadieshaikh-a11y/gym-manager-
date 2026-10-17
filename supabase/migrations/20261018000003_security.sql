-- =============================================================================
-- Gym Manager — 003 security: privileges + Row Level Security
--
-- Model:
--   * anon (not logged in)          -> no access to anything.
--   * authenticated WITHOUT profile -> no access (being logged in is not enough).
--   * staff  (active profile)       -> read everything, add/edit members,
--                                      assign memberships, record payments,
--                                      check members in/out.
--   * owner  (active profile)       -> everything staff can do, plus packages,
--                                      trainers, settings, voids/corrections,
--                                      deactivation, attendance overrides.
-- Financial tables have NO direct write privileges; changes go only through
-- the SECURITY DEFINER functions in migration 002, which check the role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table privileges (RLS does not cover TRUNCATE, so revoke broadly first)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.profiles, public.gym_settings, public.packages, public.trainers,
  public.members, public.memberships, public.fee_invoices, public.payments,
  public.attendance, public.audit_events,
  public.member_overview, public.invoice_overview, public.payment_overview,
  public.attendance_overview
to authenticated;

grant update (gym_name, contact_phone, email, address, currency, timezone,
              expiry_warning_days, receipt_footer, logo_path, updated_by)
  on public.gym_settings to authenticated;
grant insert, update on public.packages to authenticated;
grant insert, update on public.trainers to authenticated;
grant usage on sequence public.trainer_code_seq to authenticated;
grant update (full_name, phone, email, joining_date, notes, member_code)
  on public.members to authenticated;

-- -----------------------------------------------------------------------------
-- Function privileges: nothing is executable by anon; only the listed
-- functions are executable by logged-in users (each one re-checks the role).
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.current_gym_role(),
  public.is_gym_user(),
  public.is_gym_owner(),
  public.gym_today(),
  public.compute_end_date(date, integer, text),
  public.assign_membership(uuid, uuid, date, numeric, text),
  public.cancel_membership(uuid, text),
  public.create_member(text, text, text, date, text, text, uuid, date, numeric),
  public.set_member_active(uuid, boolean, text),
  public.delete_member(uuid),
  public.create_invoice(uuid, text, numeric, date),
  public.void_invoice(uuid, text),
  public.record_payment(uuid, numeric, text, date, text, text, uuid),
  public.void_payment(uuid, text),
  public.check_in_member(uuid, boolean, text),
  public.check_out_attendance(uuid),
  public.undo_check_in(uuid, text),
  public.dashboard_summary(),
  public.dashboard_trends(integer, integer)
to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.gym_settings  enable row level security;
alter table public.packages      enable row level security;
alter table public.trainers      enable row level security;
alter table public.members       enable row level security;
alter table public.memberships   enable row level security;
alter table public.fee_invoices  enable row level security;
alter table public.payments      enable row level security;
alter table public.attendance    enable row level security;
alter table public.audit_events  enable row level security;

-- profiles: see your own profile; the owner can see everyone's.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_gym_owner()));

-- gym_settings
create policy gym_settings_select on public.gym_settings
  for select to authenticated
  using ((select public.is_gym_user()));
create policy gym_settings_update on public.gym_settings
  for update to authenticated
  using ((select public.is_gym_owner()))
  with check ((select public.is_gym_owner()));

-- packages (owner manages, everyone with access can read)
create policy packages_select on public.packages
  for select to authenticated
  using ((select public.is_gym_user()));
create policy packages_insert on public.packages
  for insert to authenticated
  with check ((select public.is_gym_owner()));
create policy packages_update on public.packages
  for update to authenticated
  using ((select public.is_gym_owner()))
  with check ((select public.is_gym_owner()));

-- trainers
create policy trainers_select on public.trainers
  for select to authenticated
  using ((select public.is_gym_user()));
create policy trainers_insert on public.trainers
  for insert to authenticated
  with check ((select public.is_gym_owner()));
create policy trainers_update on public.trainers
  for update to authenticated
  using ((select public.is_gym_owner()))
  with check ((select public.is_gym_owner()));

-- members: read + edit details for gym users. Create/delete/(de)activate go
-- through functions; is_active changes are also guarded by a trigger.
create policy members_select on public.members
  for select to authenticated
  using ((select public.is_gym_user()));
create policy members_update on public.members
  for update to authenticated
  using ((select public.is_gym_user()))
  with check ((select public.is_gym_user()));

-- financial + attendance tables: read-only for gym users.
create policy memberships_select on public.memberships
  for select to authenticated
  using ((select public.is_gym_user()));
create policy fee_invoices_select on public.fee_invoices
  for select to authenticated
  using ((select public.is_gym_user()));
create policy payments_select on public.payments
  for select to authenticated
  using ((select public.is_gym_user()));
create policy attendance_select on public.attendance
  for select to authenticated
  using ((select public.is_gym_user()));

-- audit trail: owner only.
create policy audit_events_select on public.audit_events
  for select to authenticated
  using ((select public.is_gym_owner()));
