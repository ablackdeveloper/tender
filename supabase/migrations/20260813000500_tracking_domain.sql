begin;

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  checkin_date date not null,
  energy_level smallint,
  sleep_quality smallint,
  hydration_glasses smallint,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_checkins_id_owner_key unique (id, owner_id),
  constraint daily_checkins_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint daily_checkins_pregnancy_date_key unique (pregnancy_id, checkin_date),
  constraint daily_checkins_energy_check check (energy_level is null or energy_level between 1 and 5),
  constraint daily_checkins_sleep_check check (
    sleep_quality is null or sleep_quality between 1 and 5
  ),
  constraint daily_checkins_hydration_check check (
    hydration_glasses is null or hydration_glasses between 0 and 100
  ),
  constraint daily_checkins_timestamps_check check (updated_at >= created_at)
);

create table public.emotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emotions_slug_check check (slug ~ '^[a-z][a-z0-9-]{0,49}$'),
  constraint emotions_display_name_check check (
    char_length(btrim(display_name)) between 1 and 80
  ),
  constraint emotions_sort_order_check check (sort_order >= 0),
  constraint emotions_timestamps_check check (updated_at >= created_at)
);

create table public.checkin_emotions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  checkin_id uuid not null,
  emotion_id uuid not null references public.emotions(id) on delete restrict,
  intensity smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkin_emotions_checkin_owner_fk
    foreign key (checkin_id, owner_id)
    references public.daily_checkins(id, owner_id) on delete cascade,
  constraint checkin_emotions_checkin_emotion_key unique (checkin_id, emotion_id),
  constraint checkin_emotions_intensity_check check (
    intensity is null or intensity between 1 and 5
  ),
  constraint checkin_emotions_timestamps_check check (updated_at >= created_at)
);

create table public.symptoms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint symptoms_slug_check check (slug ~ '^[a-z][a-z0-9-]{0,79}$'),
  constraint symptoms_display_name_check check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  constraint symptoms_sort_order_check check (sort_order >= 0),
  constraint symptoms_timestamps_check check (updated_at >= created_at)
);

comment on table public.symptoms is
  'Neutral tracking vocabulary only. Rows must not encode diagnoses, risk scores, or triage outcomes.';

create table public.checkin_symptoms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  checkin_id uuid not null,
  symptom_id uuid not null references public.symptoms(id) on delete restrict,
  intensity smallint,
  started_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkin_symptoms_checkin_owner_fk
    foreign key (checkin_id, owner_id)
    references public.daily_checkins(id, owner_id) on delete cascade,
  constraint checkin_symptoms_checkin_symptom_key unique (checkin_id, symptom_id),
  constraint checkin_symptoms_intensity_check check (
    intensity is null or intensity between 1 and 5
  ),
  constraint checkin_symptoms_timestamps_check check (updated_at >= created_at)
);

create table public.wellness_observations (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  observation_type text not null,
  numeric_value numeric,
  text_value text,
  unit text,
  observed_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellness_observations_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint wellness_observations_type_check check (
    observation_type ~ '^[a-z][a-z0-9._-]{0,79}$'
  ),
  constraint wellness_observations_value_check check (
    num_nonnulls(numeric_value, text_value) = 1
  ),
  constraint wellness_observations_unit_check check (
    unit is null or char_length(btrim(unit)) between 1 and 40
  ),
  constraint wellness_observations_timestamps_check check (updated_at >= created_at)
);

comment on table public.wellness_observations is
  'User-recorded observations. Values are not diagnoses and must not be interpreted as medical conclusions.';

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  occurred_at timestamptz not null,
  meal_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meals_id_owner_key unique (id, owner_id),
  constraint meals_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint meals_type_check check (
    meal_type is null or meal_type ~ '^[a-z][a-z0-9._-]{0,49}$'
  ),
  constraint meals_timestamps_check check (updated_at >= created_at)
);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null,
  item_name text not null,
  quantity numeric,
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_items_meal_owner_fk
    foreign key (meal_id, owner_id)
    references public.meals(id, owner_id) on delete cascade,
  constraint meal_items_name_check check (char_length(btrim(item_name)) between 1 and 200),
  constraint meal_items_quantity_check check (quantity is null or quantity > 0),
  constraint meal_items_unit_check check (
    unit is null or char_length(btrim(unit)) between 1 and 40
  ),
  constraint meal_items_timestamps_check check (updated_at >= created_at)
);

create index daily_checkins_owner_date_idx
  on public.daily_checkins(owner_id, checkin_date desc);
create index checkin_emotions_emotion_idx
  on public.checkin_emotions(emotion_id, checkin_id);
create index checkin_symptoms_symptom_idx
  on public.checkin_symptoms(symptom_id, checkin_id);
create index wellness_observations_owner_observed_idx
  on public.wellness_observations(owner_id, observed_at desc);
create index meals_owner_occurred_idx
  on public.meals(owner_id, occurred_at desc);
create index meal_items_meal_idx on public.meal_items(meal_id);

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'daily_checkins',
    'emotions',
    'checkin_emotions',
    'symptoms',
    'checkin_symptoms',
    'wellness_observations',
    'meals',
    'meal_items'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name
    );
  end loop;
end;
$migration$;

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'daily_checkins',
    'checkin_emotions',
    'checkin_symptoms',
    'wellness_observations',
    'meals',
    'meal_items'
  ] loop
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

alter table public.emotions enable row level security;
alter table public.symptoms enable row level security;
grant select on public.emotions, public.symptoms to authenticated;
create policy active_emotions_read on public.emotions
  for select to authenticated using (is_active);
create policy active_symptoms_read on public.symptoms
  for select to authenticated using (is_active);

commit;
