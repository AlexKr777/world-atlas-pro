begin;

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
  new.created_by = coalesce(new.created_by, auth.uid());
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

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

commit;
