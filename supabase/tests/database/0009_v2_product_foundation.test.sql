begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_table(
  'public',
  'home_module_preferences',
  'V2 home modules have owner preferences'
);
select extensions.has_table(
  'public',
  'memory_capsules',
  'V2 memory capsules exist'
);
select extensions.has_table(
  'public',
  'memory_capsule_items',
  'V2 capsule membership exists'
);
select extensions.has_table(
  'public',
  'health_connections',
  'optional health connections exist'
);
select extensions.has_table(
  'public',
  'health_metric_permissions',
  'per-metric health request state exists'
);
select extensions.has_table(
  'public',
  'health_daily_summaries',
  'opt-in daily health summaries exist'
);

select extensions.has_column(
  'public',
  'journal_entries',
  'resurface_allowed',
  'journal resurfacing is explicit'
);
select extensions.has_column(
  'public',
  'journal_entries',
  'resurface_reviewed_at',
  'resurfacing review time is recorded'
);

select extensions.has_column(
  'public',
  'user_preferences',
  'default_add_action',
  'the owner can pin one Add action'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointment_questions'
      and column_name in (
        'priority',
        'status',
        'source_type',
        'source_id',
        'selected_for_summary'
      )
  ),
  5::bigint,
  'appointment preparation fields are complete'
);

select extensions.is(
  (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'home_module_preferences',
        'memory_capsules',
        'memory_capsule_items',
        'health_connections',
        'health_metric_permissions',
        'health_daily_summaries'
      )
      and relation.relrowsecurity
  ),
  6::bigint,
  'all V2 tables enforce row-level security'
);

select extensions.is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'home_module_preferences',
        'memory_capsules',
        'memory_capsule_items',
        'health_connections',
        'health_metric_permissions',
        'health_daily_summaries'
      )
      and policyname in (
        'owner_select',
        'owner_insert',
        'owner_update',
        'owner_delete'
      )
  ),
  24::bigint,
  'V2 records have command-specific owner policies'
);

select extensions.is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'health_connections',
        'health_metric_permissions',
        'health_daily_summaries'
      )
      and policyname not in (
        'owner_select',
        'owner_insert',
        'owner_update',
        'owner_delete'
      )
  ),
  0::bigint,
  'health data has no partner policy'
);

select extensions.ok(
  to_regprocedure(
    'public.save_journal_entry_v2(uuid,uuid,text,text,timestamptz,boolean,text,boolean,uuid[],timestamptz)'
  ) is not null,
  'the V2 journal save function exists'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.save_journal_entry_v2(uuid,uuid,text,text,timestamptz,boolean,text,boolean,uuid[],timestamptz)',
    'execute'
  ),
  'anonymous callers cannot save a V2 journal entry'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.save_journal_entry_v2(uuid,uuid,text,text,timestamptz,boolean,text,boolean,uuid[],timestamptz)',
    'execute'
  ),
  'authenticated owners can call the V2 journal save function'
);

select extensions.ok(
  to_regprocedure(
    'public.save_weekly_memory_capsule(uuid,date,text,uuid[])'
  ) is not null,
  'weekly memory capsules use a reviewed server function'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.memory_capsule_items',
    'insert'
  ),
  'clients cannot bypass memory capsule eligibility checks'
);

select extensions.ok(
  to_regprocedure('app_private.validate_health_summary_storage()') is not null,
  'health summary storage has an opt-in gate'
);

select extensions.ok(
  to_regprocedure('public.disconnect_and_delete_health_data()') is not null,
  'health disconnect has one owner-scoped deletion function'
);

select extensions.ok(
  to_regprocedure('public.build_account_export(uuid)') is not null,
  'account export has a service-only function'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.build_account_export(uuid)',
    'execute'
  ),
  'clients cannot bypass the account export service'
);

select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.build_account_export(uuid)',
    'execute'
  ),
  'the account export service can build an owner export'
);

select extensions.is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'health_connections',
        'health_metric_permissions',
        'health_daily_summaries'
      )
      and grantee = 'anon'
  ),
  0::bigint,
  'anonymous users have no health table grants'
);

select * from extensions.finish();
rollback;
