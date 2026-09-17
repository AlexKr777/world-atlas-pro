-- Online status via public.user_status
-- Run in Supabase SQL Editor

create table if not exists public.user_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  last_seen timestamptz not null default now()
);

alter table public.user_status enable row level security;

grant select, insert, update on table public.user_status to authenticated;

drop policy if exists "user_status_select_self_or_admin" on public.user_status;
create policy "user_status_select_self_or_admin"
on public.user_status
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin()
);

drop policy if exists "user_status_insert_self" on public.user_status;
create policy "user_status_insert_self"
on public.user_status
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_status_update_self" on public.user_status;
create policy "user_status_update_self"
on public.user_status
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_status'
  ) then
    alter publication supabase_realtime add table public.user_status;
  end if;
end
$$;
