-- =============================================================================
-- Database business-rule & security tests.
-- Runs inside one transaction and ROLLS BACK, so it leaves no data behind.
-- Used by scripts/test-db.sh against a local PostgreSQL + _local_supabase_stub.sql.
-- Every check raises an exception on failure (psql ON_ERROR_STOP stops the run).
-- =============================================================================
\set ON_ERROR_STOP 1
begin;

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.expect_error(p_sql text, p_expected text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'Expected error containing "%", got "%" for: %', p_expected, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'Expected error "%" but statement succeeded: %', p_expected, p_sql;
end $$;

create function tests.eq(p_actual anyelement, p_expected anyelement, p_label text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: expected %, got %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok - %', p_label;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
create table tests.ctx (k text primary key, v uuid);
grant all on tests.ctx to anon, authenticated;

-- ---------------------------------------------------------------- setup users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.local');
select public.grant_gym_access('owner@test.local', 'owner', 'Owner');
select public.grant_gym_access('staff@test.local', 'staff', 'Staff');

-- -------------------------------------------------------------- pure helpers
select tests.eq(public.compute_end_date('2026-01-15', 1, 'months'), '2026-02-14'::date, 'monthly end date is inclusive');
select tests.eq(public.compute_end_date('2026-01-31', 1, 'months'), '2026-02-27'::date, 'month-end start clamps like PostgreSQL');
select tests.eq(public.compute_end_date('2026-01-01', 30, 'days'), '2026-01-30'::date, '30-day package');
select tests.eq(public.compute_end_date('2026-01-01', 12, 'months'), '2026-12-31'::date, 'annual package');
select tests.eq(public.compute_end_date('2028-02-29', 1, 'days'), '2028-02-29'::date, '1-day package ends same day');

-- -------------------------------------------------------------------- anon
set local role anon;
select tests.expect_error('select count(*) from public.members', 'permission denied');
select tests.expect_error('select count(*) from public.payments', 'permission denied');
select tests.expect_error($q$select public.create_member('X','03001234567',null,current_date,null)$q$, 'permission denied');
select tests.expect_error('select public.dashboard_summary()', 'permission denied');
reset role;

-- ---------------------------------------------- logged in, but no gym access
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select tests.eq(public.is_gym_user(), false, 'stranger is not a gym user');
select tests.expect_error($q$select public.create_member('X','03001234567',null,current_date,null)$q$, 'NOT_AUTHORIZED');
select tests.expect_error('select public.dashboard_summary()', 'NOT_AUTHORIZED');
select tests.expect_error($q$insert into public.packages (name, duration_value, duration_unit, price) values ('Hack', 1, 'months', 1)$q$, 'row-level security');
select tests.expect_error('select public.grant_gym_access(''stranger@test.local'', ''owner'', '''')', 'permission denied');
select tests.expect_error('truncate public.members', 'permission denied');
reset role;
set local role postgres;

-- ------------------------------------------------------------------- owner
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select tests.eq(public.current_gym_role(), 'owner', 'owner role resolved');

insert into public.packages (name, duration_value, duration_unit, price) values ('Monthly', 1, 'months', 3000);
insert into public.packages (name, duration_value, duration_unit, price) values ('Quarterly', 3, 'months', 8000);
select tests.expect_error($q$insert into public.packages (name, duration_value, duration_unit, price) values (' monthly ', 1, 'months', 10)$q$, 'packages_name_unique');
select tests.expect_error($q$insert into public.packages (name, duration_value, duration_unit, price) values ('Bad', 1, 'months', -5)$q$, 'check constraint');

insert into tests.ctx values ('pkg_monthly', (select id from public.packages where name = 'Monthly'));
insert into tests.ctx values ('pkg_quarterly', (select id from public.packages where name = 'Quarterly'));

-- member with a package (atomic: member + membership + invoice)
insert into tests.ctx values ('m1', public.create_member('Ali Khan', '03001234567', null, public.gym_today(), null,
  null, (select v from tests.ctx where k = 'pkg_monthly'), public.gym_today(), null));
select tests.eq((select member_code ~ '^GM-[0-9]{4,}$' from public.members where id = (select v from tests.ctx where k='m1')), true, 'member code auto-generated');
select tests.eq((select membership_status from public.member_overview where id = (select v from tests.ctx where k='m1')), 'active', 'new member is active');
select tests.eq((select count(*) from public.fee_invoices where member_id = (select v from tests.ctx where k='m1'))::int, 1, 'invoice created with membership');
insert into tests.ctx values ('inv1', (select id from public.fee_invoices where member_id = (select v from tests.ctx where k='m1')));
select tests.eq((select status from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 'unpaid', 'invoice starts unpaid');

-- duplicate member code
select tests.expect_error($q$select public.create_member('Dup', '03007654321', null, current_date, null, (select lower(member_code) from public.members where id = (select v from tests.ctx where k='m1')))$q$, 'DUPLICATE_MEMBER_CODE');

-- package price change does not change history
update public.packages set price = 3500 where name = 'Monthly';
select tests.eq((select price from public.memberships where member_id = (select v from tests.ctx where k='m1')), 3000.00::numeric(12,2), 'membership keeps agreed price');
select tests.eq((select amount_due from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 3000.00::numeric(12,2), 'invoice keeps agreed price');

-- payments: partial, idempotency, overpay, invalid
insert into tests.ctx values ('p1', public.record_payment((select v from tests.ctx where k='inv1'), 1000, 'cash', null, null, null, '11111111-1111-1111-1111-111111111111'));
select tests.eq((select status from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 'partially_paid', 'partial payment -> partially_paid');
select tests.eq((select balance from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 2000.00::numeric(12,2), 'balance after partial');
select tests.eq(public.record_payment((select v from tests.ctx where k='inv1'), 1000, 'cash', null, null, null, '11111111-1111-1111-1111-111111111111'),
                (select v from tests.ctx where k='p1'), 'same idempotency key returns same payment');
select tests.eq((select count(*) from public.payments where invoice_id = (select v from tests.ctx where k='inv1'))::int, 1, 'no duplicate payment row');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), 2000.01, 'cash', null, null, null, gen_random_uuid())$q$, 'AMOUNT_EXCEEDS_BALANCE');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), 0, 'cash', null, null, null, gen_random_uuid())$q$, 'INVALID_AMOUNT');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), -5, 'cash', null, null, null, gen_random_uuid())$q$, 'INVALID_AMOUNT');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), 10.005, 'cash', null, null, null, gen_random_uuid())$q$, 'INVALID_AMOUNT');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), 10, 'bitcoin', null, null, null, gen_random_uuid())$q$, 'INVALID_METHOD');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), 10, 'cash', public.gym_today() + 1, null, null, gen_random_uuid())$q$, 'PAYMENT_DATE_IN_FUTURE');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), 10, 'cash', null, null, null, null)$q$, 'IDEMPOTENCY_KEY_REQUIRED');

-- settle exactly the balance
insert into tests.ctx values ('p2', public.record_payment((select v from tests.ctx where k='inv1'), 2000, 'easypaisa', null, 'TRX-1', null, gen_random_uuid()));
select tests.eq((select status from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 'paid', 'full settlement -> paid');
select tests.eq((select balance from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 0.00::numeric(12,2), 'zero balance when paid');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv1'), 1, 'cash', null, null, null, gen_random_uuid())$q$, 'INVOICE_ALREADY_PAID');

-- direct writes to financial tables are impossible
select tests.expect_error($q$insert into public.payments (invoice_id, member_id, amount, method, payment_date, idempotency_key) values ((select v from tests.ctx where k='inv1'), (select v from tests.ctx where k='m1'), 5, 'cash', current_date, gen_random_uuid())$q$, 'permission denied');
select tests.expect_error($q$update public.fee_invoices set amount_paid = 0$q$, 'permission denied');
select tests.expect_error($q$delete from public.payments$q$, 'permission denied');

-- dashboard before void
select tests.eq((public.dashboard_summary() ->> 'fees_today')::numeric, 3000::numeric, 'fees today = 3000');
reset role;

-- ------------------------------------------------------------------- staff
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select tests.eq(public.current_gym_role(), 'staff', 'staff role resolved');
select tests.expect_error($q$select public.void_payment((select v from tests.ctx where k='p2'), 'mistake')$q$, 'OWNER_ONLY');
select tests.expect_error($q$insert into public.packages (name, duration_value, duration_unit, price) values ('Staff pkg', 1, 'months', 1)$q$, 'row-level security');
update public.gym_settings set gym_name = 'Hacked';  -- RLS silently matches 0 rows
select tests.eq((select count(*) from public.gym_settings where gym_name = 'Hacked')::int, 0, 'staff cannot rename gym');
select tests.expect_error($q$update public.members set is_active = false$q$, 'permission denied');
update public.members set phone = '03111111111' where id = (select v from tests.ctx where k='m1');
select tests.eq((select phone from public.members where id = (select v from tests.ctx where k='m1')), '03111111111', 'staff can edit member details');
select tests.eq((select count(*) from public.audit_events)::int, 0, 'staff cannot read audit log');
-- staff can create members and record payments
insert into tests.ctx values ('m2', public.create_member('Sara Ahmed', '03221234567', 'sara@example.com', public.gym_today(), 'no package yet'));
select tests.expect_error($q$select public.check_in_member((select v from tests.ctx where k='m2'))$q$, 'MEMBERSHIP_NOT_VALID');
select tests.expect_error($q$select public.check_in_member((select v from tests.ctx where k='m2'), true, 'trial day')$q$, 'OVERRIDE_REQUIRES_OWNER');
reset role;

-- ------------------------------------------------------------ owner again
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

-- void a payment with an audit trail
select tests.expect_error($q$select public.void_payment((select v from tests.ctx where k='p2'), '')$q$, 'REASON_REQUIRED');
select public.void_payment((select v from tests.ctx where k='p2'), 'Entered wrong amount');
select tests.eq((select status from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 'partially_paid', 'void returns invoice to partially_paid');
select tests.eq((select balance from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 2000.00::numeric(12,2), 'balance restored after void');
select tests.eq((select count(*) from public.payments)::int, 2, 'voided payment is kept, not deleted');
select tests.eq((select count(*) from public.audit_events where action = 'payment_voided')::int, 1, 'void is audited');
select tests.expect_error($q$select public.void_payment((select v from tests.ctx where k='p2'), 'again')$q$, 'ALREADY_VOID');
select tests.eq((public.dashboard_summary() ->> 'fees_today')::numeric, 1000::numeric, 'voided payment excluded from fees today');

-- attendance
select tests.eq(public.check_in_member((select v from tests.ctx where k='m1')) is not null, true, 'active member checks in');
select tests.expect_error($q$select public.check_in_member((select v from tests.ctx where k='m1'))$q$, 'ALREADY_CHECKED_IN');
select tests.expect_error($q$select public.check_in_member((select v from tests.ctx where k='m2'), true, '')$q$, 'OVERRIDE_REASON_REQUIRED');
select tests.eq(public.check_in_member((select v from tests.ctx where k='m2'), true, 'Trial day approved') is not null, true, 'owner override check-in');
select tests.eq((select is_override from public.attendance where member_id = (select v from tests.ctx where k='m2')), true, 'override recorded');
select tests.eq((public.dashboard_summary() ->> 'attendance_today')::int, 2, 'attendance today = 2');
select public.check_out_attendance((select id from public.attendance where member_id = (select v from tests.ctx where k='m1')));
select tests.expect_error($q$select public.check_out_attendance((select id from public.attendance where member_id = (select v from tests.ctx where k='m1')))$q$, 'CHECK_OUT_NOT_POSSIBLE');

-- renewals & overlap
select tests.expect_error($q$select public.assign_membership((select v from tests.ctx where k='m1'), (select v from tests.ctx where k='pkg_monthly'), public.gym_today())$q$, 'MEMBERSHIP_OVERLAP');
insert into tests.ctx values ('ms_renew', public.assign_membership((select v from tests.ctx where k='m1'), (select v from tests.ctx where k='pkg_quarterly'),
  (select max(end_date) + 1 from public.memberships where member_id = (select v from tests.ctx where k='m1'))));
select tests.eq((select count(*) from public.memberships where member_id = (select v from tests.ctx where k='m1'))::int, 2, 'renewal keeps history');
select tests.eq((select valid_until from public.member_overview where id = (select v from tests.ctx where k='m1')),
                (select end_date from public.memberships where id = (select v from tests.ctx where k='ms_renew')), 'valid_until follows renewal');

-- inactive package cannot be assigned
update public.packages set is_active = false where name = 'Quarterly';
select tests.expect_error($q$select public.assign_membership((select v from tests.ctx where k='m2'), (select v from tests.ctx where k='pkg_quarterly'), public.gym_today())$q$, 'PACKAGE_INACTIVE');

-- expired membership & overdue invoice
select public.assign_membership((select v from tests.ctx where k='m2'), (select v from tests.ctx where k='pkg_monthly'), public.gym_today() - 60, 2500);
select tests.eq((select membership_status from public.member_overview where id = (select v from tests.ctx where k='m2')), 'expired', 'past membership -> expired');
select tests.eq((select is_overdue from public.invoice_overview where member_id = (select v from tests.ctx where k='m2')), true, 'unpaid past-due invoice -> overdue');
select tests.eq((public.dashboard_summary() ->> 'expired_members')::int, 1, 'dashboard counts expired');
select tests.eq((public.dashboard_summary() ->> 'outstanding_total')::numeric, (2000 + 8000 + 2500)::numeric, 'outstanding total');

-- cancel membership with no payments voids its invoice; with payments it is blocked
select tests.expect_error($q$select public.cancel_membership((select membership_id from public.fee_invoices where id = (select v from tests.ctx where k='inv1')), 'wrong package')$q$, 'HAS_PAYMENTS');
select public.cancel_membership((select v from tests.ctx where k='ms_renew'), 'Entered by mistake');
select tests.eq((select status from public.fee_invoices where membership_id = (select v from tests.ctx where k='ms_renew')), 'void', 'cancelled membership voids its invoice');

-- manual invoice + void
insert into tests.ctx values ('inv_manual', public.create_invoice((select v from tests.ctx where k='m2'), 'Admission fee', 1500, public.gym_today()));
select tests.expect_error($q$select public.create_invoice((select v from tests.ctx where k='m2'), 'Bad', 0, public.gym_today())$q$, 'INVALID_AMOUNT');
select public.void_invoice((select v from tests.ctx where k='inv_manual'), 'Waived by owner');
select tests.expect_error($q$select public.record_payment((select v from tests.ctx where k='inv_manual'), 100, 'cash', null, null, null, gen_random_uuid())$q$, 'INVOICE_VOID');

-- deactivation & deletion
select tests.expect_error($q$select public.delete_member((select v from tests.ctx where k='m1'))$q$, 'MEMBER_HAS_HISTORY');
select public.set_member_active((select v from tests.ctx where k='m2'), false, 'Moved away');
select tests.eq((select membership_status from public.member_overview where id = (select v from tests.ctx where k='m2')), 'inactive', 'deactivated member -> inactive');
select tests.expect_error($q$select public.assign_membership((select v from tests.ctx where k='m2'), (select v from tests.ctx where k='pkg_monthly'), public.gym_today())$q$, 'MEMBER_INACTIVE');
insert into tests.ctx values ('m3', public.create_member('Temp', '03330000000', null, public.gym_today(), null));
select public.delete_member((select v from tests.ctx where k='m3'));
select tests.eq((select count(*) from public.members where id = (select v from tests.ctx where k='m3'))::int, 0, 'member without history can be deleted');

-- settings: owner can update, timezone validated
update public.gym_settings set gym_name = 'Iron Temple Gym' where id = 1;
select tests.eq((select gym_name from public.gym_settings), 'Iron Temple Gym', 'owner updates settings');
select tests.expect_error($q$update public.gym_settings set timezone = 'Mars/Olympus' where id = 1$q$, 'Invalid timezone');

-- trends shape
select tests.eq(jsonb_array_length(public.dashboard_trends(12, 30) -> 'collections'), 12, '12 months of collections');
select tests.eq(jsonb_array_length(public.dashboard_trends(12, 30) -> 'attendance'), 30, '30 days of attendance');
select tests.eq(((public.dashboard_trends(12, 30) -> 'collections') -> 11 ->> 'total')::numeric, 1000::numeric, 'current month collection excludes voids');

select tests.eq((select count(*) from public.audit_events)::int > 0, true, 'owner can read audit log');
reset role;

\echo 'ALL DATABASE TESTS PASSED'
rollback;
