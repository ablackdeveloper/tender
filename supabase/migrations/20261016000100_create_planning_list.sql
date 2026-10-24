begin;

-- One transaction prevents an empty project or half a checklist after a failure.
-- The caller supplies an id to make a retry safe after a lost response.
create or replace function public.create_planning_list(
  p_project_id uuid,
  p_pregnancy_id uuid,
  p_title text,
  p_tasks text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_owner uuid := auth.uid();
  v_inserted uuid;
begin
  if v_owner is null or not exists (
    select 1 from public.pregnancies where id = p_pregnancy_id and owner_id = v_owner
  ) then
    raise exception 'Only the pregnancy owner can create a plan' using errcode = '42501';
  end if;
  if p_project_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 240
    or p_tasks is null or cardinality(p_tasks) not between 1 and 50
    or array_ndims(p_tasks) <> 1
    or exists (select 1 from unnest(p_tasks) item where item is null or char_length(btrim(item)) not between 1 and 240)
  then
    raise exception 'Provide a title and 1 to 50 nonempty tasks' using errcode = '22023';
  end if;

  insert into public.projects(id, owner_id, pregnancy_id, title)
    values (p_project_id, v_owner, p_pregnancy_id, btrim(p_title))
    on conflict (id) do nothing returning id into v_inserted;
  if v_inserted is null then
    if not exists (select 1 from public.projects where id = p_project_id and owner_id = v_owner and pregnancy_id = p_pregnancy_id) then
      raise exception 'Plan identifier is unavailable' using errcode = '42501';
    end if;
    return p_project_id;
  end if;

  insert into public.tasks(owner_id, project_id, title, position)
    select v_owner, p_project_id, btrim(item), ordinal::integer - 1
    from unnest(p_tasks) with ordinality as selection(item, ordinal);
  return p_project_id;
end;
$function$;

revoke all on function public.create_planning_list(uuid, uuid, text, text[]) from public, anon;
grant execute on function public.create_planning_list(uuid, uuid, text, text[]) to authenticated;

commit;
