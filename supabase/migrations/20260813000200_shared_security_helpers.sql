begin;

create or replace function app_private.current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $function$
  select auth.uid();
$function$;

comment on function app_private.current_user_id() is
  'Returns the authenticated JWT subject, or null when no user is authenticated.';

create or replace function app_private.is_current_user(expected_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select expected_user_id is not null
    and expected_user_id = app_private.current_user_id();
$function$;

comment on function app_private.is_current_user(uuid) is
  'Fail-closed ownership predicate for use in row-level security policies.';

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$function$;

comment on function app_private.set_updated_at() is
  'Trigger helper for tables with a timestamptz updated_at column.';

revoke all on function app_private.current_user_id() from public;
revoke all on function app_private.current_user_id() from anon;
revoke all on function app_private.current_user_id() from authenticated;
grant execute on function app_private.current_user_id() to authenticated;
grant execute on function app_private.current_user_id() to service_role;

revoke all on function app_private.is_current_user(uuid) from public;
revoke all on function app_private.is_current_user(uuid) from anon;
revoke all on function app_private.is_current_user(uuid) from authenticated;
grant execute on function app_private.is_current_user(uuid) to authenticated;
grant execute on function app_private.is_current_user(uuid) to service_role;

revoke all on function app_private.set_updated_at() from public;
revoke all on function app_private.set_updated_at() from anon;
revoke all on function app_private.set_updated_at() from authenticated;
revoke all on function app_private.set_updated_at() from service_role;

commit;
