-- Smart filters + shared visibility schema for public.places
-- Run in Supabase SQL Editor.

alter table if exists public.places
  add column if not exists category text,
  add column if not exists tags text[] default '{}'::text[],
  add column if not exists image_url text,
  add column if not exists is_public boolean not null default true,
  add column if not exists is_free boolean not null default false,
  add column if not exists family_friendly boolean not null default false,
  add column if not exists updated_at timestamptz default now();

update public.places
set
  is_public = coalesce(is_public, true),
  is_free = coalesce(is_free, false),
  family_friendly = coalesce(family_friendly, false),
  tags = coalesce(tags, '{}'::text[])
where
  is_public is null
  or is_free is null
  or family_friendly is null
  or tags is null;

create index if not exists places_region_idx on public.places (region);
create index if not exists places_category_idx on public.places (category);
create index if not exists places_is_public_idx on public.places (is_public);
create index if not exists places_is_free_idx on public.places (is_free);
create index if not exists places_family_friendly_idx on public.places (family_friendly);
create index if not exists places_updated_at_idx on public.places (updated_at desc);
create index if not exists places_tags_gin_idx on public.places using gin (tags);

-- Optional but recommended for broad sharing in authenticated mode:
-- create policy "places_select_public_or_owner"
--   on public.places
--   for select
--   to authenticated
--   using (is_public = true or created_by = auth.uid());
