-- =============================================================================
-- Give a Supabase Auth user access to Gym Manager.
-- Run in Supabase → SQL Editor AFTER creating the user in
-- Authentication → Users → "Add user" (tick "Auto Confirm User").
-- =============================================================================

-- Owner (full access). Replace the email and name:
select public.grant_gym_access('owner@example.com', 'owner', 'Owner Name');

-- Optional: front-desk staff account (daily work only — no voids, settings,
-- packages or trainers):
-- select public.grant_gym_access('frontdesk@example.com', 'staff', 'Front Desk');

-- Remove someone's access (their login stops working for gym data):
-- select public.revoke_gym_access('frontdesk@example.com');

-- Check who has access:
select u.email, p.full_name, p.role, p.is_active
  from public.profiles p join auth.users u on u.id = p.id
 order by p.role, u.email;
