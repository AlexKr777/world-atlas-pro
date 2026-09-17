begin;

alter table if exists public.places
  add column if not exists publish_at timestamptz,
  add column if not exists seasonal_content jsonb not null default '{}'::jsonb;

update public.places
set publish_at = coalesce(publish_at, created_at, now())
where is_public = true
  and publish_at is null;

update public.places
set seasonal_content = coalesce(seasonal_content, '{}'::jsonb)
where seasonal_content is null;

alter table if exists public.user_status
  add column if not exists last_country text,
  add column if not exists last_region text,
  add column if not exists last_city text,
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists geo_source text;

alter table if exists public.visitor_status
  add column if not exists last_country text,
  add column if not exists last_region text,
  add column if not exists last_city text,
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists geo_source text;

create table if not exists public.place_submissions (
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
  seasonal_content jsonb not null default '{}'::jsonb,
  target_visibility text not null default 'public' check (target_visibility in ('public')),
  submission_state text not null default 'pending' check (submission_state in ('pending', 'approved', 'rejected', 'scheduled', 'withdrawn')),
  publish_at timestamptz,
  review_reason text,
  submitter_user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  published_place_id uuid references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.place_submissions
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists description text default 'Description unavailable.',
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists category text,
  add column if not exists tags text[] default '{}',
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists is_free boolean default false,
  add column if not exists family_friendly boolean default false,
  add column if not exists seasonal_content jsonb default '{}'::jsonb,
  add column if not exists target_visibility text default 'public',
  add column if not exists submission_state text default 'pending',
  add column if not exists publish_at timestamptz,
  add column if not exists review_reason text,
  add column if not exists submitter_user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_place_id uuid references public.places (id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.place_submissions alter column description set default 'Description unavailable.';
alter table if exists public.place_submissions alter column tags set default '{}';
alter table if exists public.place_submissions alter column is_free set default false;
alter table if exists public.place_submissions alter column family_friendly set default false;
alter table if exists public.place_submissions alter column seasonal_content set default '{}'::jsonb;
alter table if exists public.place_submissions alter column target_visibility set default 'public';
alter table if exists public.place_submissions alter column submission_state set default 'pending';
alter table if exists public.place_submissions alter column submitter_user_id set default auth.uid();
alter table if exists public.place_submissions alter column created_at set default now();
alter table if exists public.place_submissions alter column updated_at set default now();

update public.place_submissions
set description = coalesce(nullif(description, ''), 'Description unavailable.'),
    tags = coalesce(tags, '{}'),
    is_free = coalesce(is_free, false),
    family_friendly = coalesce(family_friendly, false),
    seasonal_content = coalesce(seasonal_content, '{}'::jsonb),
    target_visibility = coalesce(nullif(target_visibility, ''), 'public'),
    submission_state = coalesce(nullif(submission_state, ''), 'pending'),
    submitter_user_id = coalesce(submitter_user_id, auth.uid()),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where description is null
  or tags is null
  or is_free is null
  or family_friendly is null
   or seasonal_content is null
  or target_visibility is null
  or submission_state is null
   or created_at is null
   or updated_at is null;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz
);

alter table if exists public.user_notifications
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists meta jsonb default '{}'::jsonb,
  add column if not exists is_read boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists read_at timestamptz;

alter table if exists public.user_notifications alter column meta set default '{}'::jsonb;
alter table if exists public.user_notifications alter column is_read set default false;
alter table if exists public.user_notifications alter column created_at set default now();
alter table if exists public.user_notifications alter column updated_at set default now();

update public.user_notifications
set meta = coalesce(meta, '{}'::jsonb),
    is_read = coalesce(is_read, false),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where meta is null
   or is_read is null
   or created_at is null
   or updated_at is null;

create index if not exists places_publish_at_idx
  on public.places (publish_at);

create index if not exists places_public_publish_idx
  on public.places (publish_at, created_at desc)
  where is_public = true;

create index if not exists place_submissions_submitter_idx
  on public.place_submissions (submitter_user_id, created_at desc);

create index if not exists place_submissions_pending_idx
  on public.place_submissions (created_at desc)
  where submission_state = 'pending';

create index if not exists place_submissions_publish_idx
  on public.place_submissions (publish_at, submission_state);

create index if not exists place_submissions_reviewed_idx
  on public.place_submissions (reviewed_at desc);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where is_read = false;

create index if not exists user_status_geo_idx
  on public.user_status (last_country, last_city, last_seen desc);

create index if not exists visitor_status_geo_idx
  on public.visitor_status (last_country, last_city, last_seen desc);

create or replace function public.apply_place_submission_defaults()
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
    'submission-' || left(replace(new.id::text, '-', ''), 12)
  );
  if exists (
    select 1
    from public.place_submissions ps
    where lower(ps.slug) = lower(new.slug)
      and ps.id <> new.id
  ) then
    new.slug = left(new.slug, 82) || '-' || right(replace(new.id::text, '-', ''), 8);
  end if;
  new.description = coalesce(nullif(new.description, ''), 'Description unavailable.');
  new.tags = coalesce(new.tags, '{}');
  new.seasonal_content = coalesce(new.seasonal_content, '{}'::jsonb);
  new.target_visibility = coalesce(nullif(new.target_visibility, ''), 'public');
  new.submission_state = coalesce(nullif(new.submission_state, ''), 'pending');
  new.submitter_user_id = coalesce(new.submitter_user_id, auth.uid());
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists place_submissions_apply_defaults on public.place_submissions;
create trigger place_submissions_apply_defaults
before insert or update on public.place_submissions
for each row
execute function public.apply_place_submission_defaults();

