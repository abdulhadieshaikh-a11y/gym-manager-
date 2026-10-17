-- =============================================================================
-- Gym Manager — 004 storage bucket for the gym logo
-- Public read (the logo appears on receipts); only the owner can upload/replace.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-branding', 'gym-branding', true, 1048576,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy gym_branding_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gym-branding' and (select public.is_gym_owner()));

create policy gym_branding_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'gym-branding' and (select public.is_gym_owner()))
  with check (bucket_id = 'gym-branding' and (select public.is_gym_owner()));

create policy gym_branding_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'gym-branding' and (select public.is_gym_owner()));

create policy gym_branding_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'gym-branding' and (select public.is_gym_owner()));
