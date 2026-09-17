-- Optional schema for full Guide/Planner server-side aggregates.
-- Run in Supabase SQL editor if you want remote community metrics + trip plan sync.

-- 1) Planner storage for authenticated users
create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Saved route',
  mode text not null default 'car',
  points jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  route_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_plans enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trip_plans'
      and policyname = 'trip_plans_select_own'
  ) then
    create policy trip_plans_select_own
      on public.trip_plans
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trip_plans'
      and policyname = 'trip_plans_insert_own'
  ) then
    create policy trip_plans_insert_own
      on public.trip_plans
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trip_plans'
      and policyname = 'trip_plans_update_own'
  ) then
    create policy trip_plans_update_own
      on public.trip_plans
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trip_plans'
      and policyname = 'trip_plans_delete_own'
  ) then
    create policy trip_plans_delete_own
      on public.trip_plans
      for delete
      using (user_id = auth.uid());
  end if;
end$$;

create index if not exists trip_plans_user_updated_idx
  on public.trip_plans (user_id, updated_at desc);

-- 2) Community metrics source for Guide
-- Uses public.reviews(place_id uuid, rating ...).
-- Run docs/reviews-supabase.sql first to create public.reviews.
create or replace view public.place_metrics_public as
select
  p.id as place_id,
  coalesce(avg(r.rating)::numeric(3,2), 0) as avg_rating,
  coalesce(count(r.*), 0)::int as reviews_count,
  coalesce(count(f.*), 0)::int as favorites_count
from public.places p
left join public.favorites f on f.place_id = p.id
left join public.reviews r on r.place_id = p.id
where p.is_public = true
group by p.id;

grant select on public.place_metrics_public to anon, authenticated;

-- 3) Optional RPC API used by travel-shell.js fallback
create or replace function public.guide_place_metrics(place_ids uuid[])
returns table (
  place_id uuid,
  avg_rating numeric,
  reviews_count int,
  favorites_count int
)
language sql
stable
security invoker
as $$
  select
    v.place_id,
    v.avg_rating,
    v.reviews_count,
    v.favorites_count
  from public.place_metrics_public v
  where place_ids is null or v.place_id = any(place_ids);
$$;

grant execute on function public.guide_place_metrics(uuid[]) to anon, authenticated;
