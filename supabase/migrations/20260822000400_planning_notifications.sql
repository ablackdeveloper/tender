begin;

alter table public.notification_preferences
  add column medication_as_recorded_enabled boolean not null default false,
  add column weekly_update_enabled boolean not null default true,
  add column photo_enabled boolean not null default false,
  add column partner_request_enabled boolean not null default true,
  add column revealing_content_enabled boolean not null default false;

comment on column public.notification_preferences.medication_as_recorded_enabled is
  'Neutral reminders to record a medication event. Never medication advice.';
comment on column public.notification_preferences.revealing_content_enabled is
  'Explicit opt-in to category-specific lock-screen copy. Generic copy is the default.';

create or replace function app_private.validate_notification_timezone()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'invalid_notification_timezone';
  end if;
  return new;
end;
$$;

create trigger validate_notification_timezone
before insert or update of timezone on public.notification_preferences
for each row execute function app_private.validate_notification_timezone();

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid references public.pregnancies(id) on delete cascade,
  category text not null,
  destination_type text not null,
  resource_id uuid,
  scheduled_for timestamptz not null,
  next_attempt_at timestamptz not null,
  timezone text not null,
  dedupe_key text not null unique,
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  max_attempts smallint not null default 5,
  claimed_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_jobs_category_check check (
    category in ('appointment', 'medication_as_recorded', 'weekly_update', 'photo', 'partner_request')
  ),
  constraint notification_jobs_destination_check check (
    destination_type in ('care', 'journey', 'journal', 'together')
  ),
  constraint notification_jobs_timezone_check check (char_length(btrim(timezone)) between 1 and 100),
  constraint notification_jobs_dedupe_check check (dedupe_key ~ '^[0-9a-f]{64}$'),
  constraint notification_jobs_status_check check (
    status in ('pending', 'processing', 'delivered', 'retry', 'dead_letter', 'cancelled')
  ),
  constraint notification_jobs_attempts_check check (
    attempt_count between 0 and 20 and max_attempts between 1 and 20
  ),
  constraint notification_jobs_error_code_check check (
    last_error_code is null or last_error_code ~ '^[a-z0-9._-]{1,80}$'
  ),
  constraint notification_jobs_timestamps_check check (updated_at >= created_at)
);

create table public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  device_id uuid references public.notification_devices(id) on delete set null,
  attempt_number smallint not null,
  provider_status text not null,
  provider_ticket_id_hash text,
  error_code text,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_attempts_number_check check (attempt_number between 1 and 20),
  constraint notification_delivery_attempts_status_check check (
    provider_status in ('accepted', 'rejected', 'temporary_failure', 'permanent_failure', 'no_active_device')
  ),
  constraint notification_delivery_attempts_ticket_hash_check check (
    provider_ticket_id_hash is null or provider_ticket_id_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint notification_delivery_attempts_error_check check (
    error_code is null or error_code ~ '^[a-z0-9._-]{1,80}$'
  ),
  constraint notification_delivery_attempts_immutable_check check (updated_at = created_at)
);

create index notification_jobs_due_idx
  on public.notification_jobs(next_attempt_at, created_at)
  where status in ('pending', 'retry');
create index notification_jobs_owner_recent_idx
  on public.notification_jobs(owner_id, created_at desc);
create index notification_delivery_attempts_job_idx
  on public.notification_delivery_attempts(job_id, attempted_at desc);
create unique index notification_devices_active_fingerprint_idx
  on public.notification_devices(token_fingerprint)
  where disabled_at is null;

create trigger set_updated_at before update on public.notification_jobs
  for each row execute function app_private.set_updated_at();

alter table public.notification_jobs enable row level security;
alter table public.notification_delivery_attempts enable row level security;

-- These tables deliberately have no client grants or policies. service_role bypasses RLS.
revoke all on public.notification_devices from anon, authenticated;
revoke all on public.notification_jobs from anon, authenticated;
revoke all on public.notification_delivery_attempts from anon, authenticated;

