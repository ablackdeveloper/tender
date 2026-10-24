begin;

-- Keep V2 owner policies command-specific. This makes each allowed operation
-- visible during review and prevents one broad policy from hiding write rules.
do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'home_module_preferences',
    'memory_capsules',
    'memory_capsule_items',
    'health_connections',
    'health_metric_permissions',
    'health_daily_summaries'
  ] loop
    execute format('drop policy if exists owner_access on public.%I', table_name);
    execute format(
      'create policy owner_select on public.%I for select to authenticated using (app_private.is_current_user(owner_id))',
      table_name
    );
    execute format(
      'create policy owner_insert on public.%I for insert to authenticated with check (app_private.is_current_user(owner_id))',
      table_name
    );
    execute format(
      'create policy owner_update on public.%I for update to authenticated using (app_private.is_current_user(owner_id)) with check (app_private.is_current_user(owner_id))',
      table_name
    );
    execute format(
      'create policy owner_delete on public.%I for delete to authenticated using (app_private.is_current_user(owner_id))',
      table_name
    );
  end loop;
end;
$migration$;

-- service_role is the trusted server role. Later migrations introduced tables
-- after the original grant pass, so refresh its complete table access here.
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- Reapply the security-definer contract after all V2 functions exist.
do $migration$
declare
  function_record record;
begin
  for function_record in
    select
      namespace.nspname as schema_name,
      function_row.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(function_row.oid) as arguments
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_row.pronamespace
    where function_row.prosecdef
      and namespace.nspname in ('app_private', 'public')
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = ''''',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
    execute format(
      'alter function %I.%I(%s) set row_security = off',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
  end loop;
end;
$migration$;

commit;
