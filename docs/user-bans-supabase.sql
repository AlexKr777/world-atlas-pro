-- User bans (admin-only) + write block for banned users.
-- Preconditions:
--   1) public.user_bans exists with PK (user_id uuid)
--   2) public.is_admin() exists and returns boolean
--   3) public.user_places exists with column user_id uuid
--   4) bucket place-images exists (storage.objects policies below use it)

begin;

-- Normalize expected columns on public.user_bans.
alter table public.user_bans
  add column if not exists banned boolean,
  add column if not exists reason text,
  add column if not exists banned_by uuid references auth.users(id) on delete set null,
  add column if not exists banned_at timestamptz;

update public.user_bans
set banned = false
where banned is null;

alter table public.user_bans
  alter column user_id set not null,
  alter column banned set not null,
  alter column banned set default false;

-- If banned=true and banned_at is empty, backfill timestamp.
update public.user_bans
set banned_at = now()
where banned = true
  and banned_at is null;

create index if not exists user_bans_banned_idx
  on public.user_bans (banned);

create index if not exists user_bans_banned_at_idx
  on public.user_bans (banned_at desc);

-- RLS on user_bans: admin only.
alter table public.user_bans enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_bans'
  loop
    execute format('drop policy if exists %I on public.user_bans;', p.policyname);
  end loop;
end;
$$;

create policy user_bans_admin_select
  on public.user_bans
  for select
  to authenticated
  using (public.is_admin());

create policy user_bans_admin_insert
  on public.user_bans
  for insert
  to authenticated
  with check (public.is_admin());

create policy user_bans_admin_update
  on public.user_bans
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy user_bans_admin_delete
  on public.user_bans
  for delete
  to authenticated
  using (public.is_admin());

revoke all on table public.user_bans from public;
grant select, insert, update, delete on public.user_bans to authenticated;

-- Helper: check active ban.
create or replace function public.is_banned(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  target_uid uuid := coalesce(uid, actor_uid);
begin
  if actor_uid is null or target_uid is null then
    return false;
  end if;

  -- Non-admin can only check their own ban status.
  if actor_uid <> target_uid and not public.is_admin() then
    return false;
  end if;

  return exists (
    select 1
    from public.user_bans b
    where b.user_id = target_uid
      and coalesce(b.banned, false) = true
  );
end;
$$;

revoke all on function public.is_banned(uuid) from public;
grant execute on function public.is_banned(uuid) to authenticated;

-- RPC: ban user (admin only).
create or replace function public.ban_user(target_uid uuid, p_reason text default null)
returns public.user_bans
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  safe_reason text := nullif(trim(coalesce(p_reason, '')), '');
  result_row public.user_bans;
begin
  if actor_uid is null or not public.is_admin() then
    raise exception 'Admin access required.'
      using errcode = '42501';
  end if;

  if target_uid is null then
    raise exception 'target_uid is required.'
      using errcode = '22023';
  end if;

  insert into public.user_bans as ub (
    user_id,
    banned,
    reason,
    banned_by,
    banned_at
  )
  values (
    target_uid,
    true,
    safe_reason,
    actor_uid,
    now()
  )
  on conflict (user_id)
  do update set
    banned = true,
    reason = excluded.reason,
    banned_by = actor_uid,
    banned_at = now()
  returning ub.* into result_row;

  return result_row;
end;
$$;

-- RPC: unban user (admin only).
create or replace function public.unban_user(target_uid uuid)
returns public.user_bans
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  result_row public.user_bans;
begin
  if actor_uid is null or not public.is_admin() then
    raise exception 'Admin access required.'
      using errcode = '42501';
  end if;

  if target_uid is null then
    raise exception 'target_uid is required.'
      using errcode = '22023';
  end if;

  insert into public.user_bans as ub (
    user_id,
    banned,
    reason,
    banned_by,
    banned_at
  )
  values (
    target_uid,
    false,
    null,
    actor_uid,
    now()
  )
  on conflict (user_id)
  do update set
    banned = false,
    reason = null,
    banned_by = actor_uid,
    banned_at = now()
  returning ub.* into result_row;

  return result_row;
end;
$$;

revoke all on function public.ban_user(uuid, text) from public;
revoke all on function public.unban_user(uuid) from public;
grant execute on function public.ban_user(uuid, text) to authenticated;
grant execute on function public.unban_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Banned user cannot mutate own user_places rows.
-- Existing ownership policies still apply; this is an additional restrictive gate.
-- ---------------------------------------------------------------------------
alter table public.user_places enable row level security;

drop policy if exists user_places_write_block_banned_insert on public.user_places;
drop policy if exists user_places_write_block_banned_update on public.user_places;
drop policy if exists user_places_write_block_banned_delete on public.user_places;

create policy user_places_write_block_banned_insert
  as restrictive
  on public.user_places
  for insert
  to authenticated
  with check (
    not (
      user_id = auth.uid()
      and public.is_banned(auth.uid())
    )
  );

create policy user_places_write_block_banned_update
  as restrictive
  on public.user_places
  for update
  to authenticated
  using (
    not (
      user_id = auth.uid()
      and public.is_banned(auth.uid())
    )
  )
  with check (
    not (
      user_id = auth.uid()
      and public.is_banned(auth.uid())
    )
  );

create policy user_places_write_block_banned_delete
  as restrictive
  on public.user_places
  for delete
  to authenticated
  using (
    not (
      user_id = auth.uid()
      and public.is_banned(auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Banned user cannot mutate own objects in:
--   place-images / user-places/{uid}/...
-- ---------------------------------------------------------------------------
drop policy if exists storage_user_places_block_banned_insert on storage.objects;
drop policy if exists storage_user_places_block_banned_update on storage.objects;
drop policy if exists storage_user_places_block_banned_delete on storage.objects;

create policy storage_user_places_block_banned_insert
  as restrictive
  on storage.objects
  for insert
  to authenticated
  with check (
    not (
      bucket_id = 'place-images'
      and name like ('user-places/' || auth.uid()::text || '/%')
      and public.is_banned(auth.uid())
    )
  );

create policy storage_user_places_block_banned_update
  as restrictive
  on storage.objects
  for update
  to authenticated
  using (
    not (
      bucket_id = 'place-images'
      and name like ('user-places/' || auth.uid()::text || '/%')
      and public.is_banned(auth.uid())
    )
  )
  with check (
    not (
      bucket_id = 'place-images'
      and name like ('user-places/' || auth.uid()::text || '/%')
      and public.is_banned(auth.uid())
    )
  );

create policy storage_user_places_block_banned_delete
  as restrictive
  on storage.objects
  for delete
  to authenticated
  using (
    not (
      bucket_id = 'place-images'
      and name like ('user-places/' || auth.uid()::text || '/%')
      and public.is_banned(auth.uid())
    )
  );

commit;
