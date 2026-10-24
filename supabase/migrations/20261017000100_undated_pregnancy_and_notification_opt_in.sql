begin;
-- An undated pregnancy can hold private memories and care records.
alter table public.pregnancies alter column estimated_due_date drop not null;
alter table public.pregnancies drop constraint pregnancies_due_date_source_check;
alter table public.pregnancies add constraint pregnancies_due_date_source_check
  check (due_date_source in ('lmp', 'ultrasound', 'ivf', 'clinician', 'manual', 'unknown'));
-- INSERT ... ON CONFLICT also checks SELECT visibility. The owner must be
-- visible directly, before the new row can be found by the permission helper.
alter policy pregnancies_authorized_select on public.pregnancies
  using (owner_id = auth.uid() or app_private.has_pregnancy_permission(id, 'pregnancy.read'));
-- New preferences require a deliberate opt-in. Existing choices are preserved.
alter table public.notification_preferences
  alter column appointment_reminders_enabled set default false,
  alter column planning_reminders_enabled set default false,
  alter column editorial_updates_enabled set default false,
  alter column weekly_update_enabled set default false,
  alter column partner_request_enabled set default false;
create or replace function public.complete_onboarding(
  p_pregnancy_id uuid,
  p_lmp_date date,
  p_estimated_due_date date,
  p_due_date_source text,
  p_clinician_confirmed_at timestamptz,
  p_timezone text,
  p_pregnancy_type text,
  p_display_name text,
  p_theme_preference text,
  p_measurement_system text,
  p_editorial_updates_enabled boolean,
  p_appointment_reminders_enabled boolean,
  p_planning_reminders_enabled boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  user_id uuid := auth.uid();
begin
  if user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_timezone is null or char_length(btrim(p_timezone)) not between 1 and 100 then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, timezone, onboarding_completed_at)
  values (user_id, nullif(btrim(p_display_name), ''), p_timezone, now())
    on conflict (id) do update set
    display_name = excluded.display_name,
    timezone = excluded.timezone,
    onboarding_completed_at = excluded.onboarding_completed_at;

  insert into public.user_preferences (
    owner_id, theme_preference, measurement_system, timezone
  ) values (
    user_id, p_theme_preference, p_measurement_system, p_timezone
  ) on conflict (owner_id) do update set
    theme_preference = excluded.theme_preference,
    measurement_system = excluded.measurement_system,
    timezone = excluded.timezone;

  insert into public.notification_preferences (
    owner_id,
    appointment_reminders_enabled,
    planning_reminders_enabled,
    editorial_updates_enabled,
    timezone
  ) values (
    user_id,
    p_appointment_reminders_enabled,
    p_planning_reminders_enabled,
    p_editorial_updates_enabled,
    p_timezone
  ) on conflict (owner_id) do update set
    appointment_reminders_enabled = excluded.appointment_reminders_enabled,
    planning_reminders_enabled = excluded.planning_reminders_enabled,
    editorial_updates_enabled = excluded.editorial_updates_enabled,
    timezone = excluded.timezone;

    insert into public.pregnancies (
      id,
      owner_id,
      lmp_date,
      estimated_due_date,
      due_date_source,
      clinician_confirmed_at,
      timezone,
      pregnancy_type
    ) values (
      p_pregnancy_id,
      user_id,
      p_lmp_date,
      p_estimated_due_date,
      case when p_estimated_due_date is null then 'unknown' else p_due_date_source end,
      p_clinician_confirmed_at,
      p_timezone,
      p_pregnancy_type
    ) on conflict (id) do update set
      lmp_date = excluded.lmp_date,
      estimated_due_date = excluded.estimated_due_date,
      due_date_source = excluded.due_date_source,
      clinician_confirmed_at = excluded.clinician_confirmed_at,
      timezone = excluded.timezone,
      pregnancy_type = excluded.pregnancy_type
    where pregnancies.owner_id = user_id;

    if not found then
      raise exception 'pregnancy identifier is unavailable' using errcode = '23505';
    end if;

  return p_pregnancy_id;
end;
$$;


commit;
