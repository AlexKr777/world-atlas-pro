-- Favorites: UNIQUE + RLS policies
-- Run in Supabase SQL Editor.

begin;

-- 1) Ensure uniqueness for upsert(onConflict: "user_id,place_id")
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'favorites_user_place_unique'
      and conrelid = 'public.favorites'::regclass
  ) then
    alter table public.favorites
      add constraint favorites_user_place_unique
      unique (user_id, place_id);
  end if;
end
$$;

-- 2) Enable RLS
alter table public.favorites enable row level security;

-- 3) Minimal own-row policies
drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
on public.favorites
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
on public.favorites
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
on public.favorites
for delete
to authenticated
using (auth.uid() = user_id);

commit;
