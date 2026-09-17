begin;

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.slugify_text(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

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

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_match check (id = user_id)
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  country text,
  country_code text,
  region text,
  description text not null default 'Description unavailable.',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  category text,
  tags text[] not null default '{}',
  image_url text,
  image_path text,
  link text,
  population bigint,
  area_km2 numeric(12, 2),
  currency text,
  languages text[] not null default '{}',
  utc_offset text,
  climate text,
  founded text,
  fun_fact text,
  is_public boolean not null default true,
  is_free boolean not null default false,
  family_friendly boolean not null default false,
  seasonal_content jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_places (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text not null,
  description text not null default 'Description unavailable.',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  category text,
  tags text[] not null default '{}',
  image_url text,
  image_path text,
  country text,
  region text,
  is_free boolean not null default false,
  family_friendly boolean not null default false,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  delete_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_user_place_unique unique (user_id, place_id)
);

create table if not exists public.user_bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  banned boolean not null default true,
  reason text,
  banned_by uuid references auth.users (id) on delete set null,
  banned_at timestamptz not null default now(),
  banned_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  banned_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint visitor_bans_id_length check (char_length(visitor_id) between 12 and 120)
);

-- Normalize legacy installs before any indexes, views, or functions reference new columns.
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

alter table if exists public.places
  add column if not exists seasonal_content jsonb default '{}'::jsonb;

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
alter table if exists public.places alter column seasonal_content set default '{}'::jsonb;

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

update public.places
set seasonal_content = coalesce(seasonal_content, '{}'::jsonb)
where seasonal_content is null;

create unique index if not exists places_slug_unique_idx
  on public.places (lower(slug));

create index if not exists places_created_by_idx
  on public.places (created_by);

create index if not exists places_region_idx
  on public.places (region);

create index if not exists places_category_idx
  on public.places (category);

create index if not exists places_tags_gin_idx
  on public.places using gin (tags);

create index if not exists user_places_user_id_idx
  on public.user_places (user_id);

create index if not exists user_places_tags_gin_idx
  on public.user_places using gin (tags);

create index if not exists reviews_place_id_idx
  on public.reviews (place_id);

create index if not exists reviews_user_id_idx
  on public.reviews (user_id);

create index if not exists reviews_created_at_idx
  on public.reviews (created_at desc);

create index if not exists user_bans_active_idx
  on public.user_bans (user_id, banned, banned_until);

create index if not exists user_status_last_seen_idx
  on public.user_status (last_seen desc);

create index if not exists visitor_status_last_seen_idx
  on public.visitor_status (last_seen desc);

create index if not exists visitor_status_user_id_idx
  on public.visitor_status (user_id);

create index if not exists visitor_bans_active_idx
  on public.visitor_bans (visitor_id, banned, banned_until);

create or replace function public.apply_profile_defaults()
returns trigger
language plpgsql
as $$
begin
  new.user_id = coalesce(new.user_id, new.id);
  new.email = nullif(lower(coalesce(new.email, '')), '');
  new.role = coalesce(nullif(new.role, ''), public.resolve_default_role(new.email));
  return new;
end;
$$;

drop trigger if exists profiles_apply_defaults on public.profiles;
create trigger profiles_apply_defaults
before insert or update on public.profiles
for each row
execute function public.apply_profile_defaults();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

create or replace function public.handle_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, user_id, email, role)
  values (
    new.id,
    new.id,
    nullif(lower(coalesce(new.email, '')), ''),
    public.resolve_default_role(new.email)
  )
  on conflict (id) do update
    set user_id = excluded.user_id,
        email = excluded.email,
        role = public.resolve_default_role(excluded.email),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of email on auth.users
for each row
execute function public.handle_profile_sync();

insert into public.profiles (id, user_id, email, role)
select
  u.id,
  u.id,
  nullif(lower(coalesce(u.email, '')), ''),
  public.resolve_default_role(u.email)
