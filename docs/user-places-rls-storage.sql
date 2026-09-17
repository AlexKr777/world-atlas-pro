-- user_places RLS + private Storage policies for user-places/{uid}/...
-- Run in Supabase SQL Editor.

-- ============================================================
-- Block 1: public.user_places (schema + RLS + grants)
-- ============================================================

-- Audit current policies on user_places.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'user_places'
order by cmd, policyname;

-- Audit user_id column type/nullability.
select
  column_name,
  data_type,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_places'
  and column_name in ('id', 'user_id', 'image_path')
order by column_name;

begin;

alter table if exists public.user_places
  add column if not exists user_id uuid,
  add column if not exists image_path text;

-- If you still have null user_id rows, fix them before NOT NULL:
-- select id from public.user_places where user_id is null limit 20;

alter table public.user_places
  alter column user_id type uuid using user_id::uuid,
  alter column user_id set not null;

alter table public.user_places enable row level security;
alter table public.user_places force row level security;

grant select, insert, update, delete on table public.user_places to authenticated;

-- Remove old/duplicate policies (including public role policies).
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_places'
  loop
    execute format('drop policy if exists %I on public.user_places;', p.policyname);
  end loop;
end;
$$;

create policy user_places_select_own
  on public.user_places
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_places_insert_own
  on public.user_places
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_places_update_own
  on public.user_places
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_places_delete_own
  on public.user_places
  for delete
  to authenticated
  using (user_id = auth.uid());

commit;

-- ============================================================
-- Block 2: storage.objects for place-images/user-places/{uid}/...
-- ============================================================

-- Audit current storage policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by cmd, policyname;

begin;

insert into storage.buckets (id, name, public)
values ('place-images', 'place-images', false)
on conflict (id) do update
set public = excluded.public;

-- Drop any broad public policies touching place-images (cleanup).
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and array_position(roles, 'public'::name) is not null
      and (
        coalesce(qual, '') ilike '%place-images%'
        or coalesce(with_check, '') ilike '%place-images%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects;', p.policyname);
  end loop;
end;
$$;

drop policy if exists place_images_user_places_select_own on storage.objects;
drop policy if exists place_images_user_places_insert_own on storage.objects;
drop policy if exists place_images_user_places_update_own on storage.objects;
drop policy if exists place_images_user_places_delete_own on storage.objects;
drop policy if exists place_images_places_select_public on storage.objects;
drop policy if exists place_images_places_insert_auth on storage.objects;
drop policy if exists place_images_places_update_owner on storage.objects;
drop policy if exists place_images_places_delete_owner on storage.objects;

-- Optional compatibility path for public places images (places/...).
create policy place_images_places_select_public
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'place-images'
    and name like 'places/%'
  );

create policy place_images_places_insert_auth
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'places/' || auth.uid()::text || '/%'
  );

create policy place_images_places_update_owner
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'places/' || auth.uid()::text || '/%'
  )
  with check (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'places/' || auth.uid()::text || '/%'
  );

create policy place_images_places_delete_owner
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'places/' || auth.uid()::text || '/%'
  );

create policy place_images_user_places_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'user-places/' || auth.uid()::text || '/%'
  );

create policy place_images_user_places_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'user-places/' || auth.uid()::text || '/%'
  );

create policy place_images_user_places_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'user-places/' || auth.uid()::text || '/%'
  )
  with check (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'user-places/' || auth.uid()::text || '/%'
  );

create policy place_images_user_places_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'place-images'
    and owner = auth.uid()
    and name like 'user-places/' || auth.uid()::text || '/%'
  );

commit;