drop trigger if exists user_notifications_touch_updated_at on public.user_notifications;
create trigger user_notifications_touch_updated_at
before update on public.user_notifications
for each row
execute function public.touch_updated_at();

create or replace function public.create_user_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_body text,
  notification_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if target_user_id is null then
    return null;
  end if;

  insert into public.user_notifications (
    user_id,
    type,
    title,
    body,
    meta
  )
  values (
    target_user_id,
    coalesce(nullif(trim(coalesce(notification_type, '')), ''), 'general'),
    coalesce(nullif(trim(coalesce(notification_title, '')), ''), 'Update'),
    coalesce(nullif(trim(coalesce(notification_body, '')), ''), 'There is a new update.'),
    coalesce(notification_meta, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.admin_approve_place_submission(
  target_submission_id uuid,
  review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  submission_row public.place_submissions%rowtype;
  created_place_row public.places%rowtype;
  publish_timestamp timestamptz;
  next_state text;
  note_text text := nullif(trim(coalesce(review_note, '')), '');
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if target_submission_id is null then
    raise exception 'target_submission_id is required';
  end if;

  select *
    into submission_row
  from public.place_submissions
  where id = target_submission_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  publish_timestamp := submission_row.publish_at;

  if submission_row.published_place_id is not null then
    update public.place_submissions
    set submission_state = case
          when publish_timestamp is not null and publish_timestamp > now() then 'scheduled'
          else 'approved'
        end,
        review_reason = coalesce(note_text, review_reason),
        reviewed_by = actor_uid,
        reviewed_at = now(),
        updated_at = now()
    where id = submission_row.id;

    perform public.create_user_notification(
      submission_row.submitter_user_id,
      'place_submission_approved',
      'Point approved',
      case
        when publish_timestamp is not null and publish_timestamp > now() then
          'Your point was approved and will appear on the map at the scheduled time.'
        else
          'Your point was approved and is now visible on the map.'
      end,
      jsonb_build_object(
        'submission_id', submission_row.id,
        'place_id', submission_row.published_place_id,
        'publish_at', publish_timestamp,
        'review_reason', coalesce(note_text, submission_row.review_reason)
      )
    );

    return jsonb_build_object(
      'ok', true,
      'submission_id', submission_row.id,
      'place_id', submission_row.published_place_id,
      'publish_at', publish_timestamp,
      'already_published', true
    );
  end if;

  insert into public.places (
    slug,
    title,
    country,
    region,
    description,
    lat,
    lng,
    category,
    tags,
    image_url,
    image_path,
    is_public,
    is_free,
    family_friendly,
    seasonal_content,
    created_by,
    publish_at
  )
  values (
    submission_row.slug,
    submission_row.title,
    submission_row.country,
    submission_row.region,
    submission_row.description,
    submission_row.lat,
    submission_row.lng,
    submission_row.category,
    coalesce(submission_row.tags, '{}'),
    submission_row.image_url,
    submission_row.image_path,
    true,
    coalesce(submission_row.is_free, false),
    coalesce(submission_row.family_friendly, false),
    coalesce(submission_row.seasonal_content, '{}'::jsonb),
    submission_row.submitter_user_id,
    publish_timestamp
  )
  returning * into created_place_row;

  next_state := case
    when publish_timestamp is not null and publish_timestamp > now() then 'scheduled'
    else 'approved'
  end;

  update public.place_submissions
  set submission_state = next_state,
      review_reason = coalesce(note_text, review_reason),
      reviewed_by = actor_uid,
      reviewed_at = now(),
      published_place_id = created_place_row.id,
      updated_at = now()
  where id = submission_row.id;

  insert into public.admin_action_logs (
    actor_user_id,
    target_user_id,
    action,
    reason,
    meta
  )
  values (
    actor_uid,
    submission_row.submitter_user_id,
    'approve-submission',
    note_text,
    jsonb_build_object(
      'submission_id', submission_row.id,
      'place_id', created_place_row.id,
      'publish_at', publish_timestamp,
      'submission_state', next_state
    )
  );

  perform public.create_user_notification(
    submission_row.submitter_user_id,
    'place_submission_approved',
    'Point approved',
    case
      when publish_timestamp is not null and publish_timestamp > now() then
        'Your point was approved and scheduled for publication.'
      else
        'Your point was approved and is now visible on the map.'
    end,
    jsonb_build_object(
      'submission_id', submission_row.id,
      'place_id', created_place_row.id,
      'publish_at', publish_timestamp,
      'review_reason', note_text
    )
  );

  return jsonb_build_object(
    'ok', true,
    'submission_id', submission_row.id,
    'place_id', created_place_row.id,
    'publish_at', publish_timestamp,
    'submission_state', next_state
  );
end;
$$;

create or replace function public.admin_reject_place_submission(
  target_submission_id uuid,
  review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid := auth.uid();
  submission_row public.place_submissions%rowtype;
  note_text text := nullif(trim(coalesce(review_note, '')), '');
begin
  if not public.is_active_admin(actor_uid) then
    raise exception 'Admin access required';
  end if;
  if target_submission_id is null then
    raise exception 'target_submission_id is required';
  end if;

  select *
    into submission_row
  from public.place_submissions
  where id = target_submission_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  update public.place_submissions
  set submission_state = 'rejected',
      review_reason = coalesce(note_text, 'Rejected by admin'),
      reviewed_by = actor_uid,
      reviewed_at = now(),
      updated_at = now()
  where id = submission_row.id;

  insert into public.admin_action_logs (
    actor_user_id,
    target_user_id,
    action,
    reason,
    meta
  )
  values (
    actor_uid,
    submission_row.submitter_user_id,
    'reject-submission',
    coalesce(note_text, 'Rejected by admin'),
    jsonb_build_object(
      'submission_id', submission_row.id,
      'publish_at', submission_row.publish_at
    )
  );

  perform public.create_user_notification(
    submission_row.submitter_user_id,
    'place_submission_rejected',
    'Point needs changes',
    coalesce(note_text, 'The point was not approved. Please edit the content and submit again.'),
    jsonb_build_object(
      'submission_id', submission_row.id,
      'publish_at', submission_row.publish_at
    )
  );

  return jsonb_build_object(
    'ok', true,
    'submission_id', submission_row.id,
    'submission_state', 'rejected'
  );
end;
$$;

drop view if exists public.admin_place_review_queue;
create view public.admin_place_review_queue
with (security_invoker = true)
as
select
  ps.id,
  ps.slug,
  ps.title,
  ps.description,
  ps.lat,
  ps.lng,
  ps.category,
  ps.tags,
  ps.image_url,
  ps.image_path,
  ps.country,
  ps.region,
  ps.is_free,
  ps.family_friendly,
  ps.seasonal_content,
  ps.target_visibility,
  ps.submission_state,
  ps.publish_at,
  ps.review_reason,
  ps.submitter_user_id,
  ps.reviewed_by,
  ps.reviewed_at,
  ps.published_place_id,
  ps.created_at,
  ps.updated_at,
  coalesce(pr.email, ps.submitter_user_id::text) as submitter_email,
  coalesce(nullif(pr.display_name, ''), nullif(pr.email, ''), ps.submitter_user_id::text) as submitter_display_name,
  coalesce(pr.role, 'user') as submitter_role,
  public.is_active_ban(ub.banned, ub.banned_until) as submitter_is_banned,
  public.is_active_freeze(uf.frozen, uf.frozen_until) as submitter_is_frozen
from public.place_submissions ps
left join public.profiles pr on pr.id = ps.submitter_user_id
left join public.user_bans ub on ub.user_id = ps.submitter_user_id
left join public.user_freezes uf on uf.user_id = ps.submitter_user_id;

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
  nullif(us.last_country, '') as last_country,
  nullif(us.last_region, '') as last_region,
  nullif(us.last_city, '') as last_city,
  us.last_lat,
  us.last_lng,
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
  nullif(vs.last_country, '') as last_country,
  nullif(vs.last_region, '') as last_region,
  nullif(vs.last_city, '') as last_city,
  vs.last_lat,
  vs.last_lng,
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

grant select, insert, update, delete on public.place_submissions to authenticated;
grant select, insert, update on public.user_notifications to authenticated;
grant select on public.admin_place_review_queue to authenticated;
grant execute on function public.create_user_notification(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_approve_place_submission(uuid, text) to authenticated;
grant execute on function public.admin_reject_place_submission(uuid, text) to authenticated;

alter table public.place_submissions enable row level security;
alter table public.user_notifications enable row level security;

drop policy if exists "places public read" on public.places;
create policy "places public read"
on public.places
for select
to authenticated
using (
  public.is_active_admin()
  or (
    created_by = (select auth.uid())
    and not public.is_banned((select auth.uid()))
  )
  or (
    not public.is_banned((select auth.uid()))
    and is_public = true
    and (publish_at is null or publish_at <= now())
  )
);

drop policy if exists "places insert authenticated" on public.places;
create policy "places insert authenticated"
on public.places
for insert
to authenticated
with check (public.is_active_admin());

drop policy if exists "places update owner or admin" on public.places;
create policy "places update owner or admin"
on public.places
for update
to authenticated
using (
  (created_by = (select auth.uid()) and public.is_active_admin())
  or public.is_active_admin()
)
with check (
  (created_by = (select auth.uid()) and public.is_active_admin())
  or public.is_active_admin()
);

drop policy if exists "places delete owner or admin" on public.places;
create policy "places delete owner or admin"
on public.places
for delete
to authenticated
using (
  (created_by = (select auth.uid()) and public.is_active_admin())
  or public.is_active_admin()
);

drop policy if exists "place_submissions read own or admin" on public.place_submissions;
create policy "place_submissions read own or admin"
on public.place_submissions
for select
to authenticated
using (
  submitter_user_id = (select auth.uid())
  or public.is_active_admin()
);

drop policy if exists "place_submissions insert own" on public.place_submissions;
create policy "place_submissions insert own"
on public.place_submissions
for insert
to authenticated
with check (
  submitter_user_id = (select auth.uid())
  and not public.is_write_blocked((select auth.uid()))
);

drop policy if exists "place_submissions update own pending or admin" on public.place_submissions;
create policy "place_submissions update own pending or admin"
on public.place_submissions
for update
to authenticated
using (
  public.is_active_admin()
  or (
    submitter_user_id = (select auth.uid())
    and submission_state = 'pending'
    and not public.is_write_blocked((select auth.uid()))
  )
)
with check (
  public.is_active_admin()
  or (
    submitter_user_id = (select auth.uid())
    and submission_state = 'pending'
    and not public.is_write_blocked((select auth.uid()))
  )
);

drop policy if exists "place_submissions delete own pending or admin" on public.place_submissions;
create policy "place_submissions delete own pending or admin"
on public.place_submissions
for delete
to authenticated
using (
  public.is_active_admin()
  or (
    submitter_user_id = (select auth.uid())
    and submission_state = 'pending'
    and not public.is_write_blocked((select auth.uid()))
  )
);

drop policy if exists "user_notifications read own or admin" on public.user_notifications;
create policy "user_notifications read own or admin"
on public.user_notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_active_admin()
);

drop policy if exists "user_notifications update own or admin" on public.user_notifications;
create policy "user_notifications update own or admin"
on public.user_notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_active_admin()
)
with check (
  user_id = (select auth.uid())
  or public.is_active_admin()
);

drop policy if exists "user_notifications admin insert" on public.user_notifications;
create policy "user_notifications admin insert"
on public.user_notifications
for insert
to authenticated
with check (public.is_active_admin());

drop policy if exists "place-images public read" on storage.objects;
create policy "place-images public read"
on storage.objects
for select
to public
using (
  bucket_id = 'place-images'
  and exists (
    select 1
    from public.places p
    where p.image_path = name
      and p.is_public = true
      and (p.publish_at is null or p.publish_at <= now())
  )
);

drop policy if exists "place-images private read own or admin" on storage.objects;
create policy "place-images private read own or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'place-images'
  and (
    public.is_active_admin()
    or (
      not public.is_write_blocked((select auth.uid()))
      and (
        name like ('user-places/' || (select auth.uid())::text || '/%')
        or name like ('places/' || (select auth.uid())::text || '/%')
      )
    )
    or exists (
      select 1
      from public.place_submissions ps
      where ps.image_path = name
        and ps.submitter_user_id = (select auth.uid())
    )
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
    public.is_active_admin()
    or (
      not public.is_write_blocked((select auth.uid()))
      and (
        name like ('user-places/' || (select auth.uid())::text || '/%')
        or name like ('places/' || (select auth.uid())::text || '/%')
      )
    )
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
    public.is_active_admin()
    or (
      not public.is_write_blocked((select auth.uid()))
      and (
        name like ('user-places/' || (select auth.uid())::text || '/%')
        or name like ('places/' || (select auth.uid())::text || '/%')
      )
    )
  )
)
with check (
  bucket_id = 'place-images'
  and (
    public.is_active_admin()
    or (
      not public.is_write_blocked((select auth.uid()))
      and (
        name like ('user-places/' || (select auth.uid())::text || '/%')
        or name like ('places/' || (select auth.uid())::text || '/%')
      )
    )
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
    public.is_active_admin()
    or (
      not public.is_write_blocked((select auth.uid()))
      and (
        name like ('user-places/' || (select auth.uid())::text || '/%')
        or name like ('places/' || (select auth.uid())::text || '/%')
      )
    )
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.place_submissions;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.user_notifications;
  exception
    when duplicate_object then null;
  end;
end;
$$;

alter table public.place_submissions replica identity full;
alter table public.user_notifications replica identity full;

commit;