from auth.users u
on conflict (id) do update
  set user_id = excluded.user_id,
      email = excluded.email,
      role = public.resolve_default_role(excluded.email),
      updated_at = now();

create or replace function public.apply_place_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id = gen_random_uuid();
  end if;
  new.slug = coalesce(
    nullif(public.slugify_text(new.slug), ''),
    nullif(public.slugify_text(new.title), ''),
    'place-' || left(replace(new.id::text, '-', ''), 12)
  );
  if exists (
    select 1
    from public.places existing_place
    where lower(existing_place.slug) = lower(new.slug)
      and existing_place.id <> new.id
  ) then
    new.slug = left(new.slug, 82) || '-' || right(replace(new.id::text, '-', ''), 8);
  end if;
  new.tags = coalesce(new.tags, '{}');
  new.languages = coalesce(new.languages, '{}');
  new.seasonal_content = coalesce(new.seasonal_content, '{}'::jsonb);
  new.created_by = coalesce(new.created_by, auth.uid());
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists places_apply_defaults on public.places;
create trigger places_apply_defaults
before insert or update on public.places
for each row
execute function public.apply_place_defaults();

create or replace function public.apply_user_place_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id = gen_random_uuid();
  end if;
  new.slug = coalesce(
    nullif(public.slugify_text(new.slug), ''),
    nullif(public.slugify_text(new.title), ''),
    'place-' || left(replace(new.id::text, '-', ''), 12)
  );
  new.tags = coalesce(new.tags, '{}');
  new.user_id = coalesce(new.user_id, auth.uid());
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_places_apply_defaults on public.user_places;
create trigger user_places_apply_defaults
before insert or update on public.user_places
for each row
execute function public.apply_user_place_defaults();

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
before update on public.reviews
for each row
execute function public.touch_updated_at();

drop trigger if exists user_bans_touch_updated_at on public.user_bans;
create trigger user_bans_touch_updated_at
before update on public.user_bans
for each row
execute function public.touch_updated_at();

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

create or replace function public.is_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(target_user_id, auth.uid())
      and p.role = 'admin'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid());
$$;

create or replace function public.is_active_ban(banned_flag boolean, banned_until timestamptz)
returns boolean
language sql
stable
as $$
  select coalesce(banned_flag, false)
    and (banned_until is null or banned_until > now());
$$;

create or replace function public.resolve_ban_until(minutes integer)
returns timestamptz
language sql
stable
as $$
  select case
    when minutes is not null and minutes > 0 then now() + make_interval(mins => minutes)
    else null
  end;
$$;

create or replace function public.is_banned(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_bans b
    where b.user_id = coalesce(target_user_id, auth.uid())
      and public.is_active_ban(b.banned, b.banned_until)
  );
$$;

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_banned(auth.uid());
$$;

create or replace function public.is_active_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(coalesce(target_user_id, auth.uid()))
    and not public.is_banned(coalesce(target_user_id, auth.uid()));
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_admin(auth.uid());
$$;

