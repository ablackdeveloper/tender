begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create schema test_support;
grant usage on schema test_support to anon, authenticated, service_role;

create temporary table authorization_results (
  test_name text primary key,
  text_value text,
  text_array text[],
  bool_value boolean,
  uuid_value uuid
) on commit drop;
grant select, insert, update on authorization_results to anon, authenticated, service_role;

create or replace function test_support.domain_tables()
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $function$
  select array[
    'profiles', 'pregnancies', 'pregnancy_experience_settings', 'pregnancy_members', 'partner_invitations',
    'user_preferences', 'notification_preferences', 'providers', 'emergency_contacts',
    'journal_entries', 'journal_entry_tags', 'tags', 'media_assets', 'photo_series',
    'daily_checkins', 'emotions', 'checkin_emotions', 'symptoms', 'checkin_symptoms',
    'wellness_observations', 'meals', 'meal_items',
    'appointments', 'appointment_questions', 'appointment_notes', 'medications',
    'medication_schedules', 'medication_change_records', 'documents',
    'projects', 'tasks', 'support_requests',
    'pregnancy_weeks', 'content_articles', 'content_sources', 'content_versions',
    'content_version_sources', 'clinical_reviews', 'urgent_guidance',
    'urgent_guidance_rules', 'support_resources',
    'consent_records', 'sharing_grants', 'access_audit_events', 'notification_devices',
    'export_jobs', 'deletion_jobs', 'sharing_item_overrides',
    'invitation_rate_limit_events', 'user_notifications',
    'notification_jobs', 'notification_delivery_attempts'
  ]::text[];
$function$;

create or replace function test_support.visibility_mismatches(expected_visible text[])
returns text[]
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  table_name text;
  is_visible boolean;
  should_be_visible boolean;
  mismatches text[] := array[]::text[];
begin
  foreach table_name in array test_support.domain_tables() loop
    should_be_visible := table_name = any(expected_visible);
    begin
      execute pg_catalog.format(
        'select exists (select 1 from public.%I)', table_name
      ) into is_visible;
    exception when insufficient_privilege then
      is_visible := false;
    end;

    if is_visible is distinct from should_be_visible then
      mismatches := pg_catalog.array_append(
        mismatches,
        pg_catalog.format('%s expected=%s actual=%s', table_name, should_be_visible, is_visible)
      );
    end if;
  end loop;
  return mismatches;
end;
$function$;

create or replace function test_support.write_mismatches(
  operation_name text,
  expected_writable text[]
)
returns text[]
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  table_name text;
  affected_rows integer;
  is_writable boolean;
  should_be_writable boolean;
  failure_detail text;
  mismatches text[] := array[]::text[];
begin
  if operation_name not in ('update', 'delete') then
    raise exception 'unsupported write probe';
  end if;

  foreach table_name in array test_support.domain_tables() loop
    affected_rows := 0;
    is_writable := false;
    failure_detail := null;
    should_be_writable := table_name = any(expected_writable);

    begin
      if operation_name = 'update' then
        execute pg_catalog.format(
          'update public.%I set updated_at = updated_at', table_name
        );
      else
        execute pg_catalog.format('delete from public.%I', table_name);
      end if;
      get diagnostics affected_rows = row_count;
      is_writable := affected_rows > 0;
      raise exception 'rollback authorization probe' using errcode = 'P0001';
    exception
      when sqlstate 'P0001' then null;
      when others then
        is_writable := false;
        failure_detail := pg_catalog.format(
          ' sqlstate=%s error=%s', sqlstate, sqlerrm
        );
    end;

    if is_writable is distinct from should_be_writable then
      mismatches := pg_catalog.array_append(
        mismatches,
        pg_catalog.format(
          '%s expected=%s actual=%s%s',
          table_name,
          should_be_writable,
          is_writable,
          coalesce(failure_detail, '')
        )
      );
    end if;
  end loop;
  return mismatches;
end;
$function$;

create or replace function test_support.storage_visible()
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  result boolean;
begin
  begin
    select exists (
      select 1 from storage.objects object
      where object.bucket_id in ('tender-media', 'tender-documents')
    ) into result;
    return result;
  exception when insufficient_privilege then
    return false;
  end;
end;
$function$;

create or replace function test_support.storage_write_allowed(operation_name text)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  affected_rows integer := 0;
  allowed boolean := false;
