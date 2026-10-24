begin;

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  policy_version text not null,
  granted boolean not null,
  occurred_at timestamptz not null default now(),
  collection_source text not null,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consent_records_type_check check (
    consent_type ~ '^[a-z][a-z0-9._-]{0,99}$'
  ),
  constraint consent_records_policy_version_check check (
    char_length(btrim(policy_version)) between 1 and 80
  ),
  constraint consent_records_source_check check (
    collection_source ~ '^[a-z][a-z0-9._-]{0,79}$'
  ),
  constraint consent_records_ip_hash_check check (
    ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint consent_records_user_agent_hash_check check (
    user_agent_hash is null or user_agent_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint consent_records_immutable_timestamps_check check (
    updated_at = created_at
  )
);

create table public.sharing_grants (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sharing_grants_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint sharing_grants_distinct_users_check check (owner_id <> grantee_user_id),
  constraint sharing_grants_permission_check check (
    permission ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
  ),
  constraint sharing_grants_expiry_check check (
    expires_at is null or expires_at > granted_at
  ),
  constraint sharing_grants_revocation_check check (
    revoked_at is null or revoked_at >= granted_at
  ),
  constraint sharing_grants_timestamps_check check (updated_at >= created_at)
);

comment on table public.sharing_grants is
  'One explicit pregnancy-scoped capability per row. Membership or partner role alone never implies access.';

create table public.access_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  pregnancy_id uuid references public.pregnancies(id) on delete set null,
  event_type text not null,
  resource_type text not null,
  resource_id uuid,
  occurred_at timestamptz not null default now(),
  request_id uuid,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_audit_events_event_type_check check (
    event_type ~ '^[a-z][a-z0-9._-]{0,119}$'
  ),
  constraint access_audit_events_resource_type_check check (
    resource_type ~ '^[a-z][a-z0-9._-]{0,119}$'
  ),
  constraint access_audit_events_ip_hash_check check (
    ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint access_audit_events_metadata_check check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint access_audit_events_immutable_timestamps_check check (
    updated_at = created_at
  )
);

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  platform text not null,
  token_ciphertext text not null,
  token_fingerprint text not null,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_devices_owner_installation_key unique (owner_id, installation_id),
  constraint notification_devices_platform_check check (
    platform in ('ios', 'android', 'web')
  ),
  constraint notification_devices_ciphertext_check check (
    char_length(token_ciphertext) between 32 and 8192
  ),
  constraint notification_devices_fingerprint_check check (
    token_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint notification_devices_timestamps_check check (updated_at >= created_at)
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid,
  export_scope text not null,
  export_format text not null,
  status text not null default 'queued',
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  storage_bucket text,
  storage_path text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint export_jobs_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint export_jobs_scope_check check (
    (export_scope = 'account' and pregnancy_id is null)
    or (export_scope = 'pregnancy' and pregnancy_id is not null)
  ),
  constraint export_jobs_format_check check (export_format in ('json', 'zip')),
  constraint export_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'failed', 'expired', 'cancelled')
  ),
  constraint export_jobs_storage_check check (
    (storage_bucket is null) = (storage_path is null)
  ),
  constraint export_jobs_completion_check check (
    (status = 'completed' and completed_at is not null and storage_path is not null)
    or status <> 'completed'
  ),
  constraint export_jobs_expiry_check check (
    expires_at is null or completed_at is null or expires_at > completed_at
  ),
  constraint export_jobs_timestamps_check check (updated_at >= created_at)
);

create table public.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid,
  deletion_scope text not null,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deletion_jobs_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint deletion_jobs_scope_check check (
    (deletion_scope = 'account' and pregnancy_id is null)
    or (deletion_scope = 'pregnancy' and pregnancy_id is not null)
  ),
  constraint deletion_jobs_status_check check (
    status in ('requested', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')
  ),
  constraint deletion_jobs_schedule_check check (scheduled_for >= requested_at),
  constraint deletion_jobs_completion_check check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  ),
  constraint deletion_jobs_cancellation_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or status <> 'cancelled'
  ),
  constraint deletion_jobs_timestamps_check check (updated_at >= created_at)
);

create unique index sharing_grants_active_capability_key
  on public.sharing_grants(pregnancy_id, grantee_user_id, permission)
  where revoked_at is null;