create or replace function public.resolve_user_id_by_email(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := nullif(lower(trim(coalesce(target_email, ''))), '');
  resolved_user_id uuid;
begin
  if normalized_email is null then
    return null;
  end if;

  select u.id
    into resolved_user_id
  from auth.users u
  where lower(coalesce(u.email, '')) = normalized_email
  limit 1;

  if resolved_user_id is not null then
    return resolved_user_id;
  end if;

  select p.id
    into resolved_user_id
  from public.profiles p
  where lower(coalesce(p.email, '')) = normalized_email
  limit 1;

  return resolved_user_id;
end;
$$;

create or replace function public.admin_ban_user(target_user_id uuid, minutes integer default null, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  safe_reason text := nullif(trim(coalesce(reason, '')), '');
  ban_until timestamptz := public.resolve_ban_until(minutes);
  mirrored_visitors integer := 0;
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;
  if target_user_id = actor_uid then
    raise exception 'You cannot ban yourself';
  end if;

  insert into public.user_bans (user_id, banned, reason, banned_by, banned_at, banned_until)
  values (target_user_id, true, safe_reason, actor_uid, now(), ban_until)
  on conflict (user_id) do update
    set banned = true,
        reason = excluded.reason,
        banned_by = excluded.banned_by,
        banned_at = now(),
        banned_until = excluded.banned_until,
        updated_at = now();

  with mirrored as (
    insert into public.visitor_bans (visitor_id, banned, reason, banned_by, banned_at, banned_until)
    select
      vs.visitor_id,
      true,
      safe_reason,
      actor_uid,
      now(),
      ban_until
    from public.visitor_status vs
    where vs.user_id = target_user_id
    on conflict (visitor_id) do update
      set banned = true,
          reason = excluded.reason,
          banned_by = excluded.banned_by,
          banned_at = now(),
          banned_until = excluded.banned_until,
          updated_at = now()
    returning visitor_id
  )
  select count(*)::integer into mirrored_visitors
  from mirrored;

  return jsonb_build_object(
    'ok', true,
    'user_id', target_user_id,
    'minutes', minutes,
    'banned_until', ban_until,
    'is_permanent', ban_until is null,
    'mirrored_visitors', mirrored_visitors
  );
end;
$$;

create or replace function public.admin_unban_user(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  mirrored_visitors integer := 0;
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;
  if target_user_id = actor_uid then
    raise exception 'You cannot unban yourself';
  end if;

  insert into public.user_bans (user_id, banned, reason, banned_by, banned_at, banned_until)
  values (target_user_id, false, null, actor_uid, now(), null)
  on conflict (user_id) do update
    set banned = false,
        reason = null,
        banned_by = excluded.banned_by,
        banned_at = now(),
        banned_until = null,
        updated_at = now();

  with mirrored as (
    insert into public.visitor_bans (visitor_id, banned, reason, banned_by, banned_at, banned_until)
    select
      vs.visitor_id,
      false,
      null,
      actor_uid,
      now(),
      null
    from public.visitor_status vs
    where vs.user_id = target_user_id
    on conflict (visitor_id) do update
      set banned = false,
          reason = null,
          banned_by = excluded.banned_by,
          banned_at = now(),
          banned_until = null,
          updated_at = now()
    returning visitor_id
  )
  select count(*)::integer into mirrored_visitors
  from mirrored;

  return jsonb_build_object(
    'ok', true,
    'user_id', target_user_id,
    'mirrored_visitors', mirrored_visitors
  );
end;
$$;

create or replace function public.ban_user(target_uid uuid, p_reason text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.admin_ban_user(target_uid, null, p_reason);
$$;

create or replace function public.unban_user(target_uid uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.admin_unban_user(target_uid);
$$;

create or replace function public.admin_ban_email(email text, minutes integer, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_uid uuid := auth.uid();
  resolved_user_id uuid;
  normalized_email text := nullif(lower(trim(coalesce(email, ''))), '');
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if normalized_email is null then
    raise exception 'email is required';
  end if;

  resolved_user_id := public.resolve_user_id_by_email(normalized_email);
  if resolved_user_id is null then
    raise exception 'User with this email was not found';
  end if;

  return public.admin_ban_user(resolved_user_id, minutes, reason)
    || jsonb_build_object('email', normalized_email);
end;
$$;

create or replace function public.admin_unban_email(email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_uid uuid := auth.uid();
  resolved_user_id uuid;
  normalized_email text := nullif(lower(trim(coalesce(email, ''))), '');
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if normalized_email is null then
    raise exception 'email is required';
  end if;

  resolved_user_id := public.resolve_user_id_by_email(normalized_email);
  if resolved_user_id is null then
    raise exception 'User with this email was not found';
  end if;

  return public.admin_unban_user(resolved_user_id)
    || jsonb_build_object('email', normalized_email);
end;
$$;

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
      and public.is_active_ban(b.banned, b.banned_until)
  );
$$;

create or replace function public.admin_ban_visitor(target_visitor_id text, minutes integer default null, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  safe_visitor_id text := nullif(trim(coalesce(target_visitor_id, '')), '');
  safe_reason text := nullif(trim(coalesce(reason, '')), '');
  ban_until timestamptz := public.resolve_ban_until(minutes);
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if safe_visitor_id is null then
    raise exception 'target_visitor_id is required';
  end if;

  insert into public.visitor_bans (visitor_id, banned, reason, banned_by, banned_at, banned_until)
  values (safe_visitor_id, true, safe_reason, actor_uid, now(), ban_until)
  on conflict (visitor_id) do update
    set banned = true,
        reason = excluded.reason,
        banned_by = excluded.banned_by,
        banned_at = now(),
        banned_until = excluded.banned_until,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'visitor_id', safe_visitor_id,
    'minutes', minutes,
    'banned_until', ban_until,
    'is_permanent', ban_until is null
  );
end;
$$;

create or replace function public.admin_unban_visitor(target_visitor_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  safe_visitor_id text := nullif(trim(coalesce(target_visitor_id, '')), '');
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if safe_visitor_id is null then
    raise exception 'target_visitor_id is required';
  end if;

  insert into public.visitor_bans (visitor_id, banned, reason, banned_by, banned_at, banned_until)
  values (safe_visitor_id, false, null, actor_uid, now(), null)
  on conflict (visitor_id) do update
    set banned = false,
        reason = null,
        banned_by = excluded.banned_by,
        banned_at = now(),
        banned_until = null,
        updated_at = now();

  return jsonb_build_object('ok', true, 'visitor_id', safe_visitor_id);
end;
$$;

create or replace function public.ban_visitor(target_visitor_id text, p_reason text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.admin_ban_visitor(target_visitor_id, null, p_reason);
$$;

create or replace function public.unban_visitor(target_visitor_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.admin_unban_visitor(target_visitor_id);
$$;

drop view if exists public.reviews_by_slug;
create view public.reviews_by_slug
with (security_invoker = true)
as
select
  r.id,
  r.user_id,
  r.place_id,
  p.slug as place_slug,
  r.rating,
  r.comment,
  r.created_at,
  r.updated_at
from public.reviews r
join public.places p on p.id = r.place_id
where coalesce(r.is_deleted, false) = false;

drop view if exists public.place_reviews_summary;
create view public.place_reviews_summary
with (security_invoker = true)
as
select
  r.place_id,
  round(avg(r.rating)::numeric, 1) as avg_rating,
  count(*)::integer as reviews_count
from public.reviews r
where coalesce(r.is_deleted, false) = false
group by r.place_id;

drop view if exists public.admin_reviews;
create view public.admin_reviews
with (security_invoker = true)
as
select
  r.id,
  r.user_id,
  coalesce(pr.email, '') as email,
  r.place_id,
  coalesce(p.title, 'Unknown place') as place_title,
  r.rating,
  r.comment,
  r.created_at,
  r.updated_at,
  coalesce(r.is_deleted, false) as is_deleted,
  r.deleted_at,
  r.deleted_by,
  r.delete_reason
from public.reviews r
left join public.places p on p.id = r.place_id
left join public.profiles pr on pr.id = r.user_id;

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
  null::text as last_path,
  null::text as user_agent,
  true as is_registered,
  public.is_active_ban(ub.banned, ub.banned_until) as is_banned,
  ub.reason as ban_reason,
  coalesce(ub.banned_at, ub.updated_at, ub.banned_until) as banned_at,
  ub.banned_until,
  (coalesce(ub.banned, false) and ub.banned_until is null) as is_permanent_ban
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
  coalesce(nullif(vs.last_path, ''), '/') as last_path,
  nullif(vs.user_agent, '') as user_agent,
  false as is_registered,
  public.is_active_ban(vb.banned, vb.banned_until) as is_banned,
  vb.reason as ban_reason,
  vb.banned_at,
  vb.banned_until,
  (coalesce(vb.banned, false) and vb.banned_until is null) as is_permanent_ban
from public.visitor_status vs
left join public.visitor_bans vb on vb.visitor_id = vs.visitor_id
where vs.user_id is null
   or public.is_active_ban(vb.banned, vb.banned_until);

grant usage on schema public to anon, authenticated;

revoke select on public.places from anon;
grant select on public.places to authenticated;
grant insert, update, delete on public.places to authenticated;

grant select on public.user_places to authenticated;
grant insert, update, delete on public.user_places to authenticated;

grant select on public.favorites to authenticated;
grant insert, update, delete on public.favorites to authenticated;

revoke select on public.reviews from anon;
grant select on public.reviews to authenticated;
grant insert, update, delete on public.reviews to authenticated;

grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;

grant select on public.user_bans to authenticated;
grant insert, update, delete on public.user_bans to authenticated;

grant select, insert, update, delete on public.user_status to authenticated;
grant select on public.visitor_status to authenticated;
grant select, insert, update, delete on public.visitor_bans to authenticated;

revoke select on public.reviews_by_slug from anon;
revoke select on public.place_reviews_summary from anon;
grant select on public.reviews_by_slug to authenticated;
grant select on public.place_reviews_summary to authenticated;
grant select on public.admin_reviews to authenticated;
grant select on public.admin_live_presence to authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.is_active_admin(uuid) to authenticated;
grant execute on function public.is_banned() to authenticated;
grant execute on function public.is_banned(uuid) to authenticated;
grant execute on function public.is_visitor_banned(text) to authenticated;
grant execute on function public.admin_ban_user(uuid, integer, text) to authenticated;
grant execute on function public.admin_unban_user(uuid) to authenticated;
grant execute on function public.ban_user(uuid, text) to authenticated;
grant execute on function public.unban_user(uuid) to authenticated;
grant execute on function public.admin_ban_visitor(text, integer, text) to authenticated;
grant execute on function public.admin_unban_visitor(text) to authenticated;
grant execute on function public.ban_visitor(text, text) to authenticated;
grant execute on function public.unban_visitor(text) to authenticated;
grant execute on function public.admin_ban_email(text, integer, text) to authenticated;
grant execute on function public.admin_unban_email(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.user_places enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.user_bans enable row level security;
alter table public.user_status enable row level security;
alter table public.visitor_status enable row level security;
alter table public.visitor_bans enable row level security;

drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_active_admin());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and user_id = auth.uid()
  and not public.is_banned(auth.uid())
);

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin"
on public.profiles
for update
to authenticated
using (
  (id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
)
with check (
  (id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "places authenticated read" on public.places;
drop policy if exists "places public read" on public.places;
create policy "places public read"
on public.places
for select
to authenticated
using (
  (
    not public.is_banned(auth.uid())
    and (is_public = true or created_by = auth.uid())
  )
  or public.is_active_admin()
);

drop policy if exists "places insert authenticated" on public.places;
create policy "places insert authenticated"
on public.places
for insert
to authenticated
with check (
  (
    not public.is_banned(auth.uid())
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
  (created_by = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
)
with check (
  (created_by = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "places delete owner or admin" on public.places;
create policy "places delete owner or admin"
on public.places
for delete
to authenticated
using (
  (created_by = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "user_places select owner or admin" on public.user_places;
create policy "user_places select owner or admin"
on public.user_places
for select
to authenticated
using (
  (user_id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "user_places insert owner" on public.user_places;
create policy "user_places insert owner"
on public.user_places
for insert
to authenticated
with check (
  (
    not public.is_banned(auth.uid())
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
  (user_id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
)
with check (
  (user_id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "user_places delete owner or admin" on public.user_places;
create policy "user_places delete owner or admin"
on public.user_places
for delete
to authenticated
using (
  (user_id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "favorites read own" on public.favorites;
create policy "favorites read own"
on public.favorites
for select
to authenticated
using (user_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy if exists "favorites write own" on public.favorites;
create policy "favorites write own"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy if exists "favorites delete own" on public.favorites;
create policy "favorites delete own"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy if exists "reviews read visible" on public.reviews;
create policy "reviews read visible"
on public.reviews
for select
to authenticated
using (
  (
    not public.is_banned(auth.uid())
    and coalesce(is_deleted, false) = false
  )
  or public.is_active_admin()
);

drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own"
on public.reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and not public.is_banned(auth.uid())
);

drop policy if exists "reviews update own or admin" on public.reviews;
create policy "reviews update own or admin"
on public.reviews
for update
to authenticated
using (
  (user_id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
)
with check (
  (user_id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "reviews delete own or admin" on public.reviews;
create policy "reviews delete own or admin"
on public.reviews
for delete
to authenticated
using (
  (user_id = auth.uid() and not public.is_banned(auth.uid()))
  or public.is_active_admin()
);

drop policy if exists "user_bans read self or admin" on public.user_bans;
create policy "user_bans read self or admin"
on public.user_bans
for select
to authenticated
using (user_id = auth.uid() or public.is_active_admin());

drop policy if exists "user_bans admin write" on public.user_bans;
create policy "user_bans admin write"
on public.user_bans
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "user_status admin read" on public.user_status;
create policy "user_status admin read"
on public.user_status
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "user_status self insert or admin" on public.user_status;
create policy "user_status self insert or admin"
on public.user_status
for insert
to authenticated
with check (user_id = auth.uid() or public.is_active_admin());

drop policy if exists "user_status self update or admin" on public.user_status;
create policy "user_status self update or admin"
on public.user_status
for update
to authenticated
using (user_id = auth.uid() or public.is_active_admin())
with check (user_id = auth.uid() or public.is_active_admin());

drop policy if exists "user_status self delete or admin" on public.user_status;
create policy "user_status self delete or admin"
on public.user_status
for delete
to authenticated
using (user_id = auth.uid() or public.is_active_admin());

drop policy if exists "visitor_status admin read" on public.visitor_status;
create policy "visitor_status admin read"
on public.visitor_status
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "visitor_bans admin read" on public.visitor_bans;
create policy "visitor_bans admin read"
on public.visitor_bans
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "visitor_bans admin write" on public.visitor_bans;
create policy "visitor_bans admin write"
on public.visitor_bans
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

insert into storage.buckets (id, name, public)
values ('place-images', 'place-images', false)
on conflict (id) do nothing;

drop policy if exists "place-images public read" on storage.objects;
create policy "place-images public read"
on storage.objects
for select
to public
using (
  bucket_id = 'place-images'
  and name like 'places/%'
);

drop policy if exists "place-images private read own or admin" on storage.objects;
create policy "place-images private read own or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'place-images'
  and (
    (
      not public.is_banned(auth.uid())
      and (
        name like ('user-places/' || auth.uid()::text || '/%')
        or name like ('places/' || auth.uid()::text || '/%')
      )
    )
    or public.is_active_admin()
  )
);

drop policy if exists "place-images write own or admin" on storage.objects;
create policy "place-images write own or admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'place-images'
  and (
    (
      not public.is_banned(auth.uid())
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
      not public.is_banned(auth.uid())
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
      not public.is_banned(auth.uid())
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
      not public.is_banned(auth.uid())
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
    alter publication supabase_realtime add table public.user_status;
  exception
    when duplicate_object then null;
  end;
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

alter table public.user_status replica identity full;
alter table public.user_bans replica identity full;
alter table public.visitor_status replica identity full;
alter table public.visitor_bans replica identity full;

commit;
