begin;

-- Local/CI-only personas. Reserved .invalid addresses cannot receive mail and
-- encrypted_password is intentionally empty, so these are not login credentials.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'primary@tender.invalid',
    '',
    '2026-01-01T00:00:00Z',
    '{"provider":"email","providers":["email"],"seed_fixture":true}'::jsonb,
    '{"persona":"primary","synthetic":true}'::jsonb,
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'limited-partner@tender.invalid',
    '',
    '2026-01-01T00:00:00Z',
    '{"provider":"email","providers":["email"],"seed_fixture":true}'::jsonb,
    '{"persona":"limited_partner","synthetic":true}'::jsonb,
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'unrelated-attacker@tender.invalid',
    '',
    '2026-01-01T00:00:00Z',
    '{"provider":"email","providers":["email"],"seed_fixture":true}'::jsonb,
    '{"persona":"unrelated_attacker","synthetic":true}'::jsonb,
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z'
  );

insert into public.profiles (id, display_name, locale, timezone, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'Seed Primary', 'en-US', 'America/New_York', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b0000000-0000-4000-8000-000000000002', 'Seed Limited Partner', 'en-US', 'America/Los_Angeles', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b0000000-0000-4000-8000-000000000003', 'Seed Unrelated Attacker', 'en', 'UTC', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- Gestational labels are fixture descriptions as of the fixed reference date
-- 2026-11-01. Current week remains derived and is never stored.
insert into public.pregnancies (
  id,
  owner_id,
  label,
  lmp_date,
  estimated_due_date,
  due_date_source,
  clinician_confirmed_at,
  timezone,
  ended_at,
  created_at,
  updated_at
) values
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — 4w6d boundary on 2026-11-01', '2026-09-28', '2027-07-05', 'lmp', null, 'America/New_York', null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — 13w6d shared boundary on 2026-11-01', '2026-07-27', '2027-05-03', 'ultrasound', '2026-09-01T16:00:00Z', 'America/Los_Angeles', null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — 27w6d boundary on 2026-11-01', '2026-04-20', '2027-01-25', 'ivf', '2026-04-21T12:00:00Z', 'UTC', null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — 40w0d due-date and DST boundary', '2026-01-25', '2026-11-01', 'clinician', '2026-02-20T14:00:00Z', 'America/New_York', null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — 41w6d upper display boundary', '2026-01-12', '2026-10-19', 'manual', null, 'Asia/Kolkata', null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — ended pregnancy compassionate state', '2026-03-01', '2026-12-06', 'lmp', null, 'Europe/London', '2026-05-24T16:00:00Z', '2026-01-01T00:00:00Z', '2026-05-24T16:00:00Z');

insert into public.pregnancy_members (
  id, pregnancy_id, owner_id, user_id, membership_role, status, joined_at,
  created_at, updated_at
)
select
  ('b1100000-0000-4000-8000-' || pg_catalog.lpad(stage_number::text, 12, '0'))::uuid,
  ('b1000000-0000-4000-8000-' || pg_catalog.lpad(stage_number::text, 12, '0'))::uuid,
  'b0000000-0000-4000-8000-000000000001'::uuid,
  'b0000000-0000-4000-8000-000000000001'::uuid,
  'owner', 'active', '2026-01-01T00:00:00Z'::timestamptz,
  '2026-01-01T00:00:00Z'::timestamptz, '2026-01-01T00:00:00Z'::timestamptz
from pg_catalog.generate_series(1, 6) as generated_stage(stage_number);

insert into public.pregnancy_members (
  id, pregnancy_id, owner_id, user_id, membership_role, status, joined_at,
  created_at, updated_at
) values (
  'b1110000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'partner', 'active', '2026-08-01T12:00:00Z',
  '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'
);