create index sharing_grants_grantee_active_idx
  on public.sharing_grants(grantee_user_id, pregnancy_id, permission)
  where revoked_at is null;
create index consent_records_owner_occurred_idx
  on public.consent_records(owner_id, occurred_at desc);
create index access_audit_events_subject_occurred_idx
  on public.access_audit_events(subject_user_id, occurred_at desc);
create index access_audit_events_pregnancy_occurred_idx
  on public.access_audit_events(pregnancy_id, occurred_at desc)
  where pregnancy_id is not null;
create index notification_devices_owner_active_idx
  on public.notification_devices(owner_id, last_seen_at desc)
  where disabled_at is null;
create index export_jobs_owner_status_idx
  on public.export_jobs(owner_id, status, requested_at desc);
create index deletion_jobs_owner_status_idx
  on public.deletion_jobs(owner_id, status, requested_at desc);

create or replace function app_private.has_pregnancy_permission(
  target_pregnancy_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1
    from public.pregnancies pregnancy
    where pregnancy.id = target_pregnancy_id
      and pregnancy.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.sharing_grants grant_row
    where grant_row.pregnancy_id = target_pregnancy_id
      and grant_row.grantee_user_id = auth.uid()
      and grant_row.permission = required_permission
      and grant_row.revoked_at is null
      and (grant_row.expires_at is null or grant_row.expires_at > now())
  );
$function$;

comment on function app_private.has_pregnancy_permission(uuid, text) is
  'Checks ownership or one active explicit capability; membership roles do not grant access.';

revoke all on function app_private.has_pregnancy_permission(uuid, text) from public;
revoke all on function app_private.has_pregnancy_permission(uuid, text) from anon;
revoke all on function app_private.has_pregnancy_permission(uuid, text) from authenticated;
grant execute on function app_private.has_pregnancy_permission(uuid, text) to authenticated;
grant execute on function app_private.has_pregnancy_permission(uuid, text) to service_role;

create or replace function app_private.prevent_record_mutation()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  raise exception 'record is append-only' using errcode = '55000';
end;
$function$;

revoke all on function app_private.prevent_record_mutation() from public;
revoke all on function app_private.prevent_record_mutation() from anon;
revoke all on function app_private.prevent_record_mutation() from authenticated;
revoke all on function app_private.prevent_record_mutation() from service_role;

create trigger consent_records_prevent_mutation
before update or delete on public.consent_records
for each row execute function app_private.prevent_record_mutation();
create trigger access_audit_events_prevent_mutation
before update or delete on public.access_audit_events
for each row execute function app_private.prevent_record_mutation();

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sharing_grants',
    'notification_devices',
    'export_jobs',
    'deletion_jobs'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'consent_records',
    'sharing_grants',
    'access_audit_events',
    'notification_devices',
    'export_jobs',
    'deletion_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$migration$;

grant select, insert on public.consent_records to authenticated;
create policy consent_records_owner_read on public.consent_records
  for select to authenticated using (app_private.is_current_user(owner_id));
create policy consent_records_owner_create on public.consent_records
  for insert to authenticated with check (app_private.is_current_user(owner_id));

grant select, insert, update, delete on public.sharing_grants to authenticated;
create policy sharing_grants_owner_manage on public.sharing_grants
  for all to authenticated
  using (app_private.is_current_user(owner_id))
  with check (app_private.is_current_user(owner_id));
create policy sharing_grants_grantee_read on public.sharing_grants
  for select to authenticated
  using (app_private.is_current_user(grantee_user_id));

grant select, insert, update, delete on public.notification_devices to authenticated;
create policy notification_devices_owner_access on public.notification_devices
  for all to authenticated
  using (app_private.is_current_user(owner_id))
  with check (app_private.is_current_user(owner_id));

grant select, insert on public.export_jobs, public.deletion_jobs to authenticated;
create policy export_jobs_owner_read on public.export_jobs
  for select to authenticated using (app_private.is_current_user(owner_id));
create policy export_jobs_owner_create on public.export_jobs
  for insert to authenticated with check (app_private.is_current_user(owner_id));
create policy deletion_jobs_owner_read on public.deletion_jobs
  for select to authenticated using (app_private.is_current_user(owner_id));
create policy deletion_jobs_owner_create on public.deletion_jobs
  for insert to authenticated with check (app_private.is_current_user(owner_id));

