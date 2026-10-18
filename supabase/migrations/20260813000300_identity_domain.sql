begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  onboarding_completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check check (
    display_name is null or char_length(btrim(display_name)) between 1 and 120
  ),
  constraint profiles_locale_check check (char_length(btrim(locale)) between 2 and 35),
  constraint profiles_timezone_check check (char_length(btrim(timezone)) between 1 and 100),
  constraint profiles_timestamps_check check (updated_at >= created_at)
);

create table public.pregnancies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text,
  lmp_date date,
  estimated_due_date date not null,
  due_date_source text not null,
  clinician_confirmed_at timestamptz,
  timezone text not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pregnancies_id_owner_key unique (id, owner_id),
  constraint pregnancies_label_check check (
    label is null or char_length(btrim(label)) between 1 and 120
  ),
  constraint pregnancies_due_date_source_check check (
    due_date_source in ('lmp', 'ultrasound', 'ivf', 'clinician', 'manual')
  ),
  constraint pregnancies_dating_order_check check (
    lmp_date is null or estimated_due_date >= lmp_date
  ),
  constraint pregnancies_timezone_check check (char_length(btrim(timezone)) between 1 and 100),
  constraint pregnancies_timestamps_check check (updated_at >= created_at)
);

comment on column public.pregnancies.lmp_date is
  'First day of the last menstrual period when known.';
comment on column public.pregnancies.estimated_due_date is
  'Canonical dating input. Gestational week is derived at query time and is never stored as truth.';
comment on column public.pregnancies.clinician_confirmed_at is
  'When a clinician confirmed the dating information; this is not a diagnostic result.';

create table public.pregnancy_members (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null,
  status text not null default 'active',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pregnancy_members_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint pregnancy_members_pregnancy_user_key unique (pregnancy_id, user_id),
  constraint pregnancy_members_role_check check (
    membership_role in ('owner', 'partner', 'support_person', 'caregiver')
  ),
  constraint pregnancy_members_status_check check (
    status in ('invited', 'active', 'declined', 'removed', 'left')
  ),
  constraint pregnancy_members_dates_check check (
    left_at is null or joined_at is null or left_at >= joined_at
  ),
  constraint pregnancy_members_timestamps_check check (updated_at >= created_at)
);

create table public.partner_invitations (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  invitation_role text not null default 'partner',
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_invitations_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint partner_invitations_email_check check (
    invited_email = lower(btrim(invited_email)) and position('@' in invited_email) > 1
  ),
  constraint partner_invitations_role_check check (
    invitation_role in ('partner', 'support_person', 'caregiver')
  ),
  constraint partner_invitations_token_hash_check check (char_length(token_hash) >= 43),
  constraint partner_invitations_status_check check (
    status in ('pending', 'accepted', 'declined', 'expired', 'revoked')
  ),
  constraint partner_invitations_resolution_check check (
    (status = 'accepted' and accepted_at is not null and accepted_by_user_id is not null)
    or status <> 'accepted'
  ),
  constraint partner_invitations_timestamps_check check (updated_at >= created_at)
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  theme_preference text not null default 'system',
  measurement_system text not null default 'metric',
  week_starts_on smallint not null default 1,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  reduce_motion_override boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_theme_check check (
    theme_preference in ('system', 'light', 'dark')
  ),
  constraint user_preferences_measurement_check check (
    measurement_system in ('metric', 'imperial')
  ),
  constraint user_preferences_week_start_check check (week_starts_on between 0 and 6),
  constraint user_preferences_locale_check check (char_length(btrim(locale)) between 2 and 35),
  constraint user_preferences_timezone_check check (char_length(btrim(timezone)) between 1 and 100),
  constraint user_preferences_timestamps_check check (updated_at >= created_at)
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  appointment_reminders_enabled boolean not null default true,
  planning_reminders_enabled boolean not null default true,
  editorial_updates_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_quiet_hours_check check (
    (quiet_hours_start is null) = (quiet_hours_end is null)
  ),
  constraint notification_preferences_timezone_check check (
    char_length(btrim(timezone)) between 1 and 100
  ),
  constraint notification_preferences_timestamps_check check (updated_at >= created_at)
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  name text not null,
  specialty text,
  organization text,
  phone text,
  email text,
  address text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint providers_id_owner_key unique (id, owner_id),
  constraint providers_id_pregnancy_owner_key unique (id, pregnancy_id, owner_id),
  constraint providers_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint providers_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint providers_contact_check check (
    phone is not null or email is not null or address is not null
  ),
  constraint providers_email_check check (
    email is null or email = lower(btrim(email))
  ),
  constraint providers_timestamps_check check (updated_at >= created_at)
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text,
  phone text not null,
  email text,
  priority smallint not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_contacts_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint emergency_contacts_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint emergency_contacts_phone_check check (char_length(btrim(phone)) between 3 and 50),
  constraint emergency_contacts_email_check check (
    email is null or email = lower(btrim(email))
  ),
  constraint emergency_contacts_priority_check check (priority between 1 and 20),
  constraint emergency_contacts_timestamps_check check (updated_at >= created_at)
);

create index pregnancies_owner_created_idx
  on public.pregnancies(owner_id, created_at desc);
create index pregnancy_members_user_status_idx
  on public.pregnancy_members(user_id, status);
create index pregnancy_members_owner_idx
  on public.pregnancy_members(owner_id, pregnancy_id);
create index partner_invitations_owner_status_idx
  on public.partner_invitations(owner_id, status, expires_at);
create unique index partner_invitations_pending_email_key
  on public.partner_invitations(pregnancy_id, invited_email)
  where status = 'pending';
create index providers_owner_pregnancy_idx
  on public.providers(owner_id, pregnancy_id);
create unique index providers_one_primary_per_pregnancy_key
  on public.providers(pregnancy_id)
  where is_primary;
create index emergency_contacts_owner_priority_idx
  on public.emergency_contacts(owner_id, priority);

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'pregnancies',
    'pregnancy_members',
    'partner_invitations',
    'user_preferences',
    'notification_preferences',
    'providers',
    'emergency_contacts'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name
    );
  end loop;
end;
$migration$;

alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;
create policy profiles_owner_access on public.profiles
  for all to authenticated
  using (app_private.is_current_user(id))
  with check (app_private.is_current_user(id));

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pregnancies',
    'partner_invitations',
    'user_preferences',
    'notification_preferences',
    'providers',
    'emergency_contacts'
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

alter table public.pregnancy_members enable row level security;
grant select, insert, update, delete on public.pregnancy_members to authenticated;
create policy pregnancy_members_owner_manage on public.pregnancy_members
  for all to authenticated
  using (app_private.is_current_user(owner_id))
  with check (app_private.is_current_user(owner_id));
create policy pregnancy_members_self_read on public.pregnancy_members
  for select to authenticated
  using (app_private.is_current_user(user_id));

commit;
