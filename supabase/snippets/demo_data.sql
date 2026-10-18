-- Demo-only records for checking every Gym Manager section.
-- Run once in Supabase SQL Editor after migrations and owner access are set up.
-- All people are clearly labelled Demo; contact details use example.com and
-- intentionally non-routable-looking numbers. Re-running this script is safe.
-- The script inserts data only; it does not update or delete existing records.

do $$
declare
  v_owner uuid;
  v_today date := public.gym_today();
begin
  select id into v_owner
    from public.profiles
   where role = 'owner' and is_active
   order by created_at
   limit 1;

  if v_owner is null then
    raise exception 'No active owner profile found. Grant gym access to an owner before seeding demo data.';
  end if;

  insert into public.packages (id, name, duration_value, duration_unit, price, description, is_active)
  values
    ('d0000000-0000-4000-8000-000000000001', 'Demo - Monthly Fitness', 30, 'days', 5000, 'Demo package for testing', true),
    ('d0000000-0000-4000-8000-000000000002', 'Demo - Personal Training', 30, 'days', 7000, 'Demo package for testing', true),
    ('d0000000-0000-4000-8000-000000000003', 'Demo - Short Pass', 7, 'days', 1800, 'Demo package for testing', false)
  on conflict (id) do nothing;

  insert into public.trainers (id, full_name, phone, email, specialization, joining_date, is_active, notes)
  values
    ('d0000000-0000-4000-8000-000000000011', 'Demo - Ahmed Trainer', '+920000000101', 'demo.ahmed@example.com', 'Strength training', v_today - 120, true, 'Demo record - safe to remove after testing.'),
    ('d0000000-0000-4000-8000-000000000012', 'Demo - Sana Coach', '+920000000102', 'demo.sana@example.com', 'Cardio and fitness', v_today - 60, true, 'Demo record - safe to remove after testing.'),
    ('d0000000-0000-4000-8000-000000000013', 'Demo - Bilal Trainer', '+920000000103', 'demo.bilal@example.com', 'Personal training', v_today - 30, false, 'Demo inactive trainer - safe to remove after testing.')
  on conflict (id) do nothing;

  insert into public.members (id, member_code, full_name, phone, email, joining_date, notes, is_active, created_by)
  values
    ('d0000000-0000-4000-8000-000000000021', 'DEMO-001', 'Demo - Ali Raza', '+920000000201', 'demo.ali@example.com', v_today - 20, 'Demo member - safe to remove after testing.', true, v_owner),
    ('d0000000-0000-4000-8000-000000000022', 'DEMO-002', 'Demo - Sara Khan', '+920000000202', 'demo.sara@example.com', v_today - 15, 'Demo member - safe to remove after testing.', true, v_owner),
    ('d0000000-0000-4000-8000-000000000023', 'DEMO-003', 'Demo - Hamza Ahmed', '+920000000203', 'demo.hamza@example.com', v_today - 70, 'Demo member with expired membership - safe to remove after testing.', true, v_owner),
    ('d0000000-0000-4000-8000-000000000024', 'DEMO-004', 'Demo - Ayesha Malik', '+920000000204', 'demo.ayesha@example.com', v_today - 5, 'Demo member - safe to remove after testing.', true, v_owner),
    ('d0000000-0000-4000-8000-000000000025', 'DEMO-005', 'Demo - Bilal Tariq', '+920000000205', 'demo.bilal.member@example.com', v_today - 100, 'Demo inactive member - safe to remove after testing.', false, v_owner)
  on conflict (id) do nothing;

  insert into public.memberships
    (id, member_id, package_id, package_name, duration_value, duration_unit, start_date, end_date, price, status, notes, created_by)
  values
    ('d0000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000001', 'Demo - Monthly Fitness', 30, 'days', v_today - 5, v_today + 24, 5000, 'active', 'Demo membership.', v_owner),
    ('d0000000-0000-4000-8000-000000000032', 'd0000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000002', 'Demo - Personal Training', 30, 'days', v_today - 10, v_today + 19, 7000, 'active', 'Demo membership.', v_owner),
    ('d0000000-0000-4000-8000-000000000033', 'd0000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000001', 'Demo - Monthly Fitness', 30, 'days', v_today - 45, v_today - 16, 5000, 'active', 'Demo expired membership.', v_owner),
    ('d0000000-0000-4000-8000-000000000034', 'd0000000-0000-4000-8000-000000000024', 'd0000000-0000-4000-8000-000000000001', 'Demo - Monthly Fitness', 30, 'days', v_today - 2, v_today + 27, 5000, 'active', 'Demo membership.', v_owner)
  on conflict (id) do nothing;

  insert into public.fee_invoices
    (id, member_id, membership_id, description, amount_due, amount_paid, due_date, status, created_by)
  values
    ('d0000000-0000-4000-8000-000000000041', 'd0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000031', 'Demo - Monthly Fitness (partial payment)', 5000, 1500, v_today - 5, 'partially_paid', v_owner),
    ('d0000000-0000-4000-8000-000000000042', 'd0000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000032', 'Demo - Personal Training (paid)', 7000, 7000, v_today - 10, 'paid', v_owner),
    ('d0000000-0000-4000-8000-000000000043', 'd0000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000033', 'Demo - Expired membership fee', 5000, 0, v_today - 20, 'unpaid', v_owner),
    ('d0000000-0000-4000-8000-000000000044', 'd0000000-0000-4000-8000-000000000024', 'd0000000-0000-4000-8000-000000000034', 'Demo - Monthly Fitness (unpaid)', 5000, 0, v_today - 2, 'unpaid', v_owner),
    ('d0000000-0000-4000-8000-000000000045', 'd0000000-0000-4000-8000-000000000021', null, 'Demo - Locker fee', 1200, 0, v_today - 3, 'unpaid', v_owner)
  on conflict (id) do nothing;

  insert into public.payments
    (id, invoice_id, member_id, amount, method, payment_date, reference, notes, idempotency_key, created_by)
  values
    ('d0000000-0000-4000-8000-000000000051', 'd0000000-0000-4000-8000-000000000041', 'd0000000-0000-4000-8000-000000000021', 1500, 'cash', v_today - 4, 'DEMO-CASH-001', 'Demo payment; not a real transaction.', 'd0000000-0000-4000-8000-000000000061', v_owner),
    ('d0000000-0000-4000-8000-000000000052', 'd0000000-0000-4000-8000-000000000042', 'd0000000-0000-4000-8000-000000000022', 7000, 'bank_transfer', v_today - 8, 'DEMO-BANK-001', 'Demo payment; not a real transaction.', 'd0000000-0000-4000-8000-000000000062', v_owner)
  on conflict (id) do nothing;

  insert into public.attendance (id, member_id, attendance_date, check_in_at, check_out_at, created_by)
  values
    ('d0000000-0000-4000-8000-000000000071', 'd0000000-0000-4000-8000-000000000021', v_today, now() - interval '90 minutes', now() - interval '30 minutes', v_owner),
    ('d0000000-0000-4000-8000-000000000072', 'd0000000-0000-4000-8000-000000000022', v_today, now() - interval '45 minutes', null, v_owner),
    ('d0000000-0000-4000-8000-000000000073', 'd0000000-0000-4000-8000-000000000024', v_today, now() - interval '20 minutes', null, v_owner)
  on conflict (id) do nothing;

  insert into public.attendance (member_id, attendance_date, check_in_at, check_out_at, created_by)
  select member_id,
         v_today - day_offset,
         ((v_today - day_offset)::timestamp + time '08:00') at time zone 'Asia/Karachi',
         ((v_today - day_offset)::timestamp + time '09:00') at time zone 'Asia/Karachi',
         v_owner
    from (values
      ('d0000000-0000-4000-8000-000000000021'::uuid),
      ('d0000000-0000-4000-8000-000000000022'::uuid)
    ) as demo_members(member_id)
    cross join generate_series(1, 28) as days(day_offset)
   where day_offset % 3 <> 0
  on conflict (member_id, attendance_date) do nothing;
end;
$$;

-- Confirm how many clearly-labelled demo records were created.
select 'packages' as section, count(*) as demo_rows from public.packages where name like 'Demo - %'
union all select 'trainers', count(*) from public.trainers where full_name like 'Demo - %'
union all select 'members', count(*) from public.members where member_code like 'DEMO-%'
union all select 'memberships', count(*) from public.memberships where notes like 'Demo %'
union all select 'fees', count(*) from public.fee_invoices where description like 'Demo - %'
union all select 'payments', count(*) from public.payments where reference like 'DEMO-%'
union all select 'attendance', count(*) from public.attendance
 where member_id in (
   'd0000000-0000-4000-8000-000000000021',
   'd0000000-0000-4000-8000-000000000022',
   'd0000000-0000-4000-8000-000000000024'
 );
