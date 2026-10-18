begin;

alter table public.daily_checkins
  add column overall_feeling text,
  add column completed_at timestamptz,
  add column client_mutation_id uuid,
  add constraint daily_checkins_feeling_check check (
    overall_feeling is null
    or overall_feeling in ('good', 'okay', 'hard', 'mixed', 'unsure')
  ),
  add constraint daily_checkins_completion_check check (
    completed_at is null or completed_at >= created_at
  );

alter table public.checkin_symptoms
  rename column intensity to severity;

alter table public.checkin_symptoms
  drop constraint checkin_symptoms_intensity_check,
  add column duration_code text,
  add column interference_level smallint,
  add constraint checkin_symptoms_severity_check check (
    severity is null or severity between 1 and 3
  ),
  add constraint checkin_symptoms_duration_check check (
    duration_code is null
    or duration_code in ('today', 'few_days', 'week_or_more')
  ),
  add constraint checkin_symptoms_interference_check check (
    interference_level is null or interference_level between 1 and 3
  );

alter table public.wellness_observations
  add column checkin_id uuid,
  add constraint wellness_observations_checkin_owner_fk
    foreign key (checkin_id, owner_id)
    references public.daily_checkins(id, owner_id) on delete cascade;

create unique index wellness_observations_checkin_type_key
  on public.wellness_observations(checkin_id, observation_type)
  where checkin_id is not null;

create table public.urgent_guidance_rules (
  id uuid primary key default gen_random_uuid(),
  urgent_guidance_id uuid not null references public.urgent_guidance(id) on delete cascade,
  clinical_review_id uuid not null references public.clinical_reviews(id) on delete restrict,
  flag_slug text not null references public.symptoms(slug) on delete restrict,
  match_kind text not null default 'selected_flag',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint urgent_guidance_rules_pair_key unique (urgent_guidance_id, flag_slug),
  constraint urgent_guidance_rules_match_kind_check check (
    match_kind = 'selected_flag'
  ),
  constraint urgent_guidance_rules_timestamps_check check (updated_at >= created_at)
);

comment on table public.urgent_guidance_rules is
  'Clinician-governed direct flag-to-guidance mappings. Rules must never encode diagnoses, scores, reassurance, ranking, or inferred risk.';

alter table public.urgent_guidance
  add column care_team_action_label text,
  add column emergency_action_label text,
  add column emergency_action_uri text,
  add constraint urgent_guidance_care_team_label_check check (
    care_team_action_label is null
    or char_length(btrim(care_team_action_label)) between 1 and 120
  ),
  add constraint urgent_guidance_emergency_action_check check (
    (emergency_action_label is null) = (emergency_action_uri is null)
  ),
  add constraint urgent_guidance_emergency_label_check check (
    emergency_action_label is null
    or char_length(btrim(emergency_action_label)) between 1 and 120
  ),
  add constraint urgent_guidance_emergency_uri_check check (
    emergency_action_uri is null or emergency_action_uri ~ '^tel:[0-9+*#-]+$'
  );

create trigger set_updated_at before update on public.urgent_guidance_rules
  for each row execute function app_private.set_updated_at();

alter table public.urgent_guidance_rules enable row level security;
grant select on public.urgent_guidance_rules to authenticated;
grant select, insert, update, delete on public.urgent_guidance_rules to service_role;
create policy urgent_guidance_rules_published_select on public.urgent_guidance_rules
  for select to authenticated
  using (
    is_active
    and match_kind = 'selected_flag'
    and exists (
      select 1
      from public.urgent_guidance guidance
      where guidance.id = urgent_guidance_rules.urgent_guidance_id
        and guidance.status = 'published'
        and guidance.effective_at <= pg_catalog.now()
        and (guidance.expires_at is null or guidance.expires_at > pg_catalog.now())
        and guidance.care_team_action_label is not null
        and guidance.emergency_action_label is not null
        and guidance.emergency_action_uri is not null
        and app_private.has_approved_clinical_review(null, guidance.id)
    )
    and exists (
      select 1
      from public.clinical_reviews review
      where review.id = urgent_guidance_rules.clinical_review_id
        and review.urgent_guidance_id = urgent_guidance_rules.urgent_guidance_id
        and review.status = 'approved'
        and review.reviewed_at is not null
        and review.reviewed_at >= urgent_guidance_rules.updated_at
        and (review.valid_until is null or review.valid_until > pg_catalog.now())
    )
  );

