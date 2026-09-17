begin;

create extension if not exists pgcrypto;

create table if not exists public.visitor_status (
  visitor_id text primary key,
  display_name text not null default '',
  user_id uuid references auth.users (id) on delete set null,
  email text,
  role text not null default 'guest' check (role in ('guest', 'user', 'admin')),
  last_seen timestamptz not null default now(),
  last_path text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visitor_status_id_length check (char_length(visitor_id) between 12 and 120)
);

create table if not exists public.visitor_bans (
  visitor_id text primary key,
  banned boolean not null default true,
  reason text,
  banned_by uuid references auth.users (id) on delete set null,
  banned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visitor_bans_id_length check (char_length(visitor_id) between 12 and 120)
);

create index if not exists visitor_status_last_seen_idx
  on public.visitor_status (last_seen desc);

create index if not exists visitor_status_user_id_idx
  on public.visitor_status (user_id);

create index if not exists visitor_bans_active_idx
  on public.visitor_bans (visitor_id, banned);

drop trigger if exists visitor_bans_touch_updated_at on public.visitor_bans;
create trigger visitor_bans_touch_updated_at
before update on public.visitor_bans
for each row
execute function public.touch_updated_at();

create or replace function public.apply_user_status_defaults()
returns trigger
language plpgsql
as $$
declare
  profile_row public.profiles%rowtype;
begin
  select *
    into profile_row
  from public.profiles
  where id = new.user_id;

  new.email = coalesce(nullif(new.email, ''), profile_row.email, lower(coalesce(auth.jwt() ->> 'email', '')));
  new.role = coalesce(profile_row.role, public.resolve_default_role(new.email), 'user');
  new.last_seen = coalesce(new.last_seen, now());
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_status_apply_defaults on public.user_status;
create trigger user_status_apply_defaults
before insert or update on public.user_status
for each row
execute function public.apply_user_status_defaults();

create or replace function public.apply_visitor_status_defaults()
returns trigger
language plpgsql
as $$
declare
  profile_row public.profiles%rowtype;
begin
  if new.visitor_id is null or char_length(trim(new.visitor_id)) < 12 then
    raise exception 'visitor_id is required';
  end if;

  select *
    into profile_row
  from public.profiles
  where id = new.user_id;

  new.display_name = coalesce(
    nullif(trim(coalesce(new.display_name, '')), ''),
    case
      when new.user_id is not null then coalesce(nullif(profile_row.display_name, ''), nullif(profile_row.email, ''), 'User')
      else 'Guest ' || upper(right(new.visitor_id, 6))
    end
  );
  new.email = coalesce(nullif(lower(coalesce(new.email, '')), ''), profile_row.email);
  new.role = case
    when profile_row.role = 'admin' then 'admin'
    when new.user_id is not null then 'user'
    else 'guest'
  end;
  new.last_seen = coalesce(new.last_seen, now());
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists visitor_status_apply_defaults on public.visitor_status;
create trigger visitor_status_apply_defaults
before insert or update on public.visitor_status
for each row
execute function public.apply_visitor_status_defaults();

update public.user_status us
set email = coalesce(nullif(us.email, ''), p.email),
    role = coalesce(p.role, us.role, 'user'),
    updated_at = now()
from public.profiles p
where p.id = us.user_id
  and (
    coalesce(nullif(us.email, ''), '') <> coalesce(nullif(p.email, ''), '')
    or coalesce(us.role, '') <> coalesce(p.role, '')
  );

create or replace function public.is_visitor_banned(target_visitor_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.visitor_bans b
    where b.visitor_id = nullif(trim(coalesce(target_visitor_id, '')), '')
      and b.banned = true
  );
$$;

create or replace function public.ban_visitor(target_visitor_id text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  safe_visitor_id text := nullif(trim(coalesce(target_visitor_id, '')), '');
begin
  if not public.is_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if safe_visitor_id is null then
    raise exception 'target_visitor_id is required';
  end if;

  insert into public.visitor_bans (visitor_id, banned, reason, banned_by, banned_at)
  values (safe_visitor_id, true, nullif(trim(coalesce(p_reason, '')), ''), actor_uid, now())
  on conflict (visitor_id) do update
    set banned = true,
        reason = excluded.reason,
        banned_by = excluded.banned_by,
        banned_at = now(),
        updated_at = now();

  return jsonb_build_object('ok', true, 'visitor_id', safe_visitor_id, 'banned', true);
end;
$$;

create or replace function public.unban_visitor(target_visitor_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  safe_visitor_id text := nullif(trim(coalesce(target_visitor_id, '')), '');
begin
  if not public.is_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if safe_visitor_id is null then
    raise exception 'target_visitor_id is required';
  end if;

  insert into public.visitor_bans (visitor_id, banned, reason, banned_by, banned_at)
  values (safe_visitor_id, false, null, actor_uid, now())
  on conflict (visitor_id) do update
    set banned = false,
        reason = null,
        banned_by = excluded.banned_by,
        banned_at = now(),
        updated_at = now();

  return jsonb_build_object('ok', true, 'visitor_id', safe_visitor_id, 'banned', false);
end;
$$;

create or replace view public.admin_live_presence
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
  true as is_registered,
  (
    coalesce(ub.banned, false)
    and (ub.banned_until is null or ub.banned_until > now())
  ) as is_banned,
  ub.reason as ban_reason,
  coalesce(ub.banned_at, ub.updated_at, ub.banned_until) as banned_at
from public.user_status us
left join public.profiles pr on pr.id = us.user_id
left join public.user_bans ub on ub.user_id = us.user_id
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
  false as is_registered,
  coalesce(vb.banned, false) as is_banned,
  vb.reason as ban_reason,
  vb.banned_at
from public.visitor_status vs
left join public.visitor_bans vb on vb.visitor_id = vs.visitor_id
where vs.user_id is null
   or coalesce(vb.banned, false) = true;

grant select on public.visitor_status to authenticated;
grant select, insert, update, delete on public.visitor_bans to authenticated;
grant select on public.admin_live_presence to authenticated;

grant execute on function public.is_visitor_banned(text) to authenticated;
grant execute on function public.ban_visitor(text, text) to authenticated;
grant execute on function public.unban_visitor(text) to authenticated;

alter table public.visitor_status enable row level security;
alter table public.visitor_bans enable row level security;

drop policy if exists "visitor_status admin read" on public.visitor_status;
create policy "visitor_status admin read"
on public.visitor_status
for select
to authenticated
using (public.is_admin());

drop policy if exists "visitor_bans admin read" on public.visitor_bans;
create policy "visitor_bans admin read"
on public.visitor_bans
for select
to authenticated
using (public.is_admin());

drop policy if exists "visitor_bans admin write" on public.visitor_bans;
create policy "visitor_bans admin write"
on public.visitor_bans
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  begin
    alter publication supabase_realtime add table public.user_bans;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.visitor_status;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.visitor_bans;
  exception
    when duplicate_object then null;
  end;
end;
$$;

alter table public.user_bans replica identity full;
alter table public.visitor_status replica identity full;
alter table public.visitor_bans replica identity full;

commit;