begin
  begin
    if operation_name = 'update' then
      update storage.objects
      set metadata = metadata
      where bucket_id = 'tender-media'
        and name = '24000000-0000-4000-8000-000000000001/25000000-0000-4000-8000-000000000001.jpg';
    elsif operation_name = 'delete' then
      delete from storage.objects
      where bucket_id = 'tender-media'
        and name = '24000000-0000-4000-8000-000000000001/25000000-0000-4000-8000-000000000001.jpg';
    elsif operation_name = 'insert' then
      insert into storage.objects (bucket_id, name)
      values (
        'tender-media',
        '24000000-0000-4000-8000-000000000002/25000000-0000-4000-8000-000000000002.jpg'
      );
    else
      raise exception 'unsupported storage probe';
    end if;

    get diagnostics affected_rows = row_count;
    allowed := affected_rows > 0;
    raise exception 'rollback storage probe' using errcode = 'P0001';
  exception
    when sqlstate 'P0001' then null;
    when others then allowed := false;
  end;
  return allowed;
end;
$function$;

create or replace function test_support.consume_invitation(raw_token text, actor_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  accepted_pregnancy_id uuid;
begin
  accepted_pregnancy_id := public.accept_partner_invitation(
    actor_id, raw_token, gen_random_uuid(), repeat('d', 64)
  );
  return accepted_pregnancy_id::text;
exception when others then
  return sqlstate;
end;
$function$;

revoke all on all functions in schema test_support from public;
grant execute on all functions in schema test_support to anon, authenticated, service_role;

-- Test identities.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'active@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'invited@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'revoked@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'unrelated@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'expired@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'decline@example.test', '', now(), now(), now());

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000001', 'Owner');
insert into public.pregnancies (
  id, owner_id, label, estimated_due_date, due_date_source, timezone
) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Test pregnancy', current_date + 100, 'manual', 'America/New_York'
);
insert into public.pregnancy_members (
  id, pregnancy_id, owner_id, user_id, membership_role, status, joined_at
) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'partner', 'active', now());

insert into public.partner_invitations (
  id, pregnancy_id, owner_id, invited_by_user_id, invited_email,
  token_hash, status, expires_at
) values
  (
    '12000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'invited@example.test',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to('valid-invitation-token-with-256-bits-minimum', 'UTF8'), 'sha256'), 'hex'),
    'pending', now() + interval '1 day'
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'expired@example.test',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to('expired-invitation-token-with-256-bits-minimum', 'UTF8'), 'sha256'), 'hex'),
    'pending', now() - interval '1 day'
  ),
  (
    '12000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'decline@example.test',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to('declined-invitation-token-with-256-bits-minimum', 'UTF8'), 'sha256'), 'hex'),
    'pending', now() + interval '1 day'
  );

