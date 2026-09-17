-- Reviews schema for World Atlas Pro
-- Run in Supabase SQL Editor.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_place_user_unique unique (place_id, user_id)
);

-- Repair existing partial schema (when table was created manually before this script).
alter table if exists public.reviews
  add column if not exists id uuid,
  add column if not exists place_id uuid,
  add column if not exists user_id uuid,
  add column if not exists rating smallint,
  add column if not exists comment text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.reviews
set
  comment = coalesce(comment, ''),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now())
where
  comment is null
  or created_at is null
  or updated_at is null;

alter table public.reviews
  alter column id set default gen_random_uuid(),
  alter column comment set default '',
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_place_user_unique'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_place_user_unique unique (place_id, user_id);
  end if;
exception
  when duplicate_object then
    null;
end $$;

create index if not exists reviews_place_created_idx
  on public.reviews (place_id, created_at desc);

create index if not exists reviews_user_created_idx
  on public.reviews (user_id, created_at desc);

create or replace function public.reviews_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
before update on public.reviews
for each row
execute procedure public.reviews_touch_updated_at();

alter table public.reviews enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and policyname = 'reviews_select_authenticated'
  ) then
    create policy reviews_select_authenticated
      on public.reviews
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and policyname = 'reviews_insert_own'
  ) then
    create policy reviews_insert_own
      on public.reviews
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and policyname = 'reviews_update_own'
  ) then
    create policy reviews_update_own
      on public.reviews
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and policyname = 'reviews_delete_own'
  ) then
    create policy reviews_delete_own
      on public.reviews
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.reviews to authenticated;

-- Optional: reviews for local seed places with string IDs (slug), e.g. "lands-end-sf".
-- App uses this table automatically for non-UUID place IDs.
create table if not exists public.reviews_by_slug (
  id uuid primary key default gen_random_uuid(),
  place_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_by_slug_place_user_unique unique (place_slug, user_id)
);

-- Repair existing partial schema (when table was created manually before this script).
alter table if exists public.reviews_by_slug
  add column if not exists id uuid,
  add column if not exists place_slug text,
  add column if not exists user_id uuid,
  add column if not exists rating smallint,
  add column if not exists comment text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.reviews_by_slug
set
  comment = coalesce(comment, ''),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now())
where
  comment is null
  or created_at is null
  or updated_at is null;

alter table public.reviews_by_slug
  alter column id set default gen_random_uuid(),
  alter column comment set default '',
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_by_slug_place_user_unique'
      and conrelid = 'public.reviews_by_slug'::regclass
  ) then
    alter table public.reviews_by_slug
      add constraint reviews_by_slug_place_user_unique unique (place_slug, user_id);
  end if;
exception
  when duplicate_object then
    null;
end $$;

create index if not exists reviews_by_slug_place_created_idx
  on public.reviews_by_slug (place_slug, created_at desc);

create index if not exists reviews_by_slug_user_created_idx
  on public.reviews_by_slug (user_id, created_at desc);

drop trigger if exists reviews_by_slug_touch_updated_at on public.reviews_by_slug;
create trigger reviews_by_slug_touch_updated_at
before update on public.reviews_by_slug
for each row
execute procedure public.reviews_touch_updated_at();

alter table public.reviews_by_slug enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews_by_slug'
      and policyname = 'reviews_by_slug_select_authenticated'
  ) then
    create policy reviews_by_slug_select_authenticated
      on public.reviews_by_slug
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews_by_slug'
      and policyname = 'reviews_by_slug_insert_own'
  ) then
    create policy reviews_by_slug_insert_own
      on public.reviews_by_slug
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews_by_slug'
      and policyname = 'reviews_by_slug_update_own'
  ) then
    create policy reviews_by_slug_update_own
      on public.reviews_by_slug
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews_by_slug'
      and policyname = 'reviews_by_slug_delete_own'
  ) then
    create policy reviews_by_slug_delete_own
      on public.reviews_by_slug
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.reviews_by_slug to authenticated;