insert into public.user_preferences (
  id, owner_id, theme_preference, measurement_system, week_starts_on,
  locale, timezone, reduce_motion_override, created_at, updated_at
) values
  ('b1300000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'system', 'metric', 1, 'en-US', 'America/New_York', null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b1300000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'dark', 'imperial', 0, 'en-US', 'America/Los_Angeles', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b1300000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'light', 'metric', 1, 'en', 'UTC', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

insert into public.notification_preferences (
  id, owner_id, quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at
) values (
  'b1400000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  '22:00', '07:00', 'America/New_York',
  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
);

insert into public.notification_jobs (
  id, owner_id, pregnancy_id, category, destination_type, resource_id,
  scheduled_for, next_attempt_at, timezone, dedupe_key, status,
  attempt_count, max_attempts, created_at, updated_at
) values (
  'b1600000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'weekly_update', 'journey', null,
  '2026-01-05T14:00:00Z', '2026-01-05T14:00:00Z',
  'America/New_York', repeat('9', 64), 'delivered',
  1, 5, '2026-01-05T14:00:00Z', '2026-01-05T14:00:00Z'
);

insert into public.notification_delivery_attempts (
  id, job_id, device_id, attempt_number, provider_status,
  attempted_at, created_at, updated_at
) values (
  'b1610000-0000-4000-8000-000000000001',
  'b1600000-0000-4000-8000-000000000001',
  null, 1, 'no_active_device',
  '2026-01-05T14:00:00Z', '2026-01-05T14:00:00Z', '2026-01-05T14:00:00Z'
);

-- Historical invitation states only. Hashes are inert deterministic fixture
-- values; no usable raw invitation token is committed.
insert into public.partner_invitations (
  id, pregnancy_id, owner_id, invited_by_user_id, invited_email,
  invitation_role, token_hash, status, expires_at, revoked_at,
  created_at, updated_at
) values
  ('b1200000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'limited-partner@tender.invalid', 'partner', repeat('1', 64), 'expired', '2026-07-31T23:59:59Z', null, '2026-07-01T12:00:00Z', '2026-08-01T00:00:00Z'),
  ('b1200000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'unrelated-attacker@tender.invalid', 'support_person', repeat('2', 64), 'revoked', '2027-01-01T00:00:00Z', '2026-08-01T12:00:00Z', '2026-07-15T12:00:00Z', '2026-08-01T12:00:00Z');

-- The limited partner can see pregnancy identity and journal rows for only the
-- shared 13w6d fixture. Care, tracking, planning, and every other pregnancy stay private.
insert into public.sharing_grants (
  id, pregnancy_id, owner_id, grantee_user_id, permission,
  granted_at, expires_at, revoked_at, created_at, updated_at
) values
  ('b1500000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'pregnancy.read', '2026-08-01T12:00:00Z', null, null, '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'),
  ('b1500000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'journal.read', '2026-08-01T12:00:00Z', null, null, '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z');

insert into public.tags (id, owner_id, name, color_token, created_at, updated_at)
values
  ('b2100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'synthetic-private', 'accent.soft', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b2100000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'synthetic-shared', 'support.soft', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b2100000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'synthetic-compassionate', 'neutral.soft', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

insert into public.journal_entries (
  id, pregnancy_id, owner_id, title, body, entry_at, is_pinned,
  privacy_level, created_at, updated_at
) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC PRIVATE — year boundary', 'TEST FIXTURE ONLY. Private placeholder entry at the UTC year boundary; no personal or medical content.', '2026-12-31T23:59:59Z', false, 'private', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC SHARED — partner-visible', 'TEST FIXTURE ONLY. Original placeholder copy used to confirm explicit journal.read sharing.', '2026-11-01T05:30:00Z', true, 'shared', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC COMPASSIONATE STATE', 'TEST FIXTURE ONLY. Gentle neutral placeholder for an ended pregnancy. It contains no outcome narrative or medical record.', '2026-05-25T09:00:00Z', false, 'private', '2026-05-25T09:00:00Z', '2026-05-25T09:00:00Z');

insert into public.journal_entry_tags (
  id, owner_id, journal_entry_id, tag_id, created_at, updated_at
) values
  ('b2200000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000001', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b2200000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'b2100000-0000-4000-8000-000000000002', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b2200000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000003', 'b2100000-0000-4000-8000-000000000003', '2026-05-25T09:00:00Z', '2026-05-25T09:00:00Z');

-- Failed rows intentionally have no storage.objects record.
insert into public.media_assets (
  id, pregnancy_id, owner_id, journal_entry_id, storage_bucket, storage_path,
  mime_type, byte_size, alt_text, upload_status, created_at, updated_at
) values
  ('b2300000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'tender-media', 'b2300000-0000-4000-8000-000000000001/b3300000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 1, 'Synthetic failed private upload placeholder', 'failed', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b2300000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'tender-media', 'b2300000-0000-4000-8000-000000000002/b3300000-0000-4000-8000-000000000002.jpg', 'image/jpeg', 1, 'Synthetic failed shared upload placeholder', 'failed', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- The UTC pairs around US DST transitions represent local clock gaps/folds.
insert into public.appointments (
  id, pregnancy_id, owner_id, title, status, starts_at, ends_at, timezone,
  created_at, updated_at
) values
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — LA before spring-forward', 'scheduled', '2026-03-08T09:30:00Z', '2026-03-08T09:45:00Z', 'America/Los_Angeles', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — LA after spring-forward', 'scheduled', '2026-03-08T10:30:00Z', '2026-03-08T10:45:00Z', 'America/Los_Angeles', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b3000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — NY first 01:30 fall-back', 'scheduled', '2026-11-01T05:30:00Z', '2026-11-01T05:45:00Z', 'America/New_York', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b3000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC — NY second 01:30 fall-back', 'scheduled', '2026-11-01T06:30:00Z', '2026-11-01T06:45:00Z', 'America/New_York', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- Reference emotions and common symptoms come from the catalog migration.
-- Add only the neutral boundary values that belong to this synthetic scenario.
insert into public.symptoms (
  id, slug, display_name, description, sort_order, is_active, created_at, updated_at
) values
  ('b4000000-0000-4000-8000-000000000001', 'synthetic-observation-low', 'Synthetic observation — low boundary', 'NOT CLINICALLY APPROVED. Neutral test vocabulary only.', 9001, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b4000000-0000-4000-8000-000000000002', 'synthetic-observation-high', 'Synthetic observation — high boundary', 'NOT CLINICALLY APPROVED. Neutral test vocabulary only.', 9002, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

insert into public.daily_checkins (
  id, pregnancy_id, owner_id, checkin_date, energy_level, sleep_quality,
  hydration_glasses, note, created_at, updated_at
) values
  ('b4100000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '2026-11-01', 1, 5, 0, 'SYNTHETIC DST date fixture; no health meaning.', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b4100000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '2026-03-08', 5, 1, 100, 'SYNTHETIC boundary-value fixture; no health meaning.', '2026-03-08T12:00:00Z', '2026-03-08T12:00:00Z');

insert into public.checkin_symptoms (
  id, owner_id, checkin_id, symptom_id, severity, started_at, note,
  created_at, updated_at
) values
  ('b4200000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b4100000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 1, '2026-11-01T19:30:00Z', 'NOT CLINICALLY APPROVED — minimum severity boundary.', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b4200000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b4100000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000002', 3, '2026-03-08T10:30:00Z', 'NOT CLINICALLY APPROVED — maximum severity boundary.', '2026-03-08T12:00:00Z', '2026-03-08T12:00:00Z');

insert into public.meals (
  id, pregnancy_id, owner_id, occurred_at, meal_type, notes, created_at, updated_at
) values
  ('b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '2026-03-08T09:59:59Z', 'synthetic-before-gap', 'TEST FIXTURE ONLY.', '2026-03-08T09:59:59Z', '2026-03-08T09:59:59Z'),
  ('b5000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '2026-03-08T10:00:00Z', 'synthetic-after-gap', 'TEST FIXTURE ONLY.', '2026-03-08T10:00:00Z', '2026-03-08T10:00:00Z');

insert into public.meal_items (
  id, owner_id, meal_id, item_name, quantity, unit, notes, created_at, updated_at
) values
  ('b5100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'Synthetic item A', 0.01, 'fixture-unit', 'No nutritional meaning.', '2026-03-08T09:59:59Z', '2026-03-08T09:59:59Z'),
  ('b5100000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002', 'Synthetic item B', 999999, 'fixture-unit', 'Large numeric rendering boundary.', '2026-03-08T10:00:00Z', '2026-03-08T10:00:00Z');

insert into public.projects (
  id, pregnancy_id, owner_id, title, description, status, archived_at,
  created_at, updated_at
) values
  ('b6000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC PRIVATE PLAN', 'Partner lacks planning.read despite journal access.', 'active', null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b6000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'SYNTHETIC COMPASSIONATE ARCHIVE', 'Neutral ended-pregnancy fixture.', 'archived', '2026-05-25T09:00:00Z', '2026-01-01T00:00:00Z', '2026-05-25T09:00:00Z');

insert into public.tasks (
  id, owner_id, project_id, title, description, status, priority, due_at,
  completed_at, position, created_at, updated_at
) values
  ('b6100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'SYNTHETIC open task', 'Year-end due-date boundary.', 'open', 0, '2026-12-31T23:59:59Z', null, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('b6100000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'SYNTHETIC completed task', 'Completed-state fixture.', 'completed', 3, '2026-11-01T06:30:00Z', '2026-11-01T06:30:00Z', 2147483647, '2026-01-01T00:00:00Z', '2026-11-01T06:30:00Z'),
  ('b6100000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000002', 'SYNTHETIC compassionate-mode cancellation', 'Neutral cancelled task fixture.', 'cancelled', 1, null, null, 0, '2026-01-01T00:00:00Z', '2026-05-25T09:00:00Z');

commit;
