-- =============================================================================
-- Verify the database is set up correctly. Run in Supabase → SQL Editor.
-- Every row in the first result should say rls_enabled = true.
-- =============================================================================

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by 1;

-- Anonymous visitors must have NO table access (expect 0 rows):
select table_name, privilege_type
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public';

-- Key functions exist (expect 7 rows):
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('record_payment', 'void_payment', 'assign_membership', 'create_member',
                   'check_in_member', 'dashboard_summary', 'grant_gym_access');

-- Settings row exists and today's gym date:
select gym_name, timezone, public.gym_today() as gym_today from public.gym_settings;

-- Logo bucket exists:
select id, public from storage.buckets where id = 'gym-branding';
