begin;

alter table public.meals
  add column appetite_response text,
  add column nausea_before text,
  add column nausea_after text,
  add column enjoyment text,
  add column would_eat_again boolean,
  add column client_mutation_id uuid,
  add constraint meals_appetite_response_check check (
    appetite_response is null or appetite_response in ('craving', 'aversion', 'neutral')
  ),
  add constraint meals_nausea_before_check check (
    nausea_before is null or nausea_before in ('none', 'a_little', 'moderate', 'a_lot')
  ),
  add constraint meals_nausea_after_check check (
    nausea_after is null or nausea_after in ('none', 'a_little', 'moderate', 'a_lot')
  ),
  add constraint meals_enjoyment_check check (
    enjoyment is null or enjoyment in ('not_enjoyed', 'somewhat', 'enjoyed')
  );

create unique index meals_owner_mutation_idx
  on public.meals(owner_id, client_mutation_id)
  where client_mutation_id is not null;
create index meals_owner_pregnancy_type_occurred_idx
  on public.meals(owner_id, pregnancy_id, meal_type, occurred_at desc);

alter table public.media_assets
  add column meal_id uuid,
  add constraint media_assets_meal_owner_fk
    foreign key (meal_id, owner_id)
    references public.meals(id, owner_id) on delete cascade,
  add constraint media_assets_single_log_parent_check
    check (not (journal_entry_id is not null and meal_id is not null));

create index media_assets_meal_idx on public.media_assets(meal_id)
  where meal_id is not null;

comment on column public.meals.client_mutation_id is
  'Opaque idempotency key. It must never encode food, symptom, date, or identity data.';
comment on column public.meals.notes is
  'Optional user-authored free text. It is not interpreted as medical or nutrition advice.';

create or replace function app_private.can_read_storage_object(
  target_bucket_id text,
  target_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select case target_bucket_id
    when 'tender-media' then exists (
      select 1
      from public.media_assets asset
      where asset.storage_bucket = target_bucket_id
        and asset.storage_path = target_name
        and asset.upload_status = 'ready'
        and asset.deleted_at is null
        and (
          (asset.journal_entry_id is not null and app_private.can_read_journal_entry(asset.journal_entry_id))
          or
          (asset.meal_id is not null and app_private.can_read_meal(asset.meal_id))
        )
    )
    when 'tender-documents' then exists (
      select 1 from public.documents document
      where document.storage_bucket = target_bucket_id
        and document.storage_path = target_name
        and app_private.has_pregnancy_permission(document.pregnancy_id, 'care.read')
    )
    else false
  end;
$function$;

drop policy if exists media_assets_authorized_select on public.media_assets;
create policy media_assets_authorized_select on public.media_assets
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      upload_status = 'ready' and deleted_at is null
      and (
        (journal_entry_id is not null and app_private.can_read_journal_entry(journal_entry_id))
        or (meal_id is not null and app_private.can_read_meal(meal_id))
      )
    )
  );

create or replace function public.save_meal_log(
  p_meal_id uuid,
  p_pregnancy_id uuid,
  p_mutation_id uuid,
  p_occurred_at timestamptz default null,
  p_meal_type text default null,
  p_free_text text default null,
  p_ingredients text[] default array[]::text[],
  p_appetite_response text default null,
  p_nausea_before text default null,
  p_nausea_after text default null,
  p_enjoyment text default null,
  p_would_eat_again boolean default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  current_meal public.meals%rowtype;
  saved_meal public.meals%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_meal_type is not null and p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'invalid meal type' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_meal_id::text, 0));
  select meal.* into current_meal from public.meals meal
    where meal.id = p_meal_id and meal.owner_id = actor_id;

  if found then
    if current_meal.client_mutation_id = p_mutation_id then
      return pg_catalog.jsonb_build_object('status', 'saved', 'meal_id', current_meal.id, 'updated_at', current_meal.updated_at);
    end if;
    if p_expected_updated_at is null or current_meal.updated_at is distinct from p_expected_updated_at then
      return pg_catalog.jsonb_build_object('status', 'conflict', 'meal_id', current_meal.id, 'updated_at', current_meal.updated_at);
    end if;
    update public.meals set
      occurred_at = coalesce(p_occurred_at, occurred_at), meal_type = p_meal_type,
      notes = nullif(pg_catalog.btrim(p_free_text), ''), appetite_response = p_appetite_response,
      nausea_before = p_nausea_before, nausea_after = p_nausea_after, enjoyment = p_enjoyment,
      would_eat_again = p_would_eat_again, client_mutation_id = p_mutation_id
    where id = p_meal_id and owner_id = actor_id returning * into saved_meal;
  else
    if p_expected_updated_at is not null then
      return pg_catalog.jsonb_build_object('status', 'conflict', 'meal_id', p_meal_id, 'updated_at', p_expected_updated_at);
    end if;
    insert into public.meals (
      id, pregnancy_id, owner_id, occurred_at, meal_type, notes, appetite_response,
      nausea_before, nausea_after, enjoyment, would_eat_again, client_mutation_id
    ) values (
      p_meal_id, p_pregnancy_id, actor_id, coalesce(p_occurred_at, pg_catalog.now()),
      p_meal_type, nullif(pg_catalog.btrim(p_free_text), ''), p_appetite_response,
      p_nausea_before, p_nausea_after, p_enjoyment, p_would_eat_again, p_mutation_id
    ) returning * into saved_meal;
  end if;

  delete from public.meal_items where meal_id = saved_meal.id and owner_id = actor_id;
  insert into public.meal_items (owner_id, meal_id, item_name)
  select actor_id, saved_meal.id, ingredient
  from (
    select distinct pg_catalog.btrim(raw) as ingredient
    from pg_catalog.unnest(coalesce(p_ingredients, array[]::text[])) raw
    where pg_catalog.char_length(pg_catalog.btrim(raw)) between 1 and 120
  ) normalized;

  return pg_catalog.jsonb_build_object('status', 'saved', 'meal_id', saved_meal.id, 'updated_at', saved_meal.updated_at);
end;
$function$;

revoke all on function public.save_meal_log(uuid, uuid, uuid, timestamptz, text, text, text[], text, text, text, text, boolean, timestamptz) from public, anon;
grant execute on function public.save_meal_log(uuid, uuid, uuid, timestamptz, text, text, text[], text, text, text, text, boolean, timestamptz) to authenticated;

commit;
