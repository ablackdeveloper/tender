begin;

create or replace function public.save_weekly_memory_capsule(
  p_pregnancy_id uuid,
  p_week_start date,
  p_title text,
  p_entry_ids uuid[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  actor_id uuid := auth.uid();
  capsule_id uuid;
  eligible_count integer;
  entry_count integer := coalesce(pg_catalog.array_length(p_entry_ids, 1), 0);
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if entry_count < 1 or entry_count > 5 then
    raise exception 'A memory capsule requires between one and five entries';
  end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'Memory capsule week_start must be a Monday';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_title)) not between 1 and 160 then
    raise exception 'Memory capsule title is invalid';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(p_entry_ids) as selected(entry_id)
    group by selected.entry_id
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'A memory capsule cannot contain duplicate entries';
  end if;
  if not exists (
    select 1
    from public.pregnancy_experience_settings setting
    where setting.owner_id = actor_id
      and setting.pregnancy_id = p_pregnancy_id
      and setting.lifecycle_status in ('active', 'paused')
      and not setting.compassionate_mode_enabled
  ) then
    raise exception 'Memory resurfacing is unavailable for this pregnancy state';
  end if;

  select pg_catalog.count(*)
  into eligible_count
  from public.journal_entries entry
  where entry.owner_id = actor_id
    and entry.pregnancy_id = p_pregnancy_id
    and entry.id = any(p_entry_ids)
    and entry.resurface_allowed
    and entry.archived_at is null;

  if eligible_count <> entry_count then
    raise exception 'One or more memory entries are not eligible for resurfacing';
  end if;

  insert into public.memory_capsules (
    pregnancy_id, owner_id, week_start, title, status
  ) values (
    p_pregnancy_id, actor_id, p_week_start, pg_catalog.btrim(p_title), 'ready'
  )
  on conflict (owner_id, pregnancy_id, week_start) do update
  set title = excluded.title,
      status = 'ready',
      updated_at = pg_catalog.now()
  returning id into capsule_id;

  delete from public.memory_capsule_items item
  where item.owner_id = actor_id
    and item.capsule_id = capsule_id;

  insert into public.memory_capsule_items (
    owner_id, capsule_id, journal_entry_id, position
  )
  select actor_id, capsule_id, selected.entry_id, selected.position - 1
  from pg_catalog.unnest(p_entry_ids) with ordinality
    as selected(entry_id, position);

  return capsule_id;
end;
$function$;

revoke insert, update, delete on public.memory_capsules from authenticated;
revoke insert, update, delete on public.memory_capsule_items from authenticated;
revoke all on function public.save_weekly_memory_capsule(uuid, date, text, uuid[])
  from public, anon;
grant execute on function public.save_weekly_memory_capsule(uuid, date, text, uuid[])
  to authenticated;

commit;
