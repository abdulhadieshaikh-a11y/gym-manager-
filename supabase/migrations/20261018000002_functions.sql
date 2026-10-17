-- =============================================================================
-- Gym Manager — 002 business functions
-- All multi-step / financially important operations run inside these
-- functions so they are atomic and enforced on the server, not the browser.
-- Errors are raised with stable UPPER_SNAKE_CASE messages that the app maps to
-- friendly text.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Authorization helpers
-- -----------------------------------------------------------------------------
create or replace function public.current_gym_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

create or replace function public.is_gym_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create or replace function public.is_gym_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'owner'
  );
$$;

create or replace function public.assert_gym_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_gym_user() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.assert_gym_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_gym_owner() then
    raise exception 'OWNER_ONLY' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- The gym's local calendar day, using the timezone in gym_settings.
create or replace function public.gym_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select s.timezone from public.gym_settings s where s.id = 1), 'Asia/Karachi'))::date;
$$;

-- Inclusive end date: 1 month from 15 Jan = 15 Jan .. 14 Feb; 30 days = start .. start+29.
create or replace function public.compute_end_date(p_start date, p_value integer, p_unit text)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_unit = 'days' then p_start + (p_value - 1)
    else ((p_start + make_interval(months => p_value))::date - 1)
  end;
$$;

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------
create or replace function public.write_audit(
  p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    perform public.write_audit('created', tg_table_name, v_new ->> 'id', jsonb_build_object('record', v_new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(v_new) n
     where n.key not in ('updated_at', 'updated_by')
       and (v_old -> n.key) is distinct from n.value;
    if v_changes <> '{}'::jsonb then
      perform public.write_audit('updated', tg_table_name, v_new ->> 'id', jsonb_build_object('changes', v_changes));
    end if;
    return new;
  else
    v_old := to_jsonb(old);
    perform public.write_audit('deleted', tg_table_name, v_old ->> 'id', jsonb_build_object('record', v_old));
    return old;
  end if;
end;
$$;

create trigger members_audit after insert or update or delete on public.members
  for each row execute function public.audit_row_change();
create trigger packages_audit after insert or update or delete on public.packages
  for each row execute function public.audit_row_change();
create trigger trainers_audit after insert or update or delete on public.trainers
  for each row execute function public.audit_row_change();
create trigger gym_settings_audit after update on public.gym_settings
  for each row execute function public.audit_row_change();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

-- Only the owner may activate / deactivate members (staff may edit details).
create or replace function public.guard_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active then
    if auth.uid() is not null and not public.is_gym_owner() then
      raise exception 'OWNER_ONLY' using errcode = '42501';
    end if;
    if new.is_active then
      new.deactivated_at := null;
      new.deactivation_reason := null;
    else
      new.deactivated_at := coalesce(new.deactivated_at, now());
    end if;
  end if;
  new.member_code := upper(btrim(new.member_code));
  new.full_name := btrim(new.full_name);
  return new;
end;
$$;

create trigger members_guard_update before update on public.members
  for each row execute function public.guard_member_update();

-- -----------------------------------------------------------------------------
-- Invoice totals — recomputed from non-void payments (single source of truth).
-- -----------------------------------------------------------------------------
create or replace function public.refresh_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid numeric(12, 2);
  v_due numeric(12, 2);
  v_status text;
begin
  select amount_due, status into v_due, v_status
    from public.fee_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0) into v_paid
    from public.payments where invoice_id = p_invoice_id and not is_void;

  if v_paid > v_due then
    raise exception 'AMOUNT_EXCEEDS_BALANCE' using errcode = 'P0001';
  end if;

  update public.fee_invoices
     set amount_paid = v_paid,
         status = case
           when v_status = 'void' then 'void'
           when v_paid = 0 then 'unpaid'
           when v_paid >= v_due then 'paid'
           else 'partially_paid'
         end
   where id = p_invoice_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Memberships
-- -----------------------------------------------------------------------------
create or replace function public.assign_membership(
  p_member_id uuid,
  p_package_id uuid,
  p_start_date date,
  p_price numeric default null,
  p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_user();
  v_today date := public.gym_today();
  v_member public.members%rowtype;
  v_pkg public.packages%rowtype;
  v_price numeric(12, 2);
  v_end date;
  v_membership_id uuid;
begin
  select * into v_member from public.members where id = p_member_id for update;
  if not found then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_member.is_active then
    raise exception 'MEMBER_INACTIVE' using errcode = 'P0001';
  end if;

  select * into v_pkg from public.packages where id = p_package_id;
  if not found then
    raise exception 'PACKAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_pkg.is_active then
    raise exception 'PACKAGE_INACTIVE' using errcode = 'P0001';
  end if;

  if p_start_date is null then
    raise exception 'START_DATE_REQUIRED' using errcode = 'P0001';
  end if;
  if p_start_date < v_today - 366 or p_start_date > v_today + 366 then
    raise exception 'START_DATE_OUT_OF_RANGE' using errcode = 'P0001';
  end if;

  v_price := coalesce(p_price, v_pkg.price);
  if v_price < 0 or v_price > 100000000 or round(v_price, 2) <> v_price then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  v_end := public.compute_end_date(p_start_date, v_pkg.duration_value, v_pkg.duration_unit);

  if exists (
    select 1 from public.memberships ms
     where ms.member_id = p_member_id
       and ms.status = 'active'
       and daterange(ms.start_date, ms.end_date, '[]') && daterange(p_start_date, v_end, '[]')
  ) then
    raise exception 'MEMBERSHIP_OVERLAP' using errcode = 'P0001';
  end if;

  insert into public.memberships (
    member_id, package_id, package_name, duration_value, duration_unit,
    start_date, end_date, price, notes, created_by)
  values (
    p_member_id, v_pkg.id, v_pkg.name, v_pkg.duration_value, v_pkg.duration_unit,
    p_start_date, v_end, v_price, nullif(btrim(p_notes), ''), v_uid)
  returning id into v_membership_id;

  if v_price > 0 then
    insert into public.fee_invoices (member_id, membership_id, description, amount_due, due_date, created_by)
    values (
      p_member_id, v_membership_id,
      v_pkg.name || ' (' || to_char(p_start_date, 'DD Mon YYYY') || ' – ' || to_char(v_end, 'DD Mon YYYY') || ')',
      v_price, p_start_date, v_uid);
  end if;

  perform public.write_audit('membership_assigned', 'memberships', v_membership_id::text,
    jsonb_build_object('member_id', p_member_id, 'package', v_pkg.name,
                       'start_date', p_start_date, 'end_date', v_end, 'price', v_price));

  return v_membership_id;
end;
$$;

create or replace function public.cancel_membership(p_membership_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_owner();
  v_ms public.memberships%rowtype;
  v_invoice_id uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_ms from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_ms.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED' using errcode = 'P0001';
  end if;

  select id into v_invoice_id from public.fee_invoices where membership_id = p_membership_id for update;
  if v_invoice_id is not null and exists (
    select 1 from public.payments where invoice_id = v_invoice_id and not is_void) then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;

  update public.memberships
     set status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason)
   where id = p_membership_id;

  if v_invoice_id is not null then
    update public.fee_invoices
       set status = 'void', void_reason = 'Membership cancelled: ' || btrim(p_reason),
           voided_at = now(), voided_by = v_uid
     where id = v_invoice_id and status <> 'void';
  end if;

  perform public.write_audit('membership_cancelled', 'memberships', p_membership_id::text,
    jsonb_build_object('reason', btrim(p_reason), 'member_id', v_ms.member_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Members
-- -----------------------------------------------------------------------------
create or replace function public.create_member(
  p_full_name text,
  p_phone text,
  p_email text,
  p_joining_date date,
  p_notes text,
  p_member_code text default null,
  p_package_id uuid default null,
  p_start_date date default null,
  p_price numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_user();
  v_code text;
  v_id uuid;
begin
  if p_joining_date is null then
    raise exception 'JOINING_DATE_REQUIRED' using errcode = 'P0001';
  end if;

  if p_member_code is not null and btrim(p_member_code) <> '' then
    v_code := upper(btrim(p_member_code));
    if exists (select 1 from public.members where member_code = v_code) then
      raise exception 'DUPLICATE_MEMBER_CODE' using errcode = '23505';
    end if;
  else
    loop
      v_code := 'GM-' || lpad(nextval('public.member_code_seq')::text, 4, '0');
      exit when not exists (select 1 from public.members where member_code = v_code);
    end loop;
  end if;

  insert into public.members (member_code, full_name, phone, email, joining_date, notes, created_by)
  values (v_code, btrim(p_full_name), p_phone, nullif(btrim(p_email), ''), p_joining_date,
          nullif(btrim(p_notes), ''), v_uid)
  returning id into v_id;

  if p_package_id is not null then
    perform public.assign_membership(v_id, p_package_id, coalesce(p_start_date, p_joining_date), p_price, null);
  end if;

  return v_id;
end;
$$;

create or replace function public.set_member_active(p_member_id uuid, p_active boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_owner();
begin
  if not p_active and (p_reason is null or char_length(btrim(p_reason)) < 3) then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update public.members
     set is_active = p_active,
         deactivation_reason = case when p_active then null else btrim(p_reason) end,
         deactivated_at = case when p_active then null else now() end
   where id = p_member_id;
  if not found then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- Permanently delete ONLY a member with no history at all.
create or replace function public.delete_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_owner();
begin
  if exists (select 1 from public.memberships where member_id = p_member_id)
     or exists (select 1 from public.fee_invoices where member_id = p_member_id)
     or exists (select 1 from public.payments where member_id = p_member_id)
     or exists (select 1 from public.attendance where member_id = p_member_id) then
    raise exception 'MEMBER_HAS_HISTORY' using errcode = 'P0001';
  end if;
  delete from public.members where id = p_member_id;
  if not found then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Invoices & payments
-- -----------------------------------------------------------------------------
create or replace function public.create_invoice(
  p_member_id uuid, p_description text, p_amount numeric, p_due_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_user();
  v_id uuid;
begin
  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 or round(p_amount, 2) <> p_amount then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if p_description is null or char_length(btrim(p_description)) = 0 then
    raise exception 'DESCRIPTION_REQUIRED' using errcode = 'P0001';
  end if;
  if p_due_date is null then
    raise exception 'DUE_DATE_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.fee_invoices (member_id, description, amount_due, due_date, created_by)
  values (p_member_id, btrim(p_description), p_amount, p_due_date, v_uid)
  returning id into v_id;

  perform public.write_audit('invoice_created', 'fee_invoices', v_id::text,
    jsonb_build_object('member_id', p_member_id, 'amount', p_amount, 'due_date', p_due_date));
  return v_id;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_owner();
  v_inv public.fee_invoices%rowtype;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_inv from public.fee_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_inv.status = 'void' then
    raise exception 'INVOICE_VOID' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice_id and not is_void) then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;

  update public.fee_invoices
     set status = 'void', void_reason = btrim(p_reason), voided_at = now(), voided_by = v_uid
   where id = p_invoice_id;

  perform public.write_audit('invoice_voided', 'fee_invoices', p_invoice_id::text,
    jsonb_build_object('reason', btrim(p_reason), 'amount_due', v_inv.amount_due));
end;
$$;

create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_payment_date date,
  p_reference text,
  p_notes text,
  p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_user();
  v_today date := public.gym_today();
  v_inv public.fee_invoices%rowtype;
  v_existing uuid;
  v_payment_id uuid;
  v_date date := coalesce(p_payment_date, public.gym_today());
begin
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  -- A retry / double-click with the same key returns the original payment.
  select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_inv from public.fee_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Re-check after acquiring the lock (a concurrent request may have committed).
  select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  if v_inv.status = 'void' then
    raise exception 'INVOICE_VOID' using errcode = 'P0001';
  end if;
  if v_inv.status = 'paid' then
    raise exception 'INVOICE_ALREADY_PAID' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if p_amount > v_inv.balance then
    raise exception 'AMOUNT_EXCEEDS_BALANCE' using errcode = 'P0001';
  end if;
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'easypaisa', 'jazzcash', 'other') then
    raise exception 'INVALID_METHOD' using errcode = 'P0001';
  end if;
  if v_date > v_today then
    raise exception 'PAYMENT_DATE_IN_FUTURE' using errcode = 'P0001';
  end if;
  if v_date < v_today - 366 then
    raise exception 'PAYMENT_DATE_TOO_OLD' using errcode = 'P0001';
  end if;

  insert into public.payments (
    invoice_id, member_id, amount, method, payment_date, reference, notes, idempotency_key, created_by)
  values (
    p_invoice_id, v_inv.member_id, p_amount, p_method, v_date,
    nullif(btrim(p_reference), ''), nullif(btrim(p_notes), ''), p_idempotency_key, v_uid)
  returning id into v_payment_id;

  perform public.refresh_invoice_totals(p_invoice_id);

  perform public.write_audit('payment_recorded', 'payments', v_payment_id::text,
    jsonb_build_object('invoice_id', p_invoice_id, 'member_id', v_inv.member_id,
                       'amount', p_amount, 'method', p_method, 'payment_date', v_date));
  return v_payment_id;
end;
$$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_owner();
  v_pay public.payments%rowtype;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_pay from public.payments where id = p_payment_id;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Lock the invoice first (same order as record_payment) to avoid deadlocks.
  perform 1 from public.fee_invoices where id = v_pay.invoice_id for update;
  select * into v_pay from public.payments where id = p_payment_id for update;

  if v_pay.is_void then
    raise exception 'ALREADY_VOID' using errcode = 'P0001';
  end if;

  update public.payments
     set is_void = true, void_reason = btrim(p_reason), voided_at = now(), voided_by = v_uid
   where id = p_payment_id;

  perform public.refresh_invoice_totals(v_pay.invoice_id);

  perform public.write_audit('payment_voided', 'payments', p_payment_id::text,
    jsonb_build_object('reason', btrim(p_reason), 'amount', v_pay.amount,
                       'invoice_id', v_pay.invoice_id, 'receipt_no', v_pay.receipt_no));
end;
$$;

-- -----------------------------------------------------------------------------
-- Attendance
-- -----------------------------------------------------------------------------
create or replace function public.check_in_member(
  p_member_id uuid, p_override boolean default false, p_override_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_user();
  v_today date := public.gym_today();
  v_member public.members%rowtype;
  v_valid boolean;
  v_is_override boolean := false;
  v_id uuid;
begin
  select * into v_member from public.members where id = p_member_id;
  if not found then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_member.is_active then
    raise exception 'MEMBER_INACTIVE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.attendance where member_id = p_member_id and attendance_date = v_today) then
    raise exception 'ALREADY_CHECKED_IN' using errcode = '23505';
  end if;

  v_valid := exists (
    select 1 from public.memberships ms
     where ms.member_id = p_member_id and ms.status = 'active'
       and v_today between ms.start_date and ms.end_date);

  if not v_valid then
    if not coalesce(p_override, false) then
      raise exception 'MEMBERSHIP_NOT_VALID' using errcode = 'P0001';
    end if;
    if not public.is_gym_owner() then
      raise exception 'OVERRIDE_REQUIRES_OWNER' using errcode = '42501';
    end if;
    if p_override_reason is null or char_length(btrim(p_override_reason)) < 3 then
      raise exception 'OVERRIDE_REASON_REQUIRED' using errcode = 'P0001';
    end if;
    v_is_override := true;
  end if;

  insert into public.attendance (member_id, attendance_date, is_override, override_reason, created_by)
  values (p_member_id, v_today, v_is_override,
          case when v_is_override then btrim(p_override_reason) end, v_uid)
  on conflict (member_id, attendance_date) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'ALREADY_CHECKED_IN' using errcode = '23505';
  end if;

  if v_is_override then
    perform public.write_audit('check_in_override', 'attendance', v_id::text,
      jsonb_build_object('member_id', p_member_id, 'reason', btrim(p_override_reason)));
  end if;
  return v_id;
end;
$$;

create or replace function public.check_out_attendance(p_attendance_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_user();
begin
  update public.attendance set check_out_at = now()
   where id = p_attendance_id and check_out_at is null;
  if not found then
    raise exception 'CHECK_OUT_NOT_POSSIBLE' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.undo_check_in(p_attendance_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_gym_owner();
  v_row public.attendance%rowtype;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  delete from public.attendance where id = p_attendance_id returning * into v_row;
  if not found then
    raise exception 'ATTENDANCE_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.write_audit('check_in_removed', 'attendance', p_attendance_id::text,
    jsonb_build_object('reason', btrim(p_reason), 'record', to_jsonb(v_row)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reporting views (security_invoker => the caller's RLS applies)
-- -----------------------------------------------------------------------------
create or replace view public.member_overview
with (security_invoker = true) as
with t as (
  select public.gym_today() as today,
         coalesce((select s.expiry_warning_days from public.gym_settings s where s.id = 1), 7) as warn_days
)
select
  m.id,
  m.member_code,
  m.full_name,
  m.phone,
  m.email,
  m.joining_date,
  m.notes,
  m.is_active,
  m.deactivated_at,
  m.deactivation_reason,
  m.created_at,
  m.updated_at,
  cur.id            as current_membership_id,
  cur.package_id    as current_package_id,
  coalesce(cur.package_name, lst.package_name) as current_package_name,
  coalesce(cur.start_date, lst.start_date)     as current_start_date,
  coalesce(cur.end_date, lst.end_date)         as current_end_date,
  agg.valid_until,
  agg.next_start,
  case
    when not m.is_active then 'inactive'
    when cur.id is not null then 'active'
    when agg.next_start is not null then 'upcoming'
    when agg.valid_until is not null then 'expired'
    else 'no_membership'
  end as membership_status,
  case when agg.valid_until is null then null else agg.valid_until - t.today end as days_remaining,
  (m.is_active and cur.id is not null and agg.valid_until - t.today <= t.warn_days) as expiring_soon,
  coalesce(fin.outstanding, 0)::numeric(12, 2) as outstanding_balance
from public.members m
cross join t
left join lateral (
  select ms.id, ms.package_id, ms.package_name, ms.start_date, ms.end_date
    from public.memberships ms
   where ms.member_id = m.id and ms.status = 'active'
     and t.today between ms.start_date and ms.end_date
   order by ms.end_date desc
   limit 1
) cur on true
left join lateral (
  select ms.package_name, ms.start_date, ms.end_date
    from public.memberships ms
   where ms.member_id = m.id and ms.status = 'active'
   order by ms.end_date desc
   limit 1
) lst on true
left join lateral (
  select max(ms.end_date) as valid_until,
         min(ms.start_date) filter (where ms.start_date > t.today) as next_start
    from public.memberships ms
   where ms.member_id = m.id and ms.status = 'active'
) agg on true
left join lateral (
  select sum(fi.balance) as outstanding
    from public.fee_invoices fi
   where fi.member_id = m.id and fi.status in ('unpaid', 'partially_paid')
) fin on true;

create or replace view public.invoice_overview
with (security_invoker = true) as
select
  fi.id, fi.invoice_no, fi.member_id, fi.membership_id, fi.description,
  fi.amount_due, fi.amount_paid, fi.balance, fi.due_date, fi.status,
  fi.void_reason, fi.voided_at, fi.created_at, fi.updated_at,
  m.full_name   as member_name,
  m.member_code as member_code,
  m.phone       as member_phone,
  (fi.status in ('unpaid', 'partially_paid') and fi.due_date < public.gym_today()) as is_overdue
from public.fee_invoices fi
join public.members m on m.id = fi.member_id;

create or replace view public.payment_overview
with (security_invoker = true) as
select
  p.id, p.receipt_no, p.invoice_id, p.member_id, p.amount, p.method, p.payment_date,
  p.reference, p.notes, p.is_void, p.void_reason, p.voided_at, p.created_at,
  m.full_name   as member_name,
  m.member_code as member_code,
  m.phone       as member_phone,
  fi.invoice_no as invoice_no,
  fi.description as invoice_description
from public.payments p
join public.members m on m.id = p.member_id
join public.fee_invoices fi on fi.id = p.invoice_id;

create or replace view public.attendance_overview
with (security_invoker = true) as
select
  a.id, a.member_id, a.attendance_date, a.check_in_at, a.check_out_at,
  a.is_override, a.override_reason, a.created_at,
  m.full_name   as member_name,
  m.member_code as member_code,
  m.phone       as member_phone
from public.attendance a
join public.members m on m.id = a.member_id;

-- -----------------------------------------------------------------------------
-- Dashboard
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_month_start date;
  v_result jsonb;
begin
  perform public.assert_gym_user();
  v_today := public.gym_today();
  v_month_start := date_trunc('month', v_today)::date;

  with mo as (select membership_status, expiring_soon from public.member_overview)
  select jsonb_build_object(
    'today', v_today,
    'month_start', v_month_start,
    'total_members', (select count(*) from mo),
    'active_members', (select count(*) from mo where membership_status = 'active'),
    'inactive_members', (select count(*) from mo where membership_status = 'inactive'),
    'expired_members', (select count(*) from mo where membership_status = 'expired'),
    'no_membership_members', (select count(*) from mo where membership_status in ('no_membership', 'upcoming')),
    'expiring_soon', (select count(*) from mo where expiring_soon),
    'attendance_today', (select count(*) from public.attendance where attendance_date = v_today),
    'fees_today', (select coalesce(sum(amount), 0) from public.payments
                    where not is_void and payment_date = v_today),
    'fees_month', (select coalesce(sum(amount), 0) from public.payments
                    where not is_void and payment_date between v_month_start and v_today),
    'outstanding_total', (select coalesce(sum(balance), 0) from public.fee_invoices
                           where status in ('unpaid', 'partially_paid')),
    'overdue_total', (select coalesce(sum(balance), 0) from public.fee_invoices
                       where status in ('unpaid', 'partially_paid') and due_date < v_today),
    'open_invoices', (select count(*) from public.fee_invoices
                       where status in ('unpaid', 'partially_paid'))
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.dashboard_trends(p_months integer default 12, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_first_month date;
  v_months integer := least(greatest(coalesce(p_months, 12), 1), 36);
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 120);
  v_result jsonb;
begin
  perform public.assert_gym_user();
  v_today := public.gym_today();
  v_first_month := (date_trunc('month', v_today) - make_interval(months => v_months - 1))::date;

  select jsonb_build_object(
    'collections', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(mon, 'YYYY-MM'), 'total', coalesce(tot, 0)) order by mon), '[]'::jsonb)
        from (
          select g.mon::date as mon,
                 (select sum(p.amount) from public.payments p
                   where not p.is_void
                     and p.payment_date >= g.mon::date
                     and p.payment_date < (g.mon + interval '1 month')::date) as tot
            from generate_series(v_first_month, date_trunc('month', v_today)::date, interval '1 month') g(mon)
        ) s
    ),
    'member_growth', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(mon, 'YYYY-MM'), 'new_members', new_members, 'total_members', total_members) order by mon), '[]'::jsonb)
        from (
          select g.mon::date as mon,
                 (select count(*) from public.members m
                   where m.joining_date >= g.mon::date
                     and m.joining_date < (g.mon + interval '1 month')::date) as new_members,
                 (select count(*) from public.members m
                   where m.joining_date < (g.mon + interval '1 month')::date) as total_members
            from generate_series(v_first_month, date_trunc('month', v_today)::date, interval '1 month') g(mon)
        ) s
    ),
    'attendance', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', c) order by d), '[]'::jsonb)
        from (
          select g.d::date as d,
                 (select count(*) from public.attendance a where a.attendance_date = g.d::date) as c
            from generate_series(v_today - (v_days - 1), v_today, interval '1 day') g(d)
        ) s
    )
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin-only: grant a Supabase Auth user access to the gym.
-- Run from the Supabase SQL editor (NOT callable from the app).
--   select public.grant_gym_access('owner@example.com', 'owner', 'Owner Name');
-- -----------------------------------------------------------------------------
create or replace function public.grant_gym_access(p_email text, p_role text default 'owner', p_full_name text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_role not in ('owner', 'staff') then
    raise exception 'Role must be owner or staff';
  end if;
  select id into v_user_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_user_id is null then
    raise exception 'No Supabase Auth user with email %. Create the user first (Authentication > Users > Add user).', p_email;
  end if;
  insert into public.profiles (id, full_name, role, is_active)
  values (v_user_id, coalesce(p_full_name, ''), p_role, true)
  on conflict (id) do update
    set role = excluded.role,
        full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
        is_active = true;
  return v_user_id;
end;
$$;

create or replace function public.revoke_gym_access(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p set is_active = false
    from auth.users u
   where u.id = p.id and lower(u.email) = lower(btrim(p_email));
end;
$$;
