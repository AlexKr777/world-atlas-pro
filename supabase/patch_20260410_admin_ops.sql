begin;

alter table if exists public.user_status
  add column if not exists last_path text,
  add column if not exists user_agent text,
  add column if not exists last_ip text;

alter table if exists public.visitor_status
  add column if not exists last_ip text;

create table if not exists public.user_freezes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  frozen boolean not null default true,
  reason text,
  frozen_by uuid references auth.users (id) on delete set null,
  frozen_at timestamptz not null default now(),
  frozen_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users (id) on delete cascade,
  target_visitor_id text,
  body text not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_notes_target_check check (
    (
      target_user_id is not null
      and nullif(trim(coalesce(target_visitor_id, '')), '') is null
    )
    or (
      target_user_id is null
      and nullif(trim(coalesce(target_visitor_id, '')), '') is not null
    )
  )
);

create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null default auth.uid(),
  target_user_id uuid references auth.users (id) on delete cascade,
  target_visitor_id text,
  action text not null,
  reason text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.user_freezes
  add column if not exists frozen boolean default true,
  add column if not exists reason text,
  add column if not exists frozen_by uuid references auth.users (id) on delete set null,
  add column if not exists frozen_at timestamptz default now(),
  add column if not exists frozen_until timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.admin_notes
  add column if not exists target_user_id uuid references auth.users (id) on delete cascade,
  add column if not exists target_visitor_id text,
  add column if not exists body text,
  add column if not exists created_by uuid references auth.users (id) on delete set null default auth.uid(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.admin_action_logs
  add column if not exists actor_user_id uuid references auth.users (id) on delete set null default auth.uid(),
  add column if not exists target_user_id uuid references auth.users (id) on delete cascade,
  add column if not exists target_visitor_id text,
  add column if not exists action text,
  add column if not exists reason text,
  add column if not exists meta jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

alter table if exists public.user_freezes alter column frozen set default true;
alter table if exists public.user_freezes alter column frozen_at set default now();
alter table if exists public.user_freezes alter column updated_at set default now();
alter table if exists public.admin_notes alter column created_by set default auth.uid();
alter table if exists public.admin_notes alter column created_at set default now();
alter table if exists public.admin_notes alter column updated_at set default now();
alter table if exists public.admin_action_logs alter column actor_user_id set default auth.uid();
alter table if exists public.admin_action_logs alter column meta set default '{}'::jsonb;
alter table if exists public.admin_action_logs alter column created_at set default now();

update public.user_freezes
set frozen = coalesce(frozen, true),
    frozen_at = coalesce(frozen_at, now()),
    updated_at = coalesce(updated_at, now())
where frozen is null
   or frozen_at is null
   or updated_at is null;

update public.admin_notes
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where created_at is null
   or updated_at is null;

update public.admin_action_logs
set meta = coalesce(meta, '{}'::jsonb),
    created_at = coalesce(created_at, now())
where meta is null
   or created_at is null;

create index if not exists user_freezes_frozen_idx
  on public.user_freezes (frozen, frozen_until);

create index if not exists admin_notes_target_user_idx
  on public.admin_notes (target_user_id, created_at desc);

create index if not exists admin_notes_target_visitor_idx
  on public.admin_notes (target_visitor_id, created_at desc);

create index if not exists admin_action_logs_target_user_idx
  on public.admin_action_logs (target_user_id, created_at desc);

create index if not exists admin_action_logs_target_visitor_idx
  on public.admin_action_logs (target_visitor_id, created_at desc);

create index if not exists admin_action_logs_action_idx
  on public.admin_action_logs (action, created_at desc);

create index if not exists user_status_last_seen_idx
  on public.user_status (last_seen desc);

create index if not exists visitor_status_user_id_idx
  on public.visitor_status (user_id);

drop trigger if exists user_freezes_touch_updated_at on public.user_freezes;
create trigger user_freezes_touch_updated_at
before update on public.user_freezes
for each row
execute function public.touch_updated_at();

drop trigger if exists admin_notes_touch_updated_at on public.admin_notes;
create trigger admin_notes_touch_updated_at
before update on public.admin_notes
for each row
execute function public.touch_updated_at();

create or replace function public.is_active_freeze(frozen_flag boolean, frozen_until timestamptz)
returns boolean
language sql
stable
as $$
  select coalesce(frozen_flag, false)
    and (frozen_until is null or frozen_until > now());
$$;

create or replace function public.is_soft_frozen(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_freezes f
    where f.user_id = coalesce(target_user_id, auth.uid())
      and public.is_active_freeze(f.frozen, f.frozen_until)
  );
$$;

create or replace function public.is_soft_frozen()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_soft_frozen(auth.uid());
$$;

create or replace function public.is_write_blocked(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_banned(coalesce(target_user_id, auth.uid()))
    or public.is_soft_frozen(coalesce(target_user_id, auth.uid()));
$$;

create or replace function public.is_write_blocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_write_blocked(auth.uid());
$$;

create or replace function public.admin_freeze_user(target_user_id uuid, minutes integer default null, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  safe_reason text := nullif(trim(coalesce(reason, '')), '');
  freeze_until timestamptz := public.resolve_ban_until(minutes);
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;
  if target_user_id = actor_uid then
    raise exception 'You cannot freeze yourself';
  end if;

  insert into public.user_freezes (user_id, frozen, reason, frozen_by, frozen_at, frozen_until)
  values (target_user_id, true, safe_reason, actor_uid, now(), freeze_until)
  on conflict (user_id) do update
    set frozen = true,
        reason = excluded.reason,
        frozen_by = excluded.frozen_by,
        frozen_at = now(),
        frozen_until = excluded.frozen_until,
        updated_at = now();

  insert into public.admin_action_logs (actor_user_id, target_user_id, action, reason, meta)
  values (
    actor_uid,
    target_user_id,
    'freeze',
    safe_reason,
    jsonb_build_object(
      'minutes', minutes,
      'frozen_until', freeze_until,
      'is_permanent', freeze_until is null
    )
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', target_user_id,
    'minutes', minutes,
    'frozen_until', freeze_until,
    'is_permanent', freeze_until is null
  );
end;
$$;

create or replace function public.admin_unfreeze_user(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;
  if target_user_id = actor_uid then
    raise exception 'You cannot unfreeze yourself';
  end if;

  insert into public.user_freezes (user_id, frozen, reason, frozen_by, frozen_at, frozen_until)
  values (target_user_id, false, null, actor_uid, now(), null)
  on conflict (user_id) do update
    set frozen = false,
        reason = null,
        frozen_by = excluded.frozen_by,
        frozen_at = now(),
        frozen_until = null,
        updated_at = now();

  insert into public.admin_action_logs (actor_user_id, target_user_id, action, meta)
  values (
    actor_uid,
    target_user_id,
    'unfreeze',
    jsonb_build_object('ok', true)
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', target_user_id
  );
end;
$$;

drop view if exists public.admin_live_presence;
create view public.admin_live_presence
with (security_invoker = true)
as
select
  ('user:' || us.user_id::text) as presence_key,
  'user'::text as presence_type,
  us.user_id,
  null::text as visitor_id,
  coalesce(nullif(us.email, ''), nullif(pr.email, ''), us.user_id::text) as email,
  coalesce(nullif(pr.display_name, ''), nullif(us.email, ''), us.user_id::text) as display_name,
  coalesce(pr.role, us.role, 'user') as role,
  us.last_seen,
  coalesce(nullif(us.last_path, ''), '/') as last_path,
  nullif(us.user_agent, '') as user_agent,
  nullif(us.last_ip, '') as last_ip,
  true as is_registered,
  public.is_active_ban(ub.banned, ub.banned_until) as is_banned,
  ub.reason as ban_reason,
  coalesce(ub.banned_at, ub.updated_at, ub.banned_until) as banned_at,
  ub.banned_until,
  (coalesce(ub.banned, false) and ub.banned_until is null) as is_permanent_ban,
  public.is_active_freeze(uf.frozen, uf.frozen_until) as is_frozen,
  uf.reason as freeze_reason,
  coalesce(uf.frozen_at, uf.updated_at, uf.frozen_until) as frozen_at,
  uf.frozen_until,
  (coalesce(uf.frozen, false) and uf.frozen_until is null) as is_permanent_freeze
from public.user_status us
left join public.profiles pr on pr.id = us.user_id
left join public.user_bans ub on ub.user_id = us.user_id
left join public.user_freezes uf on uf.user_id = us.user_id
union all
select
  ('visitor:' || vs.visitor_id) as presence_key,
  'visitor'::text as presence_type,
  vs.user_id,
  vs.visitor_id,
  coalesce(nullif(vs.email, ''), nullif(vs.display_name, ''), 'guest') as email,
  coalesce(nullif(vs.display_name, ''), 'Guest ' || upper(right(vs.visitor_id, 6))) as display_name,
  coalesce(nullif(vs.role, ''), 'guest') as role,
  vs.last_seen,
  coalesce(nullif(vs.last_path, ''), '/') as last_path,
  nullif(vs.user_agent, '') as user_agent,
  nullif(vs.last_ip, '') as last_ip,
  false as is_registered,
  public.is_active_ban(vb.banned, vb.banned_until) as is_banned,
  vb.reason as ban_reason,
  vb.banned_at,
  vb.banned_until,
  (coalesce(vb.banned, false) and vb.banned_until is null) as is_permanent_ban,
  false as is_frozen,
  null::text as freeze_reason,
  null::timestamptz as frozen_at,
  null::timestamptz as frozen_until,
  false as is_permanent_freeze
from public.visitor_status vs
left join public.visitor_bans vb on vb.visitor_id = vs.visitor_id
where vs.user_id is null
   or public.is_active_ban(vb.banned, vb.banned_until);

grant select, insert, update, delete on public.user_freezes to authenticated;
grant select, insert, update, delete on public.admin_notes to authenticated;
grant select, insert, update on public.admin_action_logs to authenticated;
grant select on public.admin_live_presence to authenticated;

grant execute on function public.is_active_freeze(boolean, timestamptz) to authenticated;
grant execute on function public.is_soft_frozen() to authenticated;
grant execute on function public.is_soft_frozen(uuid) to authenticated;
grant execute on function public.is_write_blocked() to authenticated;
grant execute on function public.is_write_blocked(uuid) to authenticated;
grant execute on function public.admin_freeze_user(uuid, integer, text) to authenticated;
grant execute on function public.admin_unfreeze_user(uuid) to authenticated;

alter table public.user_freezes enable row level security;
alter table public.admin_notes enable row level security;
alter table public.admin_action_logs enable row level security;

drop policy if exists "user_freezes read self or admin" on public.user_freezes;
create policy "user_freezes read self or admin"
on public.user_freezes
for select
to authenticated
using (user_id = auth.uid() or public.is_active_admin());

drop policy if exists "user_freezes admin write" on public.user_freezes;
create policy "user_freezes admin write"
on public.user_freezes
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "admin_notes admin read" on public.admin_notes;
create policy "admin_notes admin read"
on public.admin_notes
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "admin_notes admin insert" on public.admin_notes;
create policy "admin_notes admin insert"
on public.admin_notes
for insert
to authenticated
with check (public.is_active_admin());

drop policy if exists "admin_notes admin update" on public.admin_notes;
create policy "admin_notes admin update"
on public.admin_notes
for update
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "admin_notes admin delete" on public.admin_notes;
create policy "admin_notes admin delete"
on public.admin_notes
for delete
to authenticated
using (public.is_active_admin());

drop policy if exists "admin_action_logs admin read" on public.admin_action_logs;
create policy "admin_action_logs admin read"
on public.admin_action_logs
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "admin_action_logs admin insert" on public.admin_action_logs;
create policy "admin_action_logs admin insert"
on public.admin_action_logs
for insert
to authenticated
with check (public.is_active_admin());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin"
on public.profiles
for update
to authenticated
using (
  (id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
)
with check (
  (id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "places insert authenticated" on public.places;
create policy "places insert authenticated"
on public.places
for insert
to authenticated
with check (
  (
    not public.is_write_blocked(auth.uid())
    and coalesce(created_by, auth.uid()) = auth.uid()
  )
  or public.is_active_admin()
);

drop policy if exists "places update owner or admin" on public.places;
create policy "places update owner or admin"
on public.places
for update
to authenticated
using (
  (created_by = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
)
with check (
  (created_by = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "places delete owner or admin" on public.places;
create policy "places delete owner or admin"
on public.places
for delete
to authenticated
using (
  (created_by = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "user_places insert owner" on public.user_places;
create policy "user_places insert owner"
on public.user_places
for insert
to authenticated
with check (
  (
    not public.is_write_blocked(auth.uid())
    and coalesce(user_id, auth.uid()) = auth.uid()
  )
  or public.is_active_admin()
);

drop policy if exists "user_places update owner or admin" on public.user_places;
create policy "user_places update owner or admin"
on public.user_places
for update
to authenticated
using (
  (user_id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
)
with check (
  (user_id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "user_places delete owner or admin" on public.user_places;
create policy "user_places delete owner or admin"
on public.user_places
for delete
to authenticated
using (
  (user_id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "favorites write own" on public.favorites;
create policy "favorites write own"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid() and not public.is_write_blocked(auth.uid()));

drop policy if exists "favorites delete own" on public.favorites;
create policy "favorites delete own"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid() and not public.is_write_blocked(auth.uid()));

drop policy if exists "favorites admin manage" on public.favorites;
create policy "favorites admin manage"
on public.favorites
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own"
on public.reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and not public.is_write_blocked(auth.uid())
);

drop policy if exists "reviews update own or admin" on public.reviews;
create policy "reviews update own or admin"
on public.reviews
for update
to authenticated
using (
  (user_id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
)
with check (
  (user_id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "reviews delete own or admin" on public.reviews;
create policy "reviews delete own or admin"
on public.reviews
for delete
to authenticated
using (
  (user_id = auth.uid() and not public.is_write_blocked(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "visitor_status admin delete" on public.visitor_status;
create policy "visitor_status admin delete"
on public.visitor_status
for delete
to authenticated
using (public.is_active_admin());

drop policy if exists "place-images write own or admin" on storage.objects;
create policy "place-images write own or admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'place-images'
  and (
    (
      not public.is_write_blocked(auth.uid())
      and (
        name like ('user-places/' || auth.uid()::text || '/%')
        or name like ('places/' || auth.uid()::text || '/%')
      )
    )
    or public.is_active_admin()
  )
);

drop policy if exists "place-images update own or admin" on storage.objects;
create policy "place-images update own or admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'place-images'
  and (
    (
      not public.is_write_blocked(auth.uid())
      and (
        name like ('user-places/' || auth.uid()::text || '/%')
        or name like ('places/' || auth.uid()::text || '/%')
      )
    )
    or public.is_active_admin()
  )
)
with check (
  bucket_id = 'place-images'
  and (
    (
      not public.is_write_blocked(auth.uid())
      and (
        name like ('user-places/' || auth.uid()::text || '/%')
        or name like ('places/' || auth.uid()::text || '/%')
      )
    )
    or public.is_active_admin()
  )
);

drop policy if exists "place-images delete own or admin" on storage.objects;
create policy "place-images delete own or admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'place-images'
  and (
    (
      not public.is_write_blocked(auth.uid())
      and (
        name like ('user-places/' || auth.uid()::text || '/%')
        or name like ('places/' || auth.uid()::text || '/%')
      )
    )
    or public.is_active_admin()
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.user_freezes;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.admin_notes;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.admin_action_logs;
  exception
    when duplicate_object then null;
  end;
end;
$$;

alter table public.user_freezes replica identity full;
alter table public.admin_notes replica identity full;

commit;