create or replace function public.sync_daily_checkin(
  p_pregnancy_id uuid,
  p_checkin_date date,
  p_base_updated_at timestamptz,
  p_client_mutation_id uuid,
  p_payload jsonb,
  p_complete boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  checkin public.daily_checkins%rowtype;
  emotion_count integer;
  symptom_count integer;
  wellness_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_client_mutation_id is null then
    raise exception 'Client mutation id is required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Check-in payload must be an object' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      current_user_id::text || ':' || p_pregnancy_id::text || ':' || p_checkin_date::text,
      0
    )
  );

  select * into checkin
  from public.daily_checkins existing_checkin
  where existing_checkin.pregnancy_id = p_pregnancy_id
    and existing_checkin.checkin_date = p_checkin_date
    and existing_checkin.owner_id = current_user_id
  for update;

  if found and checkin.client_mutation_id = p_client_mutation_id then
    return pg_catalog.jsonb_build_object(
      'status', 'applied',
      'checkin_id', checkin.id,
      'updated_at', checkin.updated_at,
      'completed_at', checkin.completed_at
    );
  end if;

  if found and (p_base_updated_at is null or checkin.updated_at is distinct from p_base_updated_at) then
    return pg_catalog.jsonb_build_object(
      'status', 'conflict',
      'checkin_id', checkin.id,
      'updated_at', checkin.updated_at,
      'completed_at', checkin.completed_at
    );
  end if;

  insert into public.daily_checkins (
    pregnancy_id,
    owner_id,
    checkin_date,
    overall_feeling,
    note,
    client_mutation_id,
    completed_at
  ) values (
    p_pregnancy_id,
    current_user_id,
    p_checkin_date,
    nullif(p_payload ->> 'overallFeeling', ''),
    nullif(p_payload ->> 'note', ''),
    p_client_mutation_id,
    case when p_complete then pg_catalog.now() else null end
  )
  on conflict (pregnancy_id, checkin_date) do update set
    overall_feeling = excluded.overall_feeling,
    note = excluded.note,
    client_mutation_id = excluded.client_mutation_id,
    completed_at = case
      when public.daily_checkins.completed_at is not null then public.daily_checkins.completed_at
      when p_complete then pg_catalog.now()
      else null
    end
  returning * into checkin;

  delete from public.checkin_emotions where checkin_id = checkin.id and owner_id = current_user_id;
  insert into public.checkin_emotions (owner_id, checkin_id, emotion_id)
  select current_user_id, checkin.id, emotion.id
  from pg_catalog.jsonb_array_elements_text(coalesce(p_payload -> 'emotionSlugs', '[]'::jsonb)) selected(slug)
  join public.emotions emotion on emotion.slug = selected.slug and emotion.is_active
  on conflict (checkin_id, emotion_id) do nothing;
  get diagnostics emotion_count = row_count;
  if emotion_count <> pg_catalog.jsonb_array_length(coalesce(p_payload -> 'emotionSlugs', '[]'::jsonb)) then
    raise exception 'One or more emotion flags are unavailable' using errcode = '22023';
  end if;

  delete from public.checkin_symptoms where checkin_id = checkin.id and owner_id = current_user_id;
  insert into public.checkin_symptoms (
    owner_id, checkin_id, symptom_id, severity, duration_code, interference_level
  )
  select
    current_user_id,
    checkin.id,
    symptom.id,
    selected.severity,
    selected.duration_code,
    selected.interference_level
  from pg_catalog.jsonb_to_recordset(coalesce(p_payload -> 'symptoms', '[]'::jsonb))
    as selected(slug text, severity smallint, duration_code text, interference_level smallint)
  join public.symptoms symptom on symptom.slug = selected.slug and symptom.is_active
  on conflict (checkin_id, symptom_id) do update set
    severity = excluded.severity,
    duration_code = excluded.duration_code,
    interference_level = excluded.interference_level;
  get diagnostics symptom_count = row_count;
  if symptom_count <> pg_catalog.jsonb_array_length(coalesce(p_payload -> 'symptoms', '[]'::jsonb)) then
    raise exception 'One or more symptom flags are unavailable' using errcode = '22023';
  end if;

  delete from public.wellness_observations
  where checkin_id = checkin.id and owner_id = current_user_id;
  insert into public.wellness_observations (
    pregnancy_id, owner_id, checkin_id, observation_type, text_value, observed_at
  )
  select
    p_pregnancy_id,
    current_user_id,
    checkin.id,
    selected.observation_type,
    selected.text_value,
    pg_catalog.now()
  from pg_catalog.jsonb_to_recordset(coalesce(p_payload -> 'wellness', '[]'::jsonb))
    as selected(observation_type text, text_value text);
  get diagnostics wellness_count = row_count;
  if wellness_count <> pg_catalog.jsonb_array_length(coalesce(p_payload -> 'wellness', '[]'::jsonb)) then
    raise exception 'One or more wellness observations are invalid' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'applied',
    'checkin_id', checkin.id,
    'updated_at', checkin.updated_at,
    'completed_at', checkin.completed_at
  );
end;
$function$;

revoke all on function public.sync_daily_checkin(uuid, date, timestamptz, uuid, jsonb, boolean) from public;
revoke all on function public.sync_daily_checkin(uuid, date, timestamptz, uuid, jsonb, boolean) from anon;
grant execute on function public.sync_daily_checkin(uuid, date, timestamptz, uuid, jsonb, boolean) to authenticated;

comment on function public.sync_daily_checkin(uuid, date, timestamptz, uuid, jsonb, boolean) is
  'Atomic, idempotent optimistic sync for partial or completed daily check-ins. It does not score, diagnose, infer urgency, or award streaks.';

commit;
