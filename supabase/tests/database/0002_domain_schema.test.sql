begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(16);

create temporary table expected_domain_tables (table_name text primary key) on commit drop;
insert into expected_domain_tables (table_name) values
  ('profiles'), ('pregnancies'), ('pregnancy_members'), ('partner_invitations'),
  ('user_preferences'), ('notification_preferences'), ('providers'), ('emergency_contacts'),
  ('journal_entries'), ('journal_entry_tags'), ('tags'), ('media_assets'), ('photo_series'),
  ('daily_checkins'), ('emotions'), ('checkin_emotions'), ('symptoms'), ('checkin_symptoms'),
  ('wellness_observations'), ('meals'), ('meal_items'),
  ('appointments'), ('appointment_questions'), ('appointment_notes'), ('medications'),
  ('medication_schedules'), ('medication_change_records'), ('documents'),
  ('projects'), ('tasks'), ('support_requests'),
  ('pregnancy_weeks'), ('content_articles'), ('content_sources'), ('content_versions'),
  ('content_version_sources'), ('clinical_reviews'), ('urgent_guidance'),
  ('urgent_guidance_rules'),
  ('consent_records'), ('sharing_grants'), ('access_audit_events'), ('notification_devices'),
  ('export_jobs'), ('deletion_jobs'), ('sharing_item_overrides'),
  ('invitation_rate_limit_events'), ('user_notifications');

select extensions.is(
  (select count(*) from expected_domain_tables),
  48::bigint,
  'the normalized domain contract contains requested tables plus citation and reviewed safety-rule joins'
);

select extensions.is(
  (
    select count(*)
    from expected_domain_tables expected
    where to_regclass(format('public.%I', expected.table_name)) is null
  ),
  0::bigint,
  'all domain contract tables exist'
);

select extensions.is(
  (
    select count(*)
    from expected_domain_tables expected
    where not exists (
      select 1
      from pg_constraint constraint_record
      join pg_class relation on relation.oid = constraint_record.conrelid
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = expected.table_name
        and constraint_record.contype = 'p'
        and pg_get_constraintdef(constraint_record.oid) = 'PRIMARY KEY (id)'
    )
  ),
  0::bigint,
  'every domain table has an id primary key'
);

select extensions.is(
  (
    select count(*)
    from expected_domain_tables expected
    join information_schema.columns column_record
      on column_record.table_schema = 'public'
     and column_record.table_name = expected.table_name
     and column_record.column_name = 'id'
    where column_record.data_type <> 'uuid'
  ),
  0::bigint,
  'every domain table uses a UUID id'
);

select extensions.is(
  (
    select count(*)
    from expected_domain_tables expected
    where not exists (
      select 1 from information_schema.columns column_record
      where column_record.table_schema = 'public'
        and column_record.table_name = expected.table_name
        and column_record.column_name = 'created_at'
        and column_record.data_type = 'timestamp with time zone'
    )
  ),
  0::bigint,
  'every domain table has created_at timestamptz'
);

select extensions.is(
  (
    select count(*)
    from expected_domain_tables expected
    where not exists (
      select 1 from information_schema.columns column_record
      where column_record.table_schema = 'public'
        and column_record.table_name = expected.table_name
        and column_record.column_name = 'updated_at'
        and column_record.data_type = 'timestamp with time zone'
    )
  ),
  0::bigint,
  'every domain table has updated_at timestamptz'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public' and column_name = 'current_week'
  ),
  0::bigint,
  'current pregnancy week is never stored as truth'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pregnancies'
      and column_name in (
        'lmp_date', 'estimated_due_date', 'due_date_source',
        'clinician_confirmed_at', 'timezone'
      )
  ),
  5::bigint,
  'pregnancy dating stores the approved source facts'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'pregnancy_weeks', 'content_articles', 'content_sources', 'content_versions',
        'content_version_sources', 'clinical_reviews', 'urgent_guidance',
        'urgent_guidance_rules'
      )
      and column_name = 'owner_id'
  ),
  0::bigint,
  'editorial medical content is not modeled as user-owned content'
);

select extensions.ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'content_sources'
      and column_name = 'jurisdiction_code'
      and data_type = 'text'
  ),
  'editorial sources carry an explicit jurisdiction code'
);

select extensions.ok(
  to_regprocedure('app_private.has_pregnancy_permission(uuid,text)') is not null,
  'explicit pregnancy permission helper exists'
);

select extensions.ok(
  to_regprocedure('app_private.has_approved_clinical_review(uuid,uuid)') is not null,
  'clinical review visibility helper exists'
);

select extensions.ok(
  (select prosecdef from pg_proc
   where oid = 'app_private.has_pregnancy_permission(uuid,text)'::regprocedure),
  'permission helper is security definer'
);

select extensions.ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'app_private.has_pregnancy_permission(uuid,text)'::regprocedure),
  'permission helper has an empty search_path'
);

select extensions.ok(
  (select relrowsecurity from pg_class relation
   join pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public' and relation.relname = 'sharing_grants'),
  'sharing grants have row-level security enabled'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and column_name in ('is_partner', 'partner_access', 'shared_with_partner')
  ),
  0::bigint,
  'no broad partner-access boolean exists'
);

select * from extensions.finish();
rollback;