create or replace function app_private.apply_notification_quiet_hours(
  p_candidate timestamptz,
  p_timezone text,
  p_quiet_start time,
  p_quiet_end time
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private, extensions
as $$
declare
  local_value timestamp;
  local_time time;
  resume_date date;
begin
  if p_quiet_start is null or p_quiet_end is null or p_quiet_start = p_quiet_end then
    return p_candidate;
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception using errcode = '22023', message = 'invalid_timezone';
  end if;
  local_value := p_candidate at time zone p_timezone;
  local_time := local_value::time;
  if p_quiet_start < p_quiet_end then
    if local_time >= p_quiet_start and local_time < p_quiet_end then
      return (local_value::date + p_quiet_end) at time zone p_timezone;
    end if;
  elsif local_time >= p_quiet_start or local_time < p_quiet_end then
    resume_date := local_value::date + case when local_time >= p_quiet_start then 1 else 0 end;
    return (resume_date + p_quiet_end) at time zone p_timezone;
  end if;
  return p_candidate;
end;
$$;

create or replace function app_private.enqueue_notification_job(
  p_owner_id uuid,
  p_pregnancy_id uuid,
  p_category text,
  p_destination_type text,
  p_resource_id uuid,
  p_scheduled_for timestamptz,
  p_dedupe_material text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, extensions
as $$
declare
  prefs public.notification_preferences%rowtype;
  adjusted timestamptz;
  result_id uuid;
  enabled boolean;
begin
  select * into prefs from public.notification_preferences where owner_id = p_owner_id;
  if not found then return null; end if;
  enabled := case p_category
    when 'appointment' then prefs.appointment_reminders_enabled
    when 'medication_as_recorded' then prefs.medication_as_recorded_enabled
    when 'weekly_update' then prefs.weekly_update_enabled
    when 'photo' then prefs.photo_enabled
    when 'partner_request' then prefs.partner_request_enabled
    else false
  end;
  if not enabled then return null; end if;
  adjusted := app_private.apply_notification_quiet_hours(
    p_scheduled_for, prefs.timezone, prefs.quiet_hours_start, prefs.quiet_hours_end
  );
  insert into public.notification_jobs (
    owner_id, pregnancy_id, category, destination_type, resource_id,
    scheduled_for, next_attempt_at, timezone, dedupe_key
  ) values (
    p_owner_id, p_pregnancy_id, p_category, p_destination_type, p_resource_id,
    adjusted, adjusted, prefs.timezone,
    encode(extensions.digest(convert_to(p_dedupe_material, 'UTF8'), 'sha256'), 'hex')
  ) on conflict (dedupe_key) do nothing returning id into result_id;
  return result_id;
end;
$$;

create or replace function app_private.enqueue_appointment_notification()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, app_private, extensions
as $$
begin
  update public.notification_jobs set status = 'cancelled'
    where category = 'appointment' and resource_id = new.id
      and status in ('pending', 'retry', 'processing');
  if new.status in ('scheduled', 'rescheduled') and new.starts_at > now() then
    perform app_private.enqueue_notification_job(
      new.owner_id, new.pregnancy_id, 'appointment', 'care', new.id,
      greatest(now(), new.starts_at - interval '24 hours'),
      'appointment:' || new.id || ':' || new.starts_at
    );
  end if;
  return new;
end;
$$;

create trigger enqueue_appointment_notification
after insert or update of starts_at, status on public.appointments
for each row execute function app_private.enqueue_appointment_notification();

create or replace function app_private.enqueue_partner_request_notification()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, app_private, extensions
as $$
begin
  if new.requested_from_user_id is not null and new.status = 'open'
     and (tg_op = 'INSERT' or old.status is distinct from new.status
          or old.requested_from_user_id is distinct from new.requested_from_user_id) then
    perform app_private.enqueue_notification_job(
      new.requested_from_user_id, new.pregnancy_id, 'partner_request', 'together', new.id,
      now(), 'partner_request:' || new.id || ':' || new.requested_from_user_id
    );
  end if;
  return new;
end;
$$;

create trigger enqueue_partner_request_notification
after insert or update of status, requested_from_user_id on public.support_requests
for each row execute function app_private.enqueue_partner_request_notification();

create or replace function public.resolve_notification_destination(p_job_id uuid)
returns table(route text)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  job public.notification_jobs%rowtype;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into job from public.notification_jobs where id = p_job_id and owner_id = caller;
  if not found then raise exception using errcode = '42501', message = 'notification_not_authorized'; end if;

  if job.destination_type = 'care' and job.resource_id is not null
     and not exists (select 1 from public.appointments where id = job.resource_id and owner_id = caller)
     and not exists (
       select 1 from public.medication_schedules schedule
       where schedule.id = job.resource_id and schedule.owner_id = caller
     ) then
    raise exception using errcode = '42501', message = 'destination_not_authorized';
  elsif job.destination_type = 'journal' and job.resource_id is not null
     and not exists (select 1 from public.photo_series where id = job.resource_id and owner_id = caller) then
    raise exception using errcode = '42501', message = 'destination_not_authorized';
  elsif job.destination_type = 'together' and job.resource_id is not null
     and not app_private.can_read_support_request(job.resource_id) then
    raise exception using errcode = '42501', message = 'destination_not_authorized';
  end if;

  update public.notification_jobs set opened_at = coalesce(opened_at, now()) where id = job.id;
  return query select case job.destination_type
    when 'care' then '/(app)/care'
    when 'journey' then '/(app)/journey'
    when 'journal' then '/(app)/journal'
    when 'together' then '/(app)/together'
  end;
end;
$$;

create or replace function public.respond_to_support_request(p_support_request_id uuid, p_action text)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  request public.support_requests%rowtype;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  if p_action not in ('accept', 'decline', 'resolve') then raise exception using errcode = '22023', message = 'invalid_support_action'; end if;
  select * into request from public.support_requests where id = p_support_request_id for update;
  if not found or request.requested_from_user_id is distinct from caller then raise exception using errcode = '42501', message = 'support_request_not_authorized'; end if;
  if (p_action in ('accept', 'decline') and request.status <> 'open') or (p_action = 'resolve' and request.status <> 'accepted') then
    raise exception using errcode = '22023', message = 'invalid_support_transition';
  end if;
  update public.support_requests set
    status = case p_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'resolved' end,
    declined_at = case when p_action = 'decline' then now() else declined_at end,
    resolved_at = case when p_action = 'resolve' then now() else resolved_at end
  where id = request.id;
end;
$$;

create or replace function public.claim_notification_jobs(p_limit integer default 100)
returns setof public.notification_jobs
language sql
security definer
set search_path = pg_catalog, public
as $$
  with due as (
    select id from public.notification_jobs
    where status in ('pending', 'retry') and next_attempt_at <= now()
    order by next_attempt_at, created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 500)
  ), claimed as (
    update public.notification_jobs job
    set status = 'processing', claimed_at = now(), attempt_count = job.attempt_count + 1
    from due where job.id = due.id
    returning job.*
  ) select * from claimed;
$$;

create or replace function public.materialize_notification_jobs(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, extensions
as $$
declare
  prefs record;
  schedule record;
  series record;
  candidate_date date;
  candidate timestamptz;
  created_count integer := 0;
begin
  for prefs in select * from public.notification_preferences loop
    candidate_date := (p_now at time zone prefs.timezone)::date
      + ((8 - extract(isodow from (p_now at time zone prefs.timezone))::integer) % 7);
    candidate := (candidate_date + time '09:00') at time zone prefs.timezone;
    if candidate <= p_now then candidate := candidate + interval '7 days'; end if;
    if app_private.enqueue_notification_job(
      prefs.owner_id, null, 'weekly_update', 'journey', null, candidate,
      'weekly_update:' || prefs.owner_id || ':' || candidate_date
    ) is not null then created_count := created_count + 1; end if;

    for series in
      select ps.id, ps.pregnancy_id from public.photo_series ps where ps.owner_id = prefs.owner_id
    loop
      candidate_date := (p_now at time zone prefs.timezone)::date
        + ((7 - extract(isodow from (p_now at time zone prefs.timezone))::integer) % 7);
      candidate := (candidate_date + time '10:00') at time zone prefs.timezone;
      if candidate <= p_now then candidate := candidate + interval '7 days'; end if;
      if app_private.enqueue_notification_job(
        prefs.owner_id, series.pregnancy_id, 'photo', 'journal', series.id, candidate,
        'photo:' || series.id || ':' || candidate_date
      ) is not null then created_count := created_count + 1; end if;
    end loop;

    for schedule in
      select ms.id, ms.schedule_type, ms.scheduled_local_time, ms.day_of_week,
             ms.interval_days, ms.timezone, ms.starts_on, ms.ends_on, m.pregnancy_id
      from public.medication_schedules ms
      join public.medications m on m.id = ms.medication_id
      where ms.owner_id = prefs.owner_id and ms.schedule_type <> 'as_needed'
    loop
      for candidate_date in
        select day::date from generate_series(
          (p_now at time zone schedule.timezone)::date,
          (p_now at time zone schedule.timezone)::date + 7,
          interval '1 day'
        ) day
      loop
        if (schedule.starts_on is null or candidate_date >= schedule.starts_on)
           and (schedule.ends_on is null or candidate_date <= schedule.ends_on)
           and (
             schedule.schedule_type = 'daily'
             or (schedule.schedule_type = 'weekly' and extract(dow from candidate_date)::integer = schedule.day_of_week)
             or (schedule.schedule_type = 'interval' and schedule.starts_on is not null
                 and (candidate_date - schedule.starts_on) % schedule.interval_days = 0)
           ) then
          candidate := (candidate_date + schedule.scheduled_local_time) at time zone schedule.timezone;
          if candidate > p_now and app_private.enqueue_notification_job(
            prefs.owner_id, schedule.pregnancy_id, 'medication_as_recorded', 'care', schedule.id,
            candidate, 'medication_record:' || schedule.id || ':' || candidate_date
          ) is not null then created_count := created_count + 1; end if;
        end if;
      end loop;
    end loop;
  end loop;
  return created_count;
end;
$$;

revoke all on function app_private.apply_notification_quiet_hours(timestamptz,text,time,time) from public, anon, authenticated;
revoke all on function app_private.validate_notification_timezone() from public, anon, authenticated;
revoke all on function app_private.enqueue_notification_job(uuid,uuid,text,text,uuid,timestamptz,text) from public, anon, authenticated;
revoke all on function app_private.enqueue_appointment_notification() from public, anon, authenticated;
revoke all on function app_private.enqueue_partner_request_notification() from public, anon, authenticated;
revoke all on function public.resolve_notification_destination(uuid) from public, anon;
revoke all on function public.respond_to_support_request(uuid,text) from public, anon;
revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
revoke all on function public.materialize_notification_jobs(timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_notification_destination(uuid) to authenticated;
grant execute on function public.respond_to_support_request(uuid,text) to authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;
grant execute on function public.materialize_notification_jobs(timestamptz) to service_role;

commit;
