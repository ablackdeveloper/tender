-- Forward repair: NULLIF is SQL syntax, not a schema-qualified function.
-- Preserve grants, conflict handling, and resurfacing rules.
begin;

-- INSERT ... RETURNING needs owner visibility before a STABLE helper can see
-- the new row. Keep the existing helper for explicitly shared access.
alter policy journal_entries_authorized_select on public.journal_entries
  using (owner_id = auth.uid() or app_private.can_read_journal_entry(id));

create or replace function public.save_journal_entry(
  p_entry_id uuid,
  p_pregnancy_id uuid,
  p_title text,
  p_body text,
  p_entry_at timestamptz,
  p_is_pinned boolean,
  p_privacy_level text,
  p_tag_ids uuid[],
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  current_entry public.journal_entries%rowtype;
  saved_entry public.journal_entries%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_body is null or pg_catalog.char_length(pg_catalog.btrim(p_body)) < 1 then
    raise exception 'journal body is required' using errcode = '22023';
  end if;
  if p_privacy_level not in ('private', 'shared') then
    raise exception 'invalid privacy level' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_entry_id::text, 0)
  );

  select entry.* into current_entry
  from public.journal_entries entry
  where entry.id = p_entry_id and entry.owner_id = actor_id;

  if found then
    if p_expected_updated_at is null
      or current_entry.updated_at is distinct from p_expected_updated_at then
      return pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'entry_id', current_entry.id,
        'updated_at', current_entry.updated_at
      );
    end if;

    update public.journal_entries
    set title = nullif(pg_catalog.btrim(p_title), ''),
        body = p_body,
        entry_at = p_entry_at,
        is_pinned = p_is_pinned,
        privacy_level = p_privacy_level
    where id = p_entry_id and owner_id = actor_id
    returning * into saved_entry;
  else
    if p_expected_updated_at is not null then
      return pg_catalog.jsonb_build_object('status', 'missing', 'entry_id', p_entry_id);
    end if;

    insert into public.journal_entries (
      id, pregnancy_id, owner_id, title, body, entry_at, is_pinned, privacy_level
    ) values (
      p_entry_id, p_pregnancy_id, actor_id, nullif(pg_catalog.btrim(p_title), ''),
      p_body, p_entry_at, p_is_pinned, p_privacy_level
    ) returning * into saved_entry;
  end if;

  if exists (
    select 1 from pg_catalog.unnest(coalesce(p_tag_ids, array[]::uuid[])) as input_tag(tag_id)
    where not exists (
      select 1 from public.tags tag where tag.id = input_tag.tag_id and tag.owner_id = actor_id
    )
  ) then
    raise exception 'one or more tags are invalid' using errcode = '22023';
  end if;

  delete from public.journal_entry_tags
  where journal_entry_id = saved_entry.id and owner_id = actor_id;

  insert into public.journal_entry_tags (owner_id, journal_entry_id, tag_id)
  select actor_id, saved_entry.id, input_tag.tag_id
  from pg_catalog.unnest(coalesce(p_tag_ids, array[]::uuid[])) as input_tag(tag_id)
  on conflict (journal_entry_id, tag_id) do nothing;

  return pg_catalog.jsonb_build_object(
    'status', 'saved',
    'entry_id', saved_entry.id,
    'updated_at', saved_entry.updated_at
  );
end;
$function$;

create or replace function public.save_journal_entry_v2(
  p_entry_id uuid,
  p_pregnancy_id uuid,
  p_title text,
  p_body text,
  p_entry_at timestamptz,
  p_is_pinned boolean,
  p_privacy_level text,
  p_resurface_allowed boolean,
  p_tag_ids uuid[],
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  current_entry public.journal_entries%rowtype;
  saved_entry public.journal_entries%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_body is null or pg_catalog.char_length(pg_catalog.btrim(p_body)) < 1 then
    raise exception 'journal body is required' using errcode = '22023';
  end if;
  if p_privacy_level not in ('private', 'shared') then
    raise exception 'invalid privacy level' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_entry_id::text, 0)
  );

  select entry.* into current_entry
  from public.journal_entries entry
  where entry.id = p_entry_id and entry.owner_id = actor_id;

  if found then
    if p_expected_updated_at is null
      or current_entry.updated_at is distinct from p_expected_updated_at then
      return pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'entry_id', current_entry.id,
        'updated_at', current_entry.updated_at
      );
    end if;

    update public.journal_entries
    set title = nullif(pg_catalog.btrim(p_title), ''),
        body = p_body,
        entry_at = p_entry_at,
        is_pinned = p_is_pinned,
        privacy_level = p_privacy_level,
        resurface_allowed = p_resurface_allowed,
        resurface_reviewed_at = case
          when not p_resurface_allowed then null
          when current_entry.resurface_allowed then current_entry.resurface_reviewed_at
          else pg_catalog.statement_timestamp()
        end
    where id = p_entry_id and owner_id = actor_id
    returning * into saved_entry;
  else
    if p_expected_updated_at is not null then
      return pg_catalog.jsonb_build_object('status', 'missing', 'entry_id', p_entry_id);
    end if;

    insert into public.journal_entries (
      id, pregnancy_id, owner_id, title, body, entry_at, is_pinned,
      privacy_level, resurface_allowed, resurface_reviewed_at
    ) values (
      p_entry_id, p_pregnancy_id, actor_id,
      nullif(pg_catalog.btrim(p_title), ''),
      p_body, p_entry_at, p_is_pinned, p_privacy_level, p_resurface_allowed,
      case when p_resurface_allowed then pg_catalog.statement_timestamp() else null end
    ) returning * into saved_entry;
  end if;

  if exists (
    select 1 from pg_catalog.unnest(coalesce(p_tag_ids, array[]::uuid[])) as input_tag(tag_id)
    where not exists (
      select 1 from public.tags tag
      where tag.id = input_tag.tag_id and tag.owner_id = actor_id
    )
  ) then
    raise exception 'one or more tags are invalid' using errcode = '22023';
  end if;

  delete from public.journal_entry_tags
  where journal_entry_id = saved_entry.id and owner_id = actor_id;

  insert into public.journal_entry_tags (owner_id, journal_entry_id, tag_id)
  select actor_id, saved_entry.id, input_tag.tag_id
  from pg_catalog.unnest(coalesce(p_tag_ids, array[]::uuid[])) as input_tag(tag_id)
  on conflict (journal_entry_id, tag_id) do nothing;

  return pg_catalog.jsonb_build_object(
    'status', 'saved',
    'entry_id', saved_entry.id,
    'updated_at', saved_entry.updated_at
  );
end;
$function$;

commit;
