begin;

-- Rescue patch for legacy Supabase installs where existing tables were created
-- before the full ban-system migration introduced timed bans and richer presence fields.
-- Run this first if patch_20260410_ban_system.sql fails with
-- `column "banned_until" does not exist`, then rerun the full patch.

create or replace function public.resolve_default_role(user_email text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(user_email, '')) = any (array[
      'admin@example.invalid',
      'admin@example.invalid'
    ]) then 'admin'
    else 'user'
  end;
$$;

alter table if exists public.profiles
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists role text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.user_status
  add column if not exists email text,
  add column if not exists role text default 'user',
  add column if not exists last_seen timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.visitor_status
  add column if not exists display_name text default '',
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists email text,
  add column if not exists role text default 'guest',
  add column if not exists last_seen timestamptz default now(),
  add column if not exists last_path text,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.user_bans
  add column if not exists banned boolean default true,
  add column if not exists reason text,
  add column if not exists banned_by uuid references auth.users (id) on delete set null,
  add column if not exists banned_at timestamptz default now(),
  add column if not exists banned_until timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.visitor_bans
  add column if not exists banned boolean default true,
  add column if not exists reason text,
  add column if not exists banned_by uuid references auth.users (id) on delete set null,
  add column if not exists banned_at timestamptz default now(),
  add column if not exists banned_until timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.profiles alter column created_at set default now();
alter table if exists public.profiles alter column updated_at set default now();
alter table if exists public.user_status alter column role set default 'user';
alter table if exists public.user_status alter column last_seen set default now();
alter table if exists public.user_status alter column updated_at set default now();
alter table if exists public.visitor_status alter column display_name set default '';
alter table if exists public.visitor_status alter column role set default 'guest';
alter table if exists public.visitor_status alter column last_seen set default now();
alter table if exists public.visitor_status alter column created_at set default now();
alter table if exists public.visitor_status alter column updated_at set default now();
alter table if exists public.user_bans alter column banned set default true;
alter table if exists public.user_bans alter column banned_at set default now();
alter table if exists public.user_bans alter column updated_at set default now();
alter table if exists public.visitor_bans alter column banned set default true;
alter table if exists public.visitor_bans alter column banned_at set default now();
alter table if exists public.visitor_bans alter column updated_at set default now();

update public.profiles
set user_id = coalesce(user_id, id),
    role = coalesce(nullif(role, ''), public.resolve_default_role(email)),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where user_id is null
   or role is null
   or created_at is null
   or updated_at is null;

update public.user_status
set role = coalesce(nullif(role, ''), public.resolve_default_role(email)),
    last_seen = coalesce(last_seen, now()),
    updated_at = coalesce(updated_at, now())
where role is null
   or last_seen is null
   or updated_at is null;

update public.visitor_status
set display_name = coalesce(nullif(trim(coalesce(display_name, '')), ''), 'Guest ' || upper(right(visitor_id, 6))),
    role = coalesce(nullif(role, ''), case when user_id is not null then 'user' else 'guest' end),
    last_seen = coalesce(last_seen, now()),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where display_name is null
   or btrim(display_name) = ''
   or role is null
   or last_seen is null
   or created_at is null
   or updated_at is null;

update public.user_bans
set banned = coalesce(banned, true),
    banned_at = coalesce(banned_at, now()),
    updated_at = coalesce(updated_at, now())
where banned is null
   or banned_at is null
   or updated_at is null;

update public.visitor_bans
set banned = coalesce(banned, true),
    banned_at = coalesce(banned_at, now()),
    updated_at = coalesce(updated_at, now())
where banned is null
   or banned_at is null
   or updated_at is null;

commit;
