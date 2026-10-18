begin;

create or replace function public.disconnect_and_delete_health_data()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  actor_id uuid := auth.uid();
  deleted_summary_count integer;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.health_daily_summaries summary
  where summary.owner_id = actor_id;
  get diagnostics deleted_summary_count = row_count;

  delete from public.health_metric_permissions permission
  where permission.owner_id = actor_id;

  update public.health_connections connection
  set status = 'disconnected',
      storage_opt_in = false,
      disconnected_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where connection.owner_id = actor_id
    and connection.status <> 'disconnected';

  return deleted_summary_count;
end;
$function$;

revoke all on function public.disconnect_and_delete_health_data()
  from public, anon;
grant execute on function public.disconnect_and_delete_health_data()
  to authenticated;

commit;