insert into public.user_preferences (id, owner_id)
values ('13000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
insert into public.notification_preferences (id, owner_id)
values ('14000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
insert into public.providers (id, pregnancy_id, owner_id, name, phone)
values ('15000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Test provider', '+15555550100');
insert into public.emergency_contacts (id, pregnancy_id, owner_id, name, phone)
values ('16000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Test contact', '+15555550101');

insert into public.tags (id, owner_id, name)
values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'private-tag');
insert into public.photo_series (id, pregnancy_id, owner_id, title)
values ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Series');
insert into public.journal_entries (id, pregnancy_id, owner_id, body, privacy_level)
values ('22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Shared journal text', 'shared');
insert into public.journal_entry_tags (id, owner_id, journal_entry_id, tag_id)
values ('23000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
insert into public.media_assets (
  id, pregnancy_id, owner_id, journal_entry_id, storage_bucket, storage_path,
  mime_type, byte_size, upload_status
) values
  ('24000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'tender-media', '24000000-0000-4000-8000-000000000001/25000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 100, 'ready'),
  ('24000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'tender-media', '24000000-0000-4000-8000-000000000002/25000000-0000-4000-8000-000000000002.jpg', 'image/jpeg', 100, 'pending');

insert into public.daily_checkins (id, pregnancy_id, owner_id, checkin_date)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', current_date);
insert into public.emotions (id, slug, display_name)
values ('31000000-0000-4000-8000-000000000001', 'calm', 'Calm');
insert into public.checkin_emotions (id, owner_id, checkin_id, emotion_id)
values ('32000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001');
insert into public.symptoms (id, slug, display_name)
values ('33000000-0000-4000-8000-000000000001', 'test-observation', 'Test observation');
insert into public.checkin_symptoms (id, owner_id, checkin_id, symptom_id)
values ('34000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001');
insert into public.wellness_observations (
  id, pregnancy_id, owner_id, observation_type, numeric_value, observed_at
) values ('35000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'self_reported_value', 1, now());
insert into public.meals (id, pregnancy_id, owner_id, occurred_at)
values ('36000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now());
insert into public.meal_items (id, owner_id, meal_id, item_name)
values ('37000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', 'Test food');

insert into public.appointments (id, pregnancy_id, owner_id, provider_id, title, starts_at, timezone)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000001', 'Visit', now() + interval '1 day', 'America/New_York');
insert into public.appointment_questions (id, owner_id, appointment_id, question)
values ('41000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Question?');
insert into public.appointment_notes (id, owner_id, appointment_id, body)
values ('42000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Private note');
insert into public.medications (id, pregnancy_id, owner_id, name)
values ('43000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'User-entered medication');
insert into public.medication_schedules (id, owner_id, medication_id, schedule_type, scheduled_local_time, timezone)
values ('44000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'daily', '09:00', 'America/New_York');
insert into public.medication_change_records (id, owner_id, medication_id, recorded_on, change_kind, details)
values ('44100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', current_date, 'details_updated', 'User-reported test fixture.');
insert into public.documents (
  id, pregnancy_id, owner_id, appointment_id, title, document_type,
  storage_bucket, storage_path, mime_type, byte_size, privacy_level, upload_status
) values ('45000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Test document', 'note', 'tender-documents', '45000000-0000-4000-8000-000000000001/45100000-0000-4000-8000-000000000001.pdf', 'application/pdf', 100, 'shared', 'ready');
insert into public.documents (
  id, pregnancy_id, owner_id, title, document_type, storage_bucket,
  storage_path, mime_type, byte_size, privacy_level, upload_status
) values ('45000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Private test document', 'note', 'tender-documents', '45000000-0000-4000-8000-000000000002/45100000-0000-4000-8000-000000000002.pdf', 'application/pdf', 100, 'private', 'ready');

insert into public.projects (id, pregnancy_id, owner_id, title)
values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Project');
insert into public.tasks (id, owner_id, project_id, title)
values ('51000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Task');
insert into public.support_requests (id, pregnancy_id, owner_id, requested_from_user_id, title)
values ('52000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Help request');

-- The configured seed contains all 45 catalog weeks. Replace week 10 inside
-- this rolled-back transaction so the authorization fixture remains isolated.
delete from public.pregnancy_weeks where week_number = 10;
insert into public.pregnancy_weeks (id, week_number, title)
values ('60000000-0000-4000-8000-000000000001', 10, 'Week 10');
insert into public.content_articles (id, pregnancy_week_id, slug, title, content_kind, status)
values ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'test-article', 'Test article', 'education', 'draft');
insert into public.content_sources (id, title, source_url)
values ('62000000-0000-4000-8000-000000000001', 'Test source', 'https://example.test/source');
insert into public.content_versions (id, article_id, version_number, body_markdown, published_at)
values ('63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 1, 'Reviewed informational copy.', now());
insert into public.content_version_sources (id, content_version_id, content_source_id)
values ('64000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001');
insert into public.clinical_reviews (
  id, content_version_id, reviewer_name, credentials_snapshot, status, reviewed_at
) values ('65000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', 'Test reviewer', 'Test credentials', 'approved', now());
update public.content_articles
set status = 'published', published_at = now(), current_version_id = '63000000-0000-4000-8000-000000000001'
where id = '61000000-0000-4000-8000-000000000001';
insert into public.urgent_guidance (
  id, slug, title, body_markdown, status, effective_at, published_at,
  care_team_action_label, emergency_action_label, emergency_action_uri
) values ('66000000-0000-4000-8000-000000000001', 'test-urgent-guidance', 'Urgent guidance', 'Contact a qualified care professional.', 'draft', now() - interval '1 hour', null, 'Contact care team', 'Call emergency services', 'tel:911');
insert into public.clinical_reviews (
  id, urgent_guidance_id, reviewer_name, credentials_snapshot, status, reviewed_at
) values ('65000000-0000-4000-8000-000000000002', '66000000-0000-4000-8000-000000000001', 'Test reviewer', 'Test credentials', 'approved', now());
update public.urgent_guidance
set status = 'published', published_at = now()
where id = '66000000-0000-4000-8000-000000000001';
insert into public.urgent_guidance_rules (
  id, urgent_guidance_id, clinical_review_id, flag_slug
) values (
  '67000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000002',
  'test-observation'
);

insert into public.consent_records (
  id, owner_id, consent_type, policy_version, granted, collection_source
) values ('70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'privacy', '1', true, 'test');
insert into public.sharing_grants (
  id, pregnancy_id, owner_id, grantee_user_id, permission, granted_at, revoked_at
)
select
  ('71000000-0000-4000-8000-' || pg_catalog.lpad(row_number() over ()::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000002'::uuid,
  permission,
  now(),
  null
from unnest(array[
  'pregnancy.read', 'journal.read', 'tracking.read', 'care.read', 'planning.read',
  'appointments.read', 'tasks.read', 'support_requests.read'
]) permission;
insert into public.sharing_grants (
  id, pregnancy_id, owner_id, grantee_user_id, permission, granted_at, revoked_at
)
select
  ('72000000-0000-4000-8000-' || pg_catalog.lpad(row_number() over ()::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000004'::uuid,
  permission,
  now() - interval '2 hours',
  now() - interval '1 hour'
from unnest(array[
  'pregnancy.read', 'journal.read', 'tracking.read', 'care.read', 'planning.read',
  'appointments.read', 'tasks.read', 'support_requests.read'
]) permission;
insert into public.sharing_grants (
  id, pregnancy_id, owner_id, grantee_user_id, permission, granted_at, expires_at
)
select
  ('72500000-0000-4000-8000-' || pg_catalog.lpad(row_number() over ()::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000006'::uuid,
  permission,
  now() - interval '2 days',
  now() - interval '1 day'
from unnest(array[
  'pregnancy.read', 'journal.read', 'tracking.read', 'care.read', 'planning.read',
  'appointments.read', 'tasks.read', 'support_requests.read'
]) permission;
insert into public.sharing_item_overrides (
  id, pregnancy_id, owner_id, grantee_user_id, permission,
  resource_type, resource_id, allowed
) values (
  '72600000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'appointments.read', 'appointment',
  '40000000-0000-4000-8000-000000000001', true
);
insert into public.invitation_rate_limit_events (
  id, actor_user_id, pregnancy_id, email_hash, ip_hash
) values (
  '72700000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', repeat('a', 64), repeat('b', 64)
);
insert into public.user_notifications (
  id, owner_id, pregnancy_id, event_type, title, body
) values (
  '72800000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'sharing.permissions_changed', 'Permission changed', 'Review partner access.'
);
insert into public.access_audit_events (id, actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type)
values ('73000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'test.read', 'pregnancy');
insert into public.notification_devices (
  id, owner_id, installation_id, platform, token_ciphertext, token_fingerprint
) values ('74000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002', 'ios', '0123456789abcdef0123456789abcdef', repeat('a', 64));
insert into public.export_jobs (id, owner_id, export_scope, export_format)
values ('75000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'account', 'json');
insert into public.deletion_jobs (id, owner_id, deletion_scope, scheduled_for)
values ('76000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'account', now());

insert into storage.objects (bucket_id, name)
values
  ('tender-media', '24000000-0000-4000-8000-000000000001/25000000-0000-4000-8000-000000000001.jpg'),
  ('tender-documents', '45000000-0000-4000-8000-000000000001/45100000-0000-4000-8000-000000000001.pdf'),
  ('tender-documents', '45000000-0000-4000-8000-000000000002/45100000-0000-4000-8000-000000000002.pdf');

-- Structural deny-by-default assertions.
select extensions.is(
  (
    select count(*)
    from unnest(test_support.domain_tables()) as domain_table(table_name)
    join pg_catalog.pg_class relation on relation.relname = domain_table.table_name
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and not relation.relrowsecurity
  ),
  0::bigint,
  'RLS is enabled on every exposed domain table'
);
select extensions.is(
  (
    select count(*) from unnest(test_support.domain_tables()) as domain_table(table_name)
    where has_any_column_privilege('anon', pg_catalog.format('public.%I', domain_table.table_name), 'SELECT,INSERT,UPDATE,REFERENCES')
      or has_table_privilege('anon', pg_catalog.format('public.%I', domain_table.table_name), 'DELETE')
  ),
  0::bigint,
  'anonymous has no domain table privileges'
);
select extensions.is(
  (
    select count(*) from pg_catalog.pg_policies
    where schemaname = 'public' and cmd = 'ALL'
  ),
  0::bigint,
  'public policies are command-specific rather than FOR ALL'
);
select extensions.is(
  (
    select count(*)
    from (values ('access_audit_events'), ('notification_devices'), ('export_jobs'), ('deletion_jobs')) service_table(table_name)
    where has_any_column_privilege('authenticated', pg_catalog.format('public.%I', table_name), 'SELECT,INSERT,UPDATE,REFERENCES')
      or has_table_privilege('authenticated', pg_catalog.format('public.%I', table_name), 'DELETE')
  ),
  0::bigint,
  'service-only tables expose no client privileges'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.partner_invitations', 'token_hash', 'SELECT'),
  'invitation token hashes are not client-readable'
);
select extensions.is(
  (
    select count(*)
    from pg_catalog.pg_proc function_record
    join pg_catalog.pg_namespace namespace on namespace.oid = function_record.pronamespace
    where function_record.prosecdef
      and namespace.nspname in ('app_private', 'public')
      and (
        not (function_record.proconfig @> array['search_path=""'])
        or not (function_record.proconfig @> array['row_security=off'])
      )
  ),
  0::bigint,
  'all privileged application functions fix search_path and disable nested RLS'
);
select extensions.is(
  (
    select count(*)
    from pg_catalog.pg_proc function_record
    join pg_catalog.pg_namespace namespace on namespace.oid = function_record.pronamespace
    where function_record.prosecdef
      and namespace.nspname in ('app_private', 'public')
      and exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            function_record.proacl,
            pg_catalog.acldefault('f', function_record.proowner)
          )
        ) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      )
  ),
  0::bigint,
  'PUBLIC cannot execute privileged application functions'
);
select extensions.is(
  (
    select count(*) from storage.buckets
    where id in ('tender-media', 'tender-documents', 'tender-exports') and public
  ),
  0::bigint,
  'all Tender storage buckets are private'
);
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class relation
   join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'storage' and relation.relname = 'objects'),
  'storage.objects has RLS enabled'
);

-- Invitation consumption: accepted membership still grants no pregnancy data.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
insert into authorization_results (test_name, text_value)
values ('invitation_first_use', test_support.consume_invitation(
  'valid-invitation-token-with-256-bits-minimum',
  '00000000-0000-4000-8000-000000000003'
));
insert into authorization_results (test_name, text_value)
values ('invitation_replay', test_support.consume_invitation(
  'valid-invitation-token-with-256-bits-minimum',
  '00000000-0000-4000-8000-000000000003'
));
insert into authorization_results (test_name, bool_value)
values (
  'accepted_has_only_basic_context',
  exists(select 1 from public.pregnancies)
    and not exists(select 1 from public.appointments)
    and not exists(select 1 from public.journal_entries)
    and not exists(select 1 from public.tasks)
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
insert into authorization_results (test_name, text_value)
values ('invitation_expired', test_support.consume_invitation(
  'expired-invitation-token-with-256-bits-minimum',
  '00000000-0000-4000-8000-000000000006'
));
reset role;

set local role service_role;
select public.decline_partner_invitation(
  '00000000-0000-4000-8000-000000000007',
  'declined-invitation-token-with-256-bits-minimum',
  '12100000-0000-4000-8000-000000000003',
  repeat('e', 64)
);
reset role;
select extensions.ok(
  exists (
    select 1 from public.partner_invitations
    where id = '12000000-0000-4000-8000-000000000003' and status = 'declined'
  ) and not exists (
    select 1 from public.pregnancy_members
    where user_id = '00000000-0000-4000-8000-000000000007'
  ),
  'declining consumes the invitation without membership or grants'
);

select extensions.is(
  (select text_value from authorization_results where test_name = 'invitation_first_use'),
  '10000000-0000-4000-8000-000000000001',
  'an email-bound unexpired invitation is consumed once'
);
select extensions.is(
  (select text_value from authorization_results where test_name = 'invitation_replay'),
  '22023',
  'an accepted invitation cannot be replayed'
);
select extensions.is(
  (select text_value from authorization_results where test_name = 'invitation_expired'),
  '22023',
  'an expired invitation cannot be consumed'
);
select extensions.ok(
  exists(
    select 1 from public.partner_invitations
    where id = '12000000-0000-4000-8000-000000000001'
      and status = 'accepted'
      and accepted_by_user_id = '00000000-0000-4000-8000-000000000003'
  ),
  'invitation acceptance records the single consumer'
);
select extensions.ok(
  exists(
    select 1 from public.pregnancy_members
    where pregnancy_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000003'
      and status = 'active'
  ),
  'invitation acceptance creates membership context'
);
select extensions.ok(
  (select bool_value from authorization_results where test_name = 'accepted_has_only_basic_context'),
  'acceptance reveals basic pregnancy context but no unselected Together category'
);
select extensions.is(
  (select token_hash from public.partner_invitations where id = '12000000-0000-4000-8000-000000000001'),
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to('valid-invitation-token-with-256-bits-minimum', 'UTF8'), 'sha256'), 'hex'),
  'only the invitation token digest is stored'
);

-- Visibility matrix evaluates every domain table for every threat actor.
set local role anon;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
insert into authorization_results (test_name, text_array)
values ('visibility_anon', test_support.visibility_mismatches(array[]::text[]));
insert into authorization_results (test_name, bool_value)
values ('storage_anon', test_support.storage_visible());
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
insert into authorization_results (test_name, text_array)
values (
  'visibility_owner',
  test_support.visibility_mismatches(array[
    'profiles', 'pregnancies', 'pregnancy_experience_settings', 'pregnancy_members', 'partner_invitations',
    'user_preferences', 'notification_preferences', 'providers', 'emergency_contacts',
    'journal_entries', 'journal_entry_tags', 'tags', 'media_assets', 'photo_series',
    'daily_checkins', 'emotions', 'checkin_emotions', 'symptoms', 'checkin_symptoms',
    'wellness_observations', 'meals', 'meal_items',
    'appointments', 'appointment_questions', 'appointment_notes', 'medications',
    'medication_schedules', 'medication_change_records', 'documents', 'projects', 'tasks', 'support_requests',
    'pregnancy_weeks', 'content_articles', 'content_sources', 'content_versions',
    'content_version_sources', 'clinical_reviews', 'urgent_guidance',
    'urgent_guidance_rules', 'support_resources', 'consent_records', 'sharing_grants',
    'sharing_item_overrides', 'user_notifications'
  ]::text[])
);
insert into authorization_results (test_name, bool_value)
values
  ('storage_owner', test_support.storage_visible()),
  ('owner_reads_private_document', (select count(*) = 2 from public.documents)),
  ('owner_reads_private_document_object', exists (
    select 1 from storage.objects
    where bucket_id = 'tender-documents'
      and name = '45000000-0000-4000-8000-000000000002/45100000-0000-4000-8000-000000000002.pdf'
  )),
  ('storage_owner_update', test_support.storage_write_allowed('update')),
  ('storage_owner_delete', test_support.storage_write_allowed('delete')),
  ('storage_owner_insert', test_support.storage_write_allowed('insert'));
insert into authorization_results (test_name, text_array)
values
  ('owner_update', test_support.write_mismatches('update', array[
    'profiles', 'pregnancies', 'pregnancy_members', 'user_preferences',
    'notification_preferences', 'providers', 'emergency_contacts',
    'journal_entries', 'journal_entry_tags', 'tags', 'media_assets', 'photo_series',
    'daily_checkins', 'checkin_emotions', 'checkin_symptoms', 'wellness_observations',
    'meals', 'meal_items', 'appointments', 'appointment_questions', 'appointment_notes',
    'medications', 'medication_schedules', 'medication_change_records', 'documents', 'projects', 'tasks',
    'support_requests'
  ]::text[])),
  ('owner_delete', test_support.write_mismatches('delete', array[
    'profiles', 'pregnancies', 'pregnancy_members', 'user_preferences',
    'notification_preferences', 'providers', 'emergency_contacts',
    'journal_entries', 'journal_entry_tags', 'tags', 'media_assets', 'photo_series',
    'daily_checkins', 'checkin_emotions', 'checkin_symptoms', 'wellness_observations',
    'meals', 'meal_items', 'appointments', 'appointment_questions', 'appointment_notes',
    'medications', 'medication_schedules', 'medication_change_records', 'documents', 'projects', 'tasks',
    'support_requests'
  ]::text[]));
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
insert into authorization_results (test_name, text_array)
values (
  'visibility_active_partner',
  test_support.visibility_mismatches(array[
    'pregnancies', 'pregnancy_members', 'providers', 'emergency_contacts',
    'journal_entries', 'journal_entry_tags', 'tags', 'media_assets', 'photo_series',
    'daily_checkins', 'emotions', 'checkin_emotions', 'symptoms', 'checkin_symptoms',
    'wellness_observations', 'meals', 'meal_items',
    'appointments', 'appointment_questions', 'appointment_notes', 'medications',
    'medication_schedules', 'medication_change_records', 'documents', 'projects', 'tasks', 'support_requests',
    'pregnancy_weeks', 'content_articles', 'content_sources', 'content_versions',
    'content_version_sources', 'clinical_reviews', 'urgent_guidance',
    'urgent_guidance_rules', 'support_resources', 'sharing_grants'
  ]::text[])
);
insert into authorization_results (test_name, bool_value)
values
  ('storage_active_partner', test_support.storage_visible()),
  ('active_partner_reads_only_shared_document', (select count(*) = 1 from public.documents)),
  ('active_partner_private_document_object_hidden', not exists (
    select 1 from storage.objects
    where bucket_id = 'tender-documents'
      and name = '45000000-0000-4000-8000-000000000002/45100000-0000-4000-8000-000000000002.pdf'
  )),
  ('storage_active_partner_update', test_support.storage_write_allowed('update')),
  ('storage_active_partner_delete', test_support.storage_write_allowed('delete')),
  ('storage_active_partner_insert', test_support.storage_write_allowed('insert'));
insert into authorization_results (test_name, text_array)
values
  ('active_partner_update', test_support.write_mismatches('update', array[]::text[])),
  ('active_partner_delete', test_support.write_mismatches('delete', array[]::text[]));
reset role;

set local role service_role;
select public.set_sharing_item_override(
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'appointments.read', 'appointment',
  '40000000-0000-4000-8000-000000000001', false,
  '72900000-0000-4000-8000-000000000002', repeat('c', 64)
);
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
insert into authorization_results (test_name, bool_value)
values (
  'item_override_denies_only_named_row',
  not exists (select 1 from public.appointments)
    and exists (select 1 from public.tasks)
);
reset role;
set local role service_role;
select public.set_sharing_item_override(
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'appointments.read', 'appointment',
  '40000000-0000-4000-8000-000000000001', true,
  '72900000-0000-4000-8000-000000000003', repeat('c', 64)
);
select public.revoke_partner_access(
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '72900000-0000-4000-8000-000000000001',
  repeat('c', 64)
);
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
insert into authorization_results (test_name, bool_value)
values (
  'revocation_applies_on_next_request',
  not exists (select 1 from public.appointments)
    and not exists (select 1 from public.tasks)
    and not exists (select 1 from public.support_requests)
    and not exists (select 1 from public.journal_entries)
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
insert into authorization_results (test_name, text_array)
values (
  'visibility_invited_partner',
  test_support.visibility_mismatches(array[
    'pregnancies', 'pregnancy_members', 'sharing_grants',
    'emotions', 'symptoms', 'pregnancy_weeks', 'content_articles', 'content_sources',
    'content_versions', 'content_version_sources', 'clinical_reviews', 'urgent_guidance',
    'urgent_guidance_rules', 'support_resources'
  ]::text[])
);
insert into authorization_results (test_name, text_array)
values
  ('invited_partner_update', test_support.write_mismatches('update', array[]::text[])),
  ('invited_partner_delete', test_support.write_mismatches('delete', array[]::text[]));
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
insert into authorization_results (test_name, text_array)
values (
  'visibility_revoked_partner',
  test_support.visibility_mismatches(array[
    'emotions', 'symptoms', 'pregnancy_weeks', 'content_articles', 'content_sources',
    'content_versions', 'content_version_sources', 'clinical_reviews', 'urgent_guidance',
    'urgent_guidance_rules', 'support_resources'
  ]::text[])
);
insert into authorization_results (test_name, bool_value)
values ('storage_revoked_partner', test_support.storage_visible());
insert into authorization_results (test_name, text_array)
values
  ('revoked_partner_update', test_support.write_mismatches('update', array[]::text[])),
  ('revoked_partner_delete', test_support.write_mismatches('delete', array[]::text[]));
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
insert into authorization_results (test_name, text_array)
values (
  'visibility_expired_partner',
  test_support.visibility_mismatches(array[
    'emotions', 'symptoms', 'pregnancy_weeks', 'content_articles', 'content_sources',
    'content_versions', 'content_version_sources', 'clinical_reviews', 'urgent_guidance',
    'urgent_guidance_rules', 'support_resources'
  ]::text[])
);
insert into authorization_results (test_name, bool_value)
values ('storage_expired_partner', test_support.storage_visible());
insert into authorization_results (test_name, text_array)
values
  ('expired_partner_update', test_support.write_mismatches('update', array[]::text[])),
  ('expired_partner_delete', test_support.write_mismatches('delete', array[]::text[]));
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
insert into authorization_results (test_name, text_array)
values (
  'visibility_unrelated',
  test_support.visibility_mismatches(array[
    'emotions', 'symptoms', 'pregnancy_weeks', 'content_articles', 'content_sources',
    'content_versions', 'content_version_sources', 'clinical_reviews', 'urgent_guidance',
    'urgent_guidance_rules', 'support_resources'
  ]::text[])
);
insert into authorization_results (test_name, bool_value)
values
  ('storage_unrelated', test_support.storage_visible()),
  ('storage_unrelated_insert', test_support.storage_write_allowed('insert'));
insert into authorization_results (test_name, text_array)
values
  ('unrelated_update', test_support.write_mismatches('update', array[]::text[])),
  ('unrelated_delete', test_support.write_mismatches('delete', array[]::text[]));
reset role;

set local role service_role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
insert into authorization_results (test_name, text_array)
values ('visibility_service', test_support.visibility_mismatches(test_support.domain_tables()));
insert into authorization_results (test_name, bool_value)
values
  ('storage_service', test_support.storage_visible()),
  ('storage_service_update', test_support.storage_write_allowed('update')),
  ('storage_service_delete', test_support.storage_write_allowed('delete'));
insert into authorization_results (test_name, text_array)
values
  ('service_update', test_support.write_mismatches('update', array[
    'profiles', 'pregnancies', 'pregnancy_experience_settings', 'pregnancy_members', 'partner_invitations',
    'user_preferences', 'notification_preferences', 'providers', 'emergency_contacts',
    'journal_entries', 'journal_entry_tags', 'tags', 'media_assets', 'photo_series',
    'daily_checkins', 'emotions', 'checkin_emotions', 'symptoms', 'checkin_symptoms',
    'wellness_observations', 'meals', 'meal_items', 'appointments',
    'appointment_questions', 'appointment_notes', 'medications', 'medication_schedules', 'medication_change_records',
    'documents', 'projects', 'tasks', 'support_requests', 'pregnancy_weeks',
    'content_articles', 'content_sources', 'content_versions', 'content_version_sources',
    'clinical_reviews', 'urgent_guidance', 'urgent_guidance_rules', 'support_resources', 'sharing_grants', 'notification_devices',
    'notification_jobs', 'notification_delivery_attempts',
    'export_jobs', 'deletion_jobs', 'sharing_item_overrides',
    'invitation_rate_limit_events', 'user_notifications'
  ]::text[])),
  ('service_delete', test_support.write_mismatches('delete', array[
    'profiles', 'pregnancies', 'pregnancy_experience_settings', 'pregnancy_members', 'partner_invitations',
    'user_preferences', 'notification_preferences', 'providers', 'emergency_contacts',
    'journal_entries', 'journal_entry_tags', 'tags', 'media_assets', 'photo_series',
    'daily_checkins', 'checkin_emotions', 'checkin_symptoms',
    'wellness_observations', 'meals', 'meal_items', 'appointments',
    'appointment_questions', 'appointment_notes', 'medications', 'medication_schedules', 'medication_change_records',
    'documents', 'projects', 'tasks', 'support_requests', 'pregnancy_weeks',
    'content_articles', 'content_version_sources',
    'urgent_guidance', 'urgent_guidance_rules', 'support_resources', 'sharing_grants', 'notification_devices',
    'notification_jobs', 'notification_delivery_attempts',
    'export_jobs', 'deletion_jobs', 'sharing_item_overrides',
    'invitation_rate_limit_events', 'user_notifications'
  ]::text[]));
reset role;

select extensions.is(text_array, array[]::text[], test_name)
from authorization_results
where text_array is not null;

select extensions.ok(bool_value, test_name)
from authorization_results
where test_name in (
  'storage_owner', 'storage_owner_update', 'storage_owner_delete', 'storage_owner_insert',
  'owner_reads_private_document', 'owner_reads_private_document_object',
  'storage_active_partner', 'active_partner_reads_only_shared_document',
  'active_partner_private_document_object_hidden',
  'item_override_denies_only_named_row',
  'revocation_applies_on_next_request',
  'storage_service', 'storage_service_update', 'storage_service_delete'
);

select extensions.ok(not bool_value, test_name)
from authorization_results
where test_name in (
  'storage_anon', 'storage_active_partner_update', 'storage_active_partner_delete',
  'storage_active_partner_insert', 'storage_revoked_partner', 'storage_expired_partner',
  'storage_unrelated', 'storage_unrelated_insert'
);

select * from extensions.finish();
rollback;
