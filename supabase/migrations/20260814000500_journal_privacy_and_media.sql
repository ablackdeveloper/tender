begin;

alter table public.journal_entries
  add column privacy_level text not null default 'private',
  add constraint journal_entries_privacy_level_check
    check (privacy_level in ('private', 'shared'));

alter table public.journal_entries
  add column search_vector tsvector generated always as (
    pg_catalog.setweight(pg_catalog.to_tsvector('simple', coalesce(title, '')), 'A') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('simple', body), 'B')
  ) stored;

create index journal_entries_search_idx
  on public.journal_entries using gin (search_vector);

alter table public.media_assets
  add column media_kind text not null default 'image',
  add column deleted_at timestamptz,
  add column upload_error_code text,
  add constraint media_assets_media_kind_check
    check (media_kind in ('image', 'voice')),
  add constraint media_assets_deleted_state_check
    check ((upload_status = 'deleted') = (deleted_at is not null)) not valid,
  add constraint media_assets_opaque_path_check
    check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{2,8}$') not valid,
  add constraint media_assets_upload_error_code_check
    check (upload_error_code is null or upload_error_code ~ '^[a-z][a-z0-9_]{0,63}$');

comment on column public.journal_entries.privacy_level is
  'Private blocks all grants. Shared permits only an active, unexpired journal.read capability.';
comment on column public.media_assets.storage_path is
  'Opaque asset UUID/object UUID path. Never contains filenames, dates, pregnancy IDs, or user-authored text.';

create or replace function app_private.can_read_journal_entry(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1
    from public.journal_entries entry
    where entry.id = target_id
      and (
        entry.owner_id = auth.uid()
        or (
          entry.privacy_level = 'shared'
          and app_private.has_pregnancy_permission(entry.pregnancy_id, 'journal.read')
        )
      )
  );
$function$;

create or replace function app_private.can_read_storage_object(
  target_bucket_id text,
  target_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select case target_bucket_id
    when 'tender-media' then exists (
      select 1
      from public.media_assets asset
      where asset.storage_bucket = target_bucket_id
        and asset.storage_path = target_name
        and asset.upload_status = 'ready'
        and asset.deleted_at is null
        and asset.journal_entry_id is not null
        and app_private.can_read_journal_entry(asset.journal_entry_id)
    )
    when 'tender-documents' then exists (
      select 1
      from public.documents document
      where document.storage_bucket = target_bucket_id
        and document.storage_path = target_name
        and app_private.has_pregnancy_permission(document.pregnancy_id, 'care.read')
    )
    else false
  end;
$function$;

drop policy if exists journal_entries_authorized_select on public.journal_entries;
create policy journal_entries_authorized_select on public.journal_entries
  for select to authenticated
  using (app_private.can_read_journal_entry(id));

drop policy if exists media_assets_authorized_select on public.media_assets;
create policy media_assets_authorized_select on public.media_assets
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      upload_status = 'ready'
      and deleted_at is null
      and journal_entry_id is not null
      and app_private.can_read_journal_entry(journal_entry_id)
    )
  );

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
    set title = pg_catalog.nullif(pg_catalog.btrim(p_title), ''),
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
      p_entry_id, p_pregnancy_id, actor_id, pg_catalog.nullif(pg_catalog.btrim(p_title), ''),
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

revoke all on function public.save_journal_entry(uuid, uuid, text, text, timestamptz, boolean, text, uuid[], timestamptz) from public, anon;
grant execute on function public.save_journal_entry(uuid, uuid, text, text, timestamptz, boolean, text, uuid[], timestamptz) to authenticated;

create or replace function app_private.list_orphaned_media_objects(
  p_before timestamptz,
  p_limit integer default 100
)
returns table(storage_bucket text, storage_path text)
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select object.bucket_id, object.name
  from storage.objects object
  left join public.media_assets asset
    on asset.storage_bucket = object.bucket_id
   and asset.storage_path = object.name
  where object.bucket_id = 'tender-media'
    and object.created_at < p_before
    and (
      asset.id is null
      or asset.upload_status in ('failed', 'deleted')
      or asset.deleted_at is not null
    )
  order by object.created_at
  limit least(greatest(p_limit, 1), 500);
$function$;

comment on function app_private.list_orphaned_media_objects(timestamptz, integer) is
  'Service-only cleanup input. A scheduled trusted worker deletes returned private objects and stale metadata.';
revoke all on function app_private.list_orphaned_media_objects(timestamptz, integer) from public, anon, authenticated;
grant execute on function app_private.list_orphaned_media_objects(timestamptz, integer) to service_role;

create or replace function public.list_orphaned_media_objects(
  p_before timestamptz,
  p_limit integer default 100
)
returns table(storage_bucket text, storage_path text)
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select orphan.storage_bucket, orphan.storage_path
  from app_private.list_orphaned_media_objects(p_before, p_limit) orphan;
$function$;

comment on function public.list_orphaned_media_objects(timestamptz, integer) is
  'Data API wrapper for the trusted cleanup worker. Client execution is revoked.';
revoke all on function public.list_orphaned_media_objects(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_orphaned_media_objects(timestamptz, integer) to service_role;

commit;