-- Sharing is read-only at this layer and always requires a named capability.
-- A pregnancy membership row or relationship label never grants data access.
create policy pregnancies_explicit_grant_read on public.pregnancies
  for select to authenticated
  using (app_private.has_pregnancy_permission(id, 'pregnancy.read'));
create policy pregnancy_members_explicit_grant_read on public.pregnancy_members
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'pregnancy.read'));
create policy providers_explicit_grant_read on public.providers
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'care.read'));
create policy emergency_contacts_explicit_grant_read on public.emergency_contacts
  for select to authenticated
  using (
    pregnancy_id is not null
    and app_private.has_pregnancy_permission(pregnancy_id, 'care.read')
  );

create policy journal_entries_explicit_grant_read on public.journal_entries
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'journal.read'));
create policy photo_series_explicit_grant_read on public.photo_series
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'journal.read'));
create policy media_assets_explicit_grant_read on public.media_assets
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'journal.read'));
create policy journal_entry_tags_explicit_grant_read on public.journal_entry_tags
  for select to authenticated
  using (
    exists (
      select 1 from public.journal_entries entry
      where entry.id = journal_entry_tags.journal_entry_id
        and app_private.has_pregnancy_permission(entry.pregnancy_id, 'journal.read')
    )
  );
create policy tags_explicit_grant_read on public.tags
  for select to authenticated
  using (
    exists (
      select 1
      from public.journal_entry_tags entry_tag
      join public.journal_entries entry on entry.id = entry_tag.journal_entry_id
      where entry_tag.tag_id = tags.id
        and app_private.has_pregnancy_permission(entry.pregnancy_id, 'journal.read')
    )
  );

create policy daily_checkins_explicit_grant_read on public.daily_checkins
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'tracking.read'));
create policy checkin_emotions_explicit_grant_read on public.checkin_emotions
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_checkins checkin
      where checkin.id = checkin_emotions.checkin_id
        and app_private.has_pregnancy_permission(checkin.pregnancy_id, 'tracking.read')
    )
  );
create policy checkin_symptoms_explicit_grant_read on public.checkin_symptoms
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_checkins checkin
      where checkin.id = checkin_symptoms.checkin_id
        and app_private.has_pregnancy_permission(checkin.pregnancy_id, 'tracking.read')
    )
  );
create policy wellness_observations_explicit_grant_read on public.wellness_observations
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'tracking.read'));
create policy meals_explicit_grant_read on public.meals
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'tracking.read'));
create policy meal_items_explicit_grant_read on public.meal_items
  for select to authenticated
  using (
    exists (
      select 1 from public.meals meal
      where meal.id = meal_items.meal_id
        and app_private.has_pregnancy_permission(meal.pregnancy_id, 'tracking.read')
    )
  );

create policy appointments_explicit_grant_read on public.appointments
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'care.read'));
create policy appointment_questions_explicit_grant_read on public.appointment_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.appointments appointment
      where appointment.id = appointment_questions.appointment_id
        and app_private.has_pregnancy_permission(appointment.pregnancy_id, 'care.read')
    )
  );
create policy appointment_notes_explicit_grant_read on public.appointment_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.appointments appointment
      where appointment.id = appointment_notes.appointment_id
        and app_private.has_pregnancy_permission(appointment.pregnancy_id, 'care.read')
    )
  );
create policy medications_explicit_grant_read on public.medications
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'care.read'));
create policy medication_schedules_explicit_grant_read on public.medication_schedules
  for select to authenticated
  using (
    exists (
      select 1 from public.medications medication
      where medication.id = medication_schedules.medication_id
        and app_private.has_pregnancy_permission(medication.pregnancy_id, 'care.read')
    )
  );
create policy documents_explicit_grant_read on public.documents
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'care.read'));

create policy projects_explicit_grant_read on public.projects
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'planning.read'));
create policy tasks_explicit_grant_read on public.tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.projects project
      where project.id = tasks.project_id
        and app_private.has_pregnancy_permission(project.pregnancy_id, 'planning.read')
    )
  );
create policy support_requests_explicit_grant_read on public.support_requests
  for select to authenticated
  using (app_private.has_pregnancy_permission(pregnancy_id, 'planning.read'));

-- No client grants or policies are created for access_audit_events.
-- Only trusted backend roles may append audit events.

commit;
