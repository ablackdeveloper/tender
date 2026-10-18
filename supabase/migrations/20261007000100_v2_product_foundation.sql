begin;

alter table public.journal_entries
  add column resurface_allowed boolean not null default false,
  add column resurface_reviewed_at timestamptz;

comment on column public.journal_entries.resurface_allowed is
  'Owner opt-in for calm memory resurfacing. It never enables sharing.';

alter table public.appointment_questions
  add column priority smallint not null default 1,
  add column status text not null default 'open',
  add column source_type text not null default 'manual',
  add column source_id uuid,
  add column selected_for_summary boolean not null default false,
  add constraint appointment_questions_priority_check check (priority between 1 and 3),
  add constraint appointment_questions_status_check
    check (status in ('open', 'discussed', 'answered', 'removed')),
  add constraint appointment_questions_source_type_check
    check (source_type in ('manual', 'check_in', 'observation', 'medication_change')),
  add constraint appointment_questions_source_shape_check
    check (
      (source_type = 'manual' and source_id is null)
      or (source_type <> 'manual' and source_id is not null)
    );

create table public.home_module_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  visibility text not null default 'shown',
  position smallint not null default 0,
  cadence text not null default 'manual',
  dismissed_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_module_preferences_owner_module_key unique (owner_id, module_key),
  constraint home_module_preferences_module_key_check check (
    module_key in ('check_in', 'appointment', 'weekly_content', 'memory', 'plans', 'health_context')
  ),
  constraint home_module_preferences_visibility_check
    check (visibility in ('shown', 'hidden')),
  constraint home_module_preferences_position_check check (position between 0 and 20),
  constraint home_module_preferences_cadence_check
    check (cadence in ('daily', 'weekly', 'appointment', 'manual')),
  constraint home_module_preferences_timestamps_check check (updated_at >= created_at)
);

create table public.memory_capsules (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  week_start date not null,
  title text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_capsules_id_owner_key unique (id, owner_id),
  constraint memory_capsules_owner_week_key unique (owner_id, pregnancy_id, week_start),
  constraint memory_capsules_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint memory_capsules_week_start_check
    check (extract(isodow from week_start) = 1),
  constraint memory_capsules_title_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint memory_capsules_status_check
    check (status in ('draft', 'ready', 'archived')),
  constraint memory_capsules_timestamps_check check (updated_at >= created_at)
);

create table public.memory_capsule_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  capsule_id uuid not null,
  journal_entry_id uuid not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_capsule_items_capsule_owner_fk
    foreign key (capsule_id, owner_id)
    references public.memory_capsules(id, owner_id) on delete cascade,
  constraint memory_capsule_items_entry_owner_fk
    foreign key (journal_entry_id, owner_id)
    references public.journal_entries(id, owner_id) on delete cascade,
  constraint memory_capsule_items_entry_key unique (capsule_id, journal_entry_id),
  constraint memory_capsule_items_position_key unique (capsule_id, position),
  constraint memory_capsule_items_position_check check (position between 0 and 20),
  constraint memory_capsule_items_timestamps_check check (updated_at >= created_at)
);

create table public.health_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  status text not null default 'active',
  storage_opt_in boolean not null default false,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_connections_owner_platform_key unique (owner_id, platform),
  constraint health_connections_id_owner_key unique (id, owner_id),
  constraint health_connections_platform_check
    check (platform in ('apple_health', 'health_connect')),
  constraint health_connections_status_check
    check (status in ('active', 'disconnected', 'unavailable')),
  constraint health_connections_disconnected_check check (
    (status = 'disconnected' and disconnected_at is not null)
    or status <> 'disconnected'
  ),
  constraint health_connections_timestamps_check check (updated_at >= created_at)
);

