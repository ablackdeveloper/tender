begin;

create table public.medication_change_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null,
  recorded_on date not null,
  change_kind text not null,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_change_records_medication_owner_fk
    foreign key (medication_id, owner_id)
    references public.medications(id, owner_id) on delete cascade,
  constraint medication_change_records_kind_check check (
    change_kind in ('added_to_list', 'details_updated', 'status_recorded', 'other')
  ),
  constraint medication_change_records_details_check check (
    details is null or char_length(btrim(details)) between 1 and 2000
  ),
  constraint medication_change_records_timestamps_check check (updated_at >= created_at)
);

comment on table public.medication_change_records is
  'User-reported medication-list history only. Rows are not instructions to start, stop, or alter medication.';

create index medication_change_records_medication_date_idx
  on public.medication_change_records(medication_id, recorded_on desc);
create trigger set_updated_at before update on public.medication_change_records
  for each row execute function app_private.set_updated_at();
alter table public.medication_change_records enable row level security;
grant select, insert, update, delete on public.medication_change_records to authenticated;
create policy medication_change_records_authorized_select on public.medication_change_records
  for select to authenticated using (app_private.can_read_medication(medication_id));
create policy medication_change_records_owner_insert on public.medication_change_records
  for insert to authenticated with check (owner_id = auth.uid());
create policy medication_change_records_owner_update on public.medication_change_records
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy medication_change_records_owner_delete on public.medication_change_records
  for delete to authenticated using (owner_id = auth.uid());

alter table public.documents
  add column privacy_level text not null default 'private',
  add column upload_status text not null default 'pending',
  add column upload_error_code text,
  add column deleted_at timestamptz,
  add constraint documents_privacy_level_check check (privacy_level in ('private', 'shared')),
  add constraint documents_upload_status_check check (upload_status in ('pending', 'ready', 'failed', 'deleted')),
  add constraint documents_upload_error_code_check check (
    upload_error_code is null or upload_error_code ~ '^[a-z][a-z0-9_]{0,63}$'
  ),
  add constraint documents_deleted_state_check check ((upload_status = 'deleted') = (deleted_at is not null)),
  add constraint documents_opaque_path_check check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{2,8}$'
  ) not valid;

comment on column public.documents.privacy_level is
  'Private is owner-only. Shared permits an active, unexpired care.read grant.';

alter table public.urgent_guidance
  add column locale text not null default 'en-US',
  add column show_on_get_help boolean not null default false,
  add column display_order integer not null default 0,
  add constraint urgent_guidance_locale_check check (
    locale ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-[0-9]{3})?$'
  ),
  add constraint urgent_guidance_display_order_check check (display_order >= 0);

create index urgent_guidance_help_locale_idx
  on public.urgent_guidance(locale, display_order)
  where show_on_get_help;

create or replace function app_private.can_read_document(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1 from public.documents document
    where document.id = target_id
      and document.upload_status = 'ready'
      and document.deleted_at is null
      and (
        document.owner_id = auth.uid()
        or (
          document.privacy_level = 'shared'
          and app_private.has_pregnancy_permission(document.pregnancy_id, 'care.read')
        )
      )
  );
$function$;
revoke all on function app_private.can_read_document(uuid) from public, anon;
grant execute on function app_private.can_read_document(uuid) to authenticated, service_role;

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
      select 1 from public.media_assets asset
      where asset.storage_bucket = target_bucket_id
        and asset.storage_path = target_name
        and asset.upload_status = 'ready'
        and asset.deleted_at is null
        and (
          (asset.journal_entry_id is not null and app_private.can_read_journal_entry(asset.journal_entry_id))
          or (asset.meal_id is not null and app_private.can_read_meal(asset.meal_id))
        )
    )
    when 'tender-documents' then exists (
      select 1 from public.documents document
      where document.storage_bucket = target_bucket_id
        and document.storage_path = target_name
        and app_private.can_read_document(document.id)
    )
    else false
  end;
$function$;

drop policy if exists documents_authorized_select on public.documents;
create policy documents_authorized_select on public.documents
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      privacy_level = 'shared'
      and upload_status = 'ready'
      and deleted_at is null
      and app_private.has_pregnancy_permission(pregnancy_id, 'care.read')
    )
  );

commit;
