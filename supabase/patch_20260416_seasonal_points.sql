begin;

alter table if exists public.places
  add column if not exists seasonal_content jsonb not null default '{}'::jsonb;

alter table if exists public.place_submissions
  add column if not exists seasonal_content jsonb not null default '{}'::jsonb;

alter table if exists public.places
  alter column seasonal_content set default '{}'::jsonb;

alter table if exists public.place_submissions
  alter column seasonal_content set default '{}'::jsonb;

update public.places
set seasonal_content = coalesce(seasonal_content, '{}'::jsonb)
where seasonal_content is null;

update public.place_submissions
set seasonal_content = coalesce(seasonal_content, '{}'::jsonb)
where seasonal_content is null;

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

commit;