create table public.health_metric_permissions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  metric_type text not null,
  request_state text not null default 'not_requested',
  purpose_version text not null,
  requested_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_metric_permissions_connection_owner_fk
    foreign key (connection_id, owner_id)
    references public.health_connections(id, owner_id) on delete cascade,
  constraint health_metric_permissions_connection_metric_key
    unique (connection_id, metric_type),
  constraint health_metric_permissions_metric_type_check check (
    metric_type in (
      'sleep_duration_minutes',
      'steps',
      'workout_duration_minutes',
      'mindfulness_duration_minutes'
    )
  ),
  constraint health_metric_permissions_request_state_check
    check (request_state in ('not_requested', 'requested', 'disabled')),
  constraint health_metric_permissions_purpose_version_check
    check (char_length(btrim(purpose_version)) between 1 and 80),
  constraint health_metric_permissions_requested_check check (
    (request_state = 'not_requested' and requested_at is null)
    or (request_state <> 'not_requested' and requested_at is not null)
  ),
  constraint health_metric_permissions_disabled_check check (
    (request_state = 'disabled' and disabled_at is not null)
    or (request_state <> 'disabled' and disabled_at is null)
  ),
  constraint health_metric_permissions_timestamps_check check (updated_at >= created_at)
);

create table public.health_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  connection_id uuid not null,
  metric_type text not null,
  local_date date not null,
  timezone text not null,
  numeric_value numeric not null,
  unit text not null,
  sample_count integer not null default 0,
  coverage_minutes integer not null default 0,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_daily_summaries_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint health_daily_summaries_connection_owner_fk
    foreign key (connection_id, owner_id)
    references public.health_connections(id, owner_id) on delete cascade,
  constraint health_daily_summaries_connection_metric_date_key
    unique (connection_id, metric_type, local_date),
  constraint health_daily_summaries_metric_type_check check (
    metric_type in (
      'sleep_duration_minutes',
      'steps',
      'workout_duration_minutes',
      'mindfulness_duration_minutes'
    )
  ),
  constraint health_daily_summaries_timezone_check
    check (char_length(btrim(timezone)) between 1 and 100),
  constraint health_daily_summaries_value_check check (numeric_value >= 0),
  constraint health_daily_summaries_unit_check
    check (unit in ('minutes', 'count')),
  constraint health_daily_summaries_sample_count_check check (sample_count >= 0),
  constraint health_daily_summaries_coverage_check
    check (coverage_minutes between 0 and 1440),
  constraint health_daily_summaries_timestamps_check check (updated_at >= created_at)
);

comment on table public.health_daily_summaries is
  'Optional owner-only daily context. Raw samples, source identifiers, and device identifiers are not stored.';
comment on column public.health_metric_permissions.request_state is
  'Records Tender request state only. It does not claim that HealthKit granted read access.';

create index memory_capsules_owner_week_idx
  on public.memory_capsules(owner_id, pregnancy_id, week_start desc);
create index memory_capsule_items_entry_idx
  on public.memory_capsule_items(journal_entry_id);
create index health_daily_summaries_owner_date_idx
  on public.health_daily_summaries(owner_id, local_date desc);

create or replace function app_private.validate_health_summary_storage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.health_connections connection
    where connection.id = new.connection_id
      and connection.owner_id = new.owner_id
      and connection.status = 'active'
      and connection.storage_opt_in
  ) then
    raise exception 'health summary storage is not enabled' using errcode = '42501';
  end if;
  return new;
end;
$function$;

create trigger validate_health_summary_storage
before insert or update of connection_id, owner_id on public.health_daily_summaries
for each row execute function app_private.validate_health_summary_storage();

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'home_module_preferences',
    'memory_capsules',
    'memory_capsule_items',
    'health_connections',
    'health_metric_permissions',
    'health_daily_summaries'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      table_name
    );
    execute format(
      'create policy owner_access on public.%I for all to authenticated using (app_private.is_current_user(owner_id)) with check (app_private.is_current_user(owner_id))',
      table_name
    );
  end loop;
end;
$migration$;

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
    set title = pg_catalog.nullif(pg_catalog.btrim(p_title), ''),
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
      pg_catalog.nullif(pg_catalog.btrim(p_title), ''),
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

revoke all on function app_private.validate_health_summary_storage() from public, anon, authenticated, service_role;
revoke all on function public.save_journal_entry_v2(uuid, uuid, text, text, timestamptz, boolean, text, boolean, uuid[], timestamptz) from public, anon;
grant execute on function public.save_journal_entry_v2(uuid, uuid, text, text, timestamptz, boolean, text, boolean, uuid[], timestamptz) to authenticated;

commit;
