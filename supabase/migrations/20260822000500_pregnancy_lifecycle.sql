begin;

create table public.pregnancy_experience_settings (
  pregnancy_id uuid primary key,
  owner_id uuid not null,
  lifecycle_status text not null default 'active',
  status_changed_at timestamptz not null default now(),
  status_before_archive text,
  compassionate_mode_enabled boolean not null default false,
  postpartum_mode_enabled boolean not null default false,
  effective_ended_at timestamptz,
  birth_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pregnancy_experience_pregnancy_owner_fk foreign key (pregnancy_id, owner_id) references public.pregnancies(id, owner_id) on delete cascade,
  constraint pregnancy_experience_status_check check (lifecycle_status in ('active', 'paused', 'loss', 'ended', 'birth', 'archived')),
  constraint pregnancy_experience_prior_check check (status_before_archive is null or status_before_archive in ('active', 'paused', 'loss', 'ended', 'birth')),
  constraint pregnancy_experience_end_check check ((lifecycle_status in ('active', 'paused') and effective_ended_at is null) or (lifecycle_status in ('loss', 'ended', 'birth', 'archived') and effective_ended_at is not null)),
  constraint pregnancy_experience_birth_check check ((lifecycle_status = 'birth' and birth_at is not null) or lifecycle_status <> 'birth'),
  constraint pregnancy_experience_postpartum_check check (not postpartum_mode_enabled or lifecycle_status = 'birth'),
  constraint pregnancy_experience_archive_check check ((lifecycle_status = 'archived' and archived_at is not null and status_before_archive is not null) or (lifecycle_status <> 'archived' and archived_at is null and status_before_archive is null)),
  constraint pregnancy_experience_timestamps_check check (updated_at >= created_at)
);
create index pregnancy_experience_owner_current_idx on public.pregnancy_experience_settings(owner_id, lifecycle_status, created_at desc);

insert into public.pregnancy_experience_settings (
  pregnancy_id, owner_id, lifecycle_status, status_changed_at,
  compassionate_mode_enabled, effective_ended_at, created_at, updated_at
)
select id, owner_id, case when ended_at is null then 'active' else 'ended' end,
  coalesce(ended_at, updated_at), ended_at is not null, ended_at, created_at, updated_at
from public.pregnancies;

comment on table public.pregnancy_experience_settings is
  'Owner-only lifecycle and presentation state kept off shared pregnancy rows to prevent involuntary disclosure.';
comment on column public.pregnancy_experience_settings.postpartum_mode_enabled is
  'Additive maternal-recovery mode after birth; never a baby tracker.';
comment on column public.pregnancies.ended_at is
  'Legacy shared field. Lifecycle transitions use owner-only pregnancy_experience_settings and do not mutate this field, preventing involuntary partner disclosure.';

create trigger set_updated_at before update on public.pregnancy_experience_settings for each row execute function app_private.set_updated_at();
alter table public.pregnancy_experience_settings enable row level security;
grant select on public.pregnancy_experience_settings to authenticated;
create policy pregnancy_experience_owner_read on public.pregnancy_experience_settings for select to authenticated using (owner_id = auth.uid());

create or replace function app_private.create_pregnancy_experience_settings()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  insert into public.pregnancy_experience_settings (
    pregnancy_id, owner_id, lifecycle_status, status_changed_at,
    compassionate_mode_enabled, effective_ended_at
  ) values (
    new.id, new.owner_id, case when new.ended_at is null then 'active' else 'ended' end,
    coalesce(new.ended_at, new.updated_at), new.ended_at is not null, new.ended_at
  );
  return new;
end;
$$;
create trigger create_pregnancy_experience_settings after insert on public.pregnancies
  for each row execute function app_private.create_pregnancy_experience_settings();

