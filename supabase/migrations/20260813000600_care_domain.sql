begin;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  provider_id uuid,
  title text not null,
  reason text,
  status text not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null,
  location text,
  virtual_url text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_id_owner_key unique (id, owner_id),
  constraint appointments_id_pregnancy_owner_key unique (id, pregnancy_id, owner_id),
  constraint appointments_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint appointments_provider_pregnancy_owner_fk
    foreign key (provider_id, pregnancy_id, owner_id)
    references public.providers(id, pregnancy_id, owner_id) on delete set null (provider_id),
  constraint appointments_title_check check (char_length(btrim(title)) between 1 and 240),
  constraint appointments_status_check check (
    status in ('scheduled', 'completed', 'cancelled', 'rescheduled')
  ),
  constraint appointments_time_order_check check (ends_at is null or ends_at > starts_at),
  constraint appointments_timezone_check check (char_length(btrim(timezone)) between 1 and 100),
  constraint appointments_virtual_url_check check (
    virtual_url is null or virtual_url ~ '^https://'
  ),
  constraint appointments_completion_check check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  ),
  constraint appointments_cancellation_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or status <> 'cancelled'
  ),
  constraint appointments_timestamps_check check (updated_at >= created_at)
);

create table public.appointment_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null,
  question text not null,
  position integer not null default 0,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_questions_appointment_owner_fk
    foreign key (appointment_id, owner_id)
    references public.appointments(id, owner_id) on delete cascade,
  constraint appointment_questions_question_check check (
    char_length(btrim(question)) between 1 and 2000
  ),
  constraint appointment_questions_position_check check (position >= 0),
  constraint appointment_questions_timestamps_check check (updated_at >= created_at)
);

create table public.appointment_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null,
  body text not null,
  authored_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_notes_appointment_owner_fk
    foreign key (appointment_id, owner_id)
    references public.appointments(id, owner_id) on delete cascade,
  constraint appointment_notes_body_check check (
    char_length(btrim(body)) between 1 and 100000
  ),
  constraint appointment_notes_timestamps_check check (updated_at >= created_at)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  name text not null,
  form text,
  strength text,
  instructions text,
  status text not null default 'active',
  started_on date,
  ended_on date,
  prescribed_by_provider_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medications_id_owner_key unique (id, owner_id),
  constraint medications_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint medications_provider_pregnancy_owner_fk
    foreign key (prescribed_by_provider_id, pregnancy_id, owner_id)
    references public.providers(id, pregnancy_id, owner_id)
    on delete set null (prescribed_by_provider_id),
  constraint medications_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint medications_status_check check (
    status in ('active', 'paused', 'completed', 'discontinued')
  ),
  constraint medications_date_order_check check (
    ended_on is null or started_on is null or ended_on >= started_on
  ),
  constraint medications_timestamps_check check (updated_at >= created_at)
);

comment on table public.medications is
  'User-maintained medication list. Storage does not constitute prescribing advice or diagnosis.';

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null,
  schedule_type text not null,
  scheduled_local_time time,
  day_of_week smallint,
  interval_days smallint,
  timezone text not null,
  starts_on date,
  ends_on date,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_schedules_medication_owner_fk
    foreign key (medication_id, owner_id)
    references public.medications(id, owner_id) on delete cascade,
  constraint medication_schedules_type_check check (
    schedule_type in ('daily', 'weekly', 'interval', 'as_needed')
  ),
  constraint medication_schedules_day_check check (
    day_of_week is null or day_of_week between 0 and 6
  ),
  constraint medication_schedules_interval_check check (
    interval_days is null or interval_days between 1 and 365
  ),
  constraint medication_schedules_shape_check check (
    (schedule_type = 'as_needed' and scheduled_local_time is null and day_of_week is null and interval_days is null)
    or (schedule_type = 'daily' and scheduled_local_time is not null and day_of_week is null and interval_days is null)
    or (schedule_type = 'weekly' and scheduled_local_time is not null and day_of_week is not null and interval_days is null)
    or (schedule_type = 'interval' and scheduled_local_time is not null and day_of_week is null and interval_days is not null)
  ),
  constraint medication_schedules_timezone_check check (
    char_length(btrim(timezone)) between 1 and 100
  ),
  constraint medication_schedules_date_order_check check (
    ends_on is null or starts_on is null or ends_on >= starts_on
  ),
  constraint medication_schedules_timestamps_check check (updated_at >= created_at)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  appointment_id uuid,
  title text not null,
  document_type text not null,
  document_date date,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint documents_appointment_pregnancy_owner_fk
    foreign key (appointment_id, pregnancy_id, owner_id)
    references public.appointments(id, pregnancy_id, owner_id)
    on delete set null (appointment_id),
  constraint documents_title_check check (char_length(btrim(title)) between 1 and 240),
  constraint documents_type_check check (
    document_type ~ '^[a-z][a-z0-9._-]{0,79}$'
  ),
  constraint documents_storage_bucket_check check (
    storage_bucket ~ '^[a-z0-9][a-z0-9._-]{1,62}$'
  ),
  constraint documents_storage_path_check check (
    char_length(btrim(storage_path)) between 1 and 1024
    and storage_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint documents_mime_type_check check (
    mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'
  ),
  constraint documents_byte_size_check check (byte_size > 0 and byte_size <= 104857600),
  constraint documents_sha256_check check (
    sha256 is null or sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint documents_storage_key unique (storage_bucket, storage_path),
  constraint documents_timestamps_check check (updated_at >= created_at)
);

create index appointments_owner_starts_idx
  on public.appointments(owner_id, starts_at desc);
create index appointments_provider_starts_idx
  on public.appointments(provider_id, starts_at desc)
  where provider_id is not null;
create index appointment_questions_appointment_position_idx
  on public.appointment_questions(appointment_id, position);
create index appointment_notes_appointment_authored_idx
  on public.appointment_notes(appointment_id, authored_at desc);
create index medications_owner_status_idx
  on public.medications(owner_id, status, created_at desc);
create index medication_schedules_medication_idx
  on public.medication_schedules(medication_id, starts_on);
create index documents_owner_date_idx
  on public.documents(owner_id, document_date desc nulls last);
create index documents_appointment_idx
  on public.documents(appointment_id)
  where appointment_id is not null;

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'appointments',
    'appointment_questions',
    'appointment_notes',
    'medications',
    'medication_schedules',
    'documents'
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

commit;