create table public.support_resources (
  id uuid primary key default gen_random_uuid(),
  locale text not null,
  jurisdiction_code text,
  resource_kind text not null,
  title text not null,
  description text not null,
  action_label text not null,
  action_uri text not null,
  status text not null default 'draft',
  reviewed_at timestamptz,
  valid_until timestamptz,
  priority smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_resources_locale_check check (char_length(btrim(locale)) between 2 and 35),
  constraint support_resources_jurisdiction_check check (jurisdiction_code is null or jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  constraint support_resources_kind_check check (resource_kind in ('general', 'loss', 'postpartum')),
  constraint support_resources_text_check check (char_length(btrim(title)) between 1 and 160 and char_length(btrim(description)) between 1 and 1000 and char_length(btrim(action_label)) between 1 and 80),
  constraint support_resources_uri_check check (action_uri ~ '^(https://|tel:|sms:|mailto:)'),
  constraint support_resources_status_check check (status in ('draft', 'published', 'archived')),
  constraint support_resources_publish_check check ((status = 'published' and reviewed_at is not null) or status <> 'published'),
  constraint support_resources_priority_check check (priority between 0 and 1000),
  constraint support_resources_review_window_check check (valid_until is null or reviewed_at is null or valid_until > reviewed_at),
  constraint support_resources_timestamps_check check (updated_at >= created_at)
);
create index support_resources_active_lookup_idx on public.support_resources(locale, resource_kind, priority) where status = 'published';
create trigger set_updated_at before update on public.support_resources for each row execute function app_private.set_updated_at();
alter table public.support_resources enable row level security;
grant select on public.support_resources to authenticated;
create policy support_resources_reviewed_read on public.support_resources for select to authenticated using (status = 'published' and reviewed_at is not null and (valid_until is null or valid_until > now()));

create or replace function public.get_current_pregnancy_experience()
returns table (
  pregnancy_id uuid, lifecycle_status text, status_changed_at timestamptz,
  status_before_archive text, compassionate_mode_enabled boolean,
  postpartum_mode_enabled boolean, effective_ended_at timestamptz
)
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select setting.pregnancy_id, setting.lifecycle_status, setting.status_changed_at,
    setting.status_before_archive, setting.compassionate_mode_enabled,
    setting.postpartum_mode_enabled, setting.effective_ended_at
  from public.pregnancy_experience_settings setting
  join public.pregnancies pregnancy on pregnancy.id = setting.pregnancy_id
  where setting.owner_id = auth.uid()
  order by case when setting.lifecycle_status = 'archived' then 1 else 0 end,
    pregnancy.created_at desc, pregnancy.id desc
  limit 1;
$$;

create or replace function public.get_current_pregnancy_id()
returns uuid language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select experience.pregnancy_id from public.get_current_pregnancy_experience() experience;
$$;

create or replace function app_private.suppress_celebratory_notification_job()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  notification_allowed boolean := false;
begin
  if new.category = 'weekly_update' and new.pregnancy_id is null then
    select setting.pregnancy_id into new.pregnancy_id
    from public.pregnancy_experience_settings setting
    join public.pregnancies pregnancy on pregnancy.id = setting.pregnancy_id
    where setting.owner_id = new.owner_id
    order by case when setting.lifecycle_status = 'archived' then 1 else 0 end,
      pregnancy.created_at desc, pregnancy.id desc
    limit 1
    for share of setting;
  end if;
  if new.category in ('weekly_update', 'photo') then
    select setting.lifecycle_status = 'active' and not setting.compassionate_mode_enabled
      into notification_allowed
    from public.pregnancy_experience_settings setting
    where setting.owner_id = new.owner_id
      and setting.pregnancy_id = new.pregnancy_id
    for share;
    if not coalesce(notification_allowed, false) then return null; end if;
  end if;
  return new;
end;
$$;
create trigger suppress_celebratory_notification_job before insert on public.notification_jobs for each row execute function app_private.suppress_celebratory_notification_job();

create or replace function public.transition_pregnancy_status(
  p_pregnancy_id uuid, p_to_status text,
  p_compassionate_mode boolean default null,
  p_postpartum_mode boolean default null
)
returns void language plpgsql volatile security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  setting public.pregnancy_experience_settings%rowtype;
  target_compassionate boolean;
  target_postpartum boolean;
  now_value timestamptz := pg_catalog.now();
begin
  select * into setting from public.pregnancy_experience_settings where pregnancy_id = p_pregnancy_id and owner_id = auth.uid() for update;
  if not found then raise exception using errcode = '42501', message = 'pregnancy_not_authorized'; end if;
  if p_to_status not in ('active', 'paused', 'loss', 'ended', 'birth', 'archived') then raise exception using errcode = '22023', message = 'invalid_pregnancy_status'; end if;
  if setting.lifecycle_status = 'archived' and p_to_status <> setting.status_before_archive then raise exception using errcode = '22023', message = 'archive_must_restore_previous_status'; end if;
  if setting.lifecycle_status in ('loss', 'ended', 'birth') and p_to_status not in (setting.lifecycle_status, 'active', 'archived') then raise exception using errcode = '22023', message = 'unsafe_pregnancy_transition'; end if;
  if p_to_status = 'archived' and setting.lifecycle_status = 'archived' then raise exception using errcode = '22023', message = 'pregnancy_already_archived'; end if;
  target_compassionate := case when p_to_status = 'loss' then true else coalesce(p_compassionate_mode, setting.compassionate_mode_enabled) end;
  target_postpartum := case when p_to_status = 'birth' then coalesce(p_postpartum_mode, true) else false end;

  update public.pregnancy_experience_settings set
    lifecycle_status = p_to_status,
    status_changed_at = case when p_to_status is distinct from setting.lifecycle_status then now_value else status_changed_at end,
    status_before_archive = case when p_to_status = 'archived' then setting.lifecycle_status else null end,
    compassionate_mode_enabled = target_compassionate,
    postpartum_mode_enabled = target_postpartum,
    effective_ended_at = case when p_to_status in ('active', 'paused') then null else coalesce(setting.effective_ended_at, now_value) end,
    birth_at = case when p_to_status = 'birth' then coalesce(setting.birth_at, now_value) when p_to_status = 'active' then null else setting.birth_at end,
    archived_at = case when p_to_status = 'archived' then now_value else null end
  where pregnancy_id = setting.pregnancy_id;

  if target_compassionate or p_to_status <> 'active' then
    update public.notification_jobs set status = 'cancelled', last_error_code = 'pregnancy_mode_suppressed'
    where owner_id = setting.owner_id and category in ('weekly_update', 'photo')
      and status in ('pending', 'retry', 'processing')
      and (pregnancy_id = setting.pregnancy_id or pregnancy_id is null);
  end if;

  insert into public.access_audit_events (actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type, resource_id, metadata)
  values (auth.uid(), auth.uid(), setting.pregnancy_id, 'pregnancy.lifecycle_changed', 'pregnancy', setting.pregnancy_id,
    pg_catalog.jsonb_build_object('from_status', setting.lifecycle_status, 'to_status', p_to_status, 'compassionate_mode', target_compassionate, 'postpartum_mode', target_postpartum, 'sharing_permissions_changed', false));
end;
$$;

revoke all on function app_private.create_pregnancy_experience_settings() from public, anon, authenticated;
revoke all on function public.get_current_pregnancy_experience() from public, anon;
revoke all on function public.get_current_pregnancy_id() from public, anon;
revoke all on function app_private.suppress_celebratory_notification_job() from public, anon, authenticated;
revoke all on function public.transition_pregnancy_status(uuid,text,boolean,boolean) from public, anon;
grant execute on function public.get_current_pregnancy_experience() to authenticated;
grant execute on function public.get_current_pregnancy_id() to authenticated;
grant execute on function public.transition_pregnancy_status(uuid,text,boolean,boolean) to authenticated;

commit;
