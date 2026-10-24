begin;

alter table public.partner_invitations
  add column permissions text[] not null default '{}'::text[],
  add constraint partner_invitations_permissions_check check (
    permissions <@ array['appointments.read', 'tasks.read', 'support_requests.read', 'journal.read']::text[]
    and pg_catalog.cardinality(permissions) <= 4
  );

create table public.sharing_item_overrides (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  resource_type text not null,
  resource_id uuid not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sharing_item_overrides_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint sharing_item_overrides_distinct_users_check check (owner_id <> grantee_user_id),
  constraint sharing_item_overrides_permission_resource_check check (
    (permission = 'appointments.read' and resource_type = 'appointment')
    or (permission = 'tasks.read' and resource_type = 'task')
    or (permission = 'support_requests.read' and resource_type = 'support_request')
    or (permission = 'journal.read' and resource_type = 'journal_entry')
  ),
  constraint sharing_item_overrides_unique unique (
    pregnancy_id, grantee_user_id, permission, resource_type, resource_id
  ),
  constraint sharing_item_overrides_timestamps_check check (updated_at >= created_at)
);

comment on table public.sharing_item_overrides is
  'A category grant is always required. An item override can only further deny an otherwise granted row.';

create table public.invitation_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null references public.pregnancies(id) on delete cascade,
  email_hash text not null,
  ip_hash text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitation_rate_limit_email_hash_check check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint invitation_rate_limit_ip_hash_check check (ip_hash ~ '^[0-9a-f]{64}$'),
  constraint invitation_rate_limit_immutable_check check (updated_at = created_at)
);

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid references public.pregnancies(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_notifications_event_type_check check (
    event_type ~ '^sharing\.[a-z][a-z0-9_.-]{0,79}$'
  ),
  constraint user_notifications_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint user_notifications_body_check check (char_length(btrim(body)) between 1 and 500),
  constraint user_notifications_read_check check (read_at is null or read_at >= created_at),
  constraint user_notifications_timestamps_check check (updated_at >= created_at)
);

create index sharing_item_overrides_grantee_idx
  on public.sharing_item_overrides(grantee_user_id, pregnancy_id, permission, resource_id);
create index invitation_rate_limit_actor_idx
  on public.invitation_rate_limit_events(actor_user_id, occurred_at desc);
create index invitation_rate_limit_email_idx
  on public.invitation_rate_limit_events(email_hash, occurred_at desc);
create index invitation_rate_limit_ip_idx
  on public.invitation_rate_limit_events(ip_hash, occurred_at desc);
create index user_notifications_owner_unread_idx
  on public.user_notifications(owner_id, created_at desc) where read_at is null;

create trigger set_updated_at before update on public.sharing_item_overrides
  for each row execute function app_private.set_updated_at();
create trigger set_updated_at before update on public.user_notifications
  for each row execute function app_private.set_updated_at();

alter table public.sharing_item_overrides enable row level security;
alter table public.invitation_rate_limit_events enable row level security;
alter table public.user_notifications enable row level security;

revoke all on public.sharing_item_overrides, public.invitation_rate_limit_events,
  public.user_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.sharing_item_overrides,
  public.invitation_rate_limit_events, public.user_notifications to service_role;
grant select on public.sharing_item_overrides to authenticated;
grant select on public.user_notifications to authenticated;
create policy sharing_item_overrides_owner_select on public.sharing_item_overrides
  for select to authenticated using (owner_id = auth.uid());
create policy user_notifications_owner_select on public.user_notifications
  for select to authenticated using (owner_id = auth.uid());

create or replace function app_private.valid_together_permissions(target_permissions text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $function$
  select target_permissions is not null
    and target_permissions <@ array[
      'appointments.read', 'tasks.read', 'support_requests.read', 'journal.read'
    ]::text[]
    and pg_catalog.cardinality(target_permissions) <= 4
    and pg_catalog.cardinality(target_permissions) = (
      select pg_catalog.count(distinct permission)::integer
      from pg_catalog.unnest(target_permissions) permission
    );
$function$;

create or replace function app_private.has_item_permission(
  target_pregnancy_id uuid,
  target_permission text,
  target_resource_type text,
  target_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select app_private.has_pregnancy_permission(target_pregnancy_id, target_permission)
    and not exists (
      select 1
      from public.sharing_item_overrides item_override
      where item_override.pregnancy_id = target_pregnancy_id
        and item_override.grantee_user_id = auth.uid()
        and item_override.permission = target_permission
        and item_override.resource_type = target_resource_type
        and item_override.resource_id = target_resource_id
        and not item_override.allowed
    );
$function$;

create or replace function app_private.can_read_appointment(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1 from public.appointments appointment
    where appointment.id = target_id
      and (
        appointment.owner_id = auth.uid()
        or app_private.has_item_permission(
          appointment.pregnancy_id, 'appointments.read', 'appointment', appointment.id
        )
      )
  );
$function$;

create or replace function app_private.can_read_task(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1
    from public.tasks task
    join public.projects project on project.id = task.project_id
    where task.id = target_id
      and (
        task.owner_id = auth.uid()
        or app_private.has_item_permission(
          project.pregnancy_id, 'tasks.read', 'task', task.id
        )
      )
  );
$function$;

create or replace function app_private.can_read_support_request(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1 from public.support_requests support_request
    where support_request.id = target_id
      and (
        support_request.owner_id = auth.uid()
        or app_private.has_item_permission(
          support_request.pregnancy_id,
          'support_requests.read',
          'support_request',
          support_request.id
        )
      )
  );
$function$;

create or replace function app_private.can_read_journal_entry(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1 from public.journal_entries entry
    where entry.id = target_id
      and (
        entry.owner_id = auth.uid()
        or (
          entry.privacy_level = 'shared'
          and app_private.has_item_permission(
            entry.pregnancy_id, 'journal.read', 'journal_entry', entry.id
          )
        )
      )
  );
$function$;

drop policy if exists appointments_authorized_select on public.appointments;
create policy appointments_authorized_select on public.appointments
  for select to authenticated using (app_private.can_read_appointment(id));
drop policy if exists tasks_authorized_select on public.tasks;
create policy tasks_authorized_select on public.tasks
  for select to authenticated using (app_private.can_read_task(id));
drop policy if exists support_requests_authorized_select on public.support_requests;
drop policy if exists support_requests_explicit_grant_read on public.support_requests;
create policy support_requests_authorized_select on public.support_requests
  for select to authenticated using (app_private.can_read_support_request(id));

create or replace function app_private.insert_sharing_notification(
  target_owner_id uuid,
  target_pregnancy_id uuid,
  target_event_type text,
  target_title text,
  target_body text
)
returns void
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  insert into public.user_notifications (
    owner_id, pregnancy_id, event_type, title, body
  ) values (
    target_owner_id, target_pregnancy_id, target_event_type, target_title, target_body
  );
$function$;

create or replace function public.create_partner_invitation(
  p_actor_id uuid,
  p_pregnancy_id uuid,
  p_email text,
  p_role text,
  p_token_hash text,
  p_permissions text[],
  p_expires_at timestamptz,
  p_email_hash text,
  p_ip_hash text,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  invitation_id uuid;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  limited boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text, 0));
  if not exists (
    select 1 from public.pregnancies pregnancy
    where pregnancy.id = p_pregnancy_id and pregnancy.owner_id = p_actor_id
  ) then
    return pg_catalog.jsonb_build_object('accepted', false);
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_role not in ('partner', 'support_person', 'caregiver')
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_email_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash !~ '^[0-9a-f]{64}$'
    or not app_private.valid_together_permissions(p_permissions)
    or p_expires_at <= pg_catalog.now()
    or p_expires_at > pg_catalog.now() + interval '14 days' then
    return pg_catalog.jsonb_build_object('accepted', false);
  end if;

  select
    (select count(*) from public.invitation_rate_limit_events event
      where event.actor_user_id = p_actor_id and event.occurred_at > pg_catalog.now() - interval '15 minutes') >= 5
    or (select count(*) from public.invitation_rate_limit_events event
      where event.email_hash = p_email_hash and event.occurred_at > pg_catalog.now() - interval '1 day') >= 3
    or (select count(*) from public.invitation_rate_limit_events event
      where event.ip_hash = p_ip_hash and event.occurred_at > pg_catalog.now() - interval '1 hour') >= 20
  into limited;

  insert into public.invitation_rate_limit_events (
    actor_user_id, pregnancy_id, email_hash, ip_hash
  ) values (p_actor_id, p_pregnancy_id, p_email_hash, p_ip_hash);
  if limited then
    return pg_catalog.jsonb_build_object('accepted', false);
  end if;

  update public.partner_invitations
  set status = 'expired', updated_at = pg_catalog.now()
  where pregnancy_id = p_pregnancy_id and invited_email = normalized_email
    and status = 'pending' and expires_at <= pg_catalog.now();

  if exists (
    select 1 from public.partner_invitations invitation
    where invitation.pregnancy_id = p_pregnancy_id
      and invitation.invited_email = normalized_email
      and invitation.status = 'pending'
  ) then
    return pg_catalog.jsonb_build_object('accepted', false);
  end if;

  insert into public.partner_invitations (
    pregnancy_id, owner_id, invited_by_user_id, invited_email, invitation_role,
    token_hash, permissions, expires_at
  ) values (
    p_pregnancy_id, p_actor_id, p_actor_id, normalized_email, p_role,
    p_token_hash, p_permissions, p_expires_at
  ) returning id into invitation_id;

  insert into public.access_audit_events (
    actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
    resource_id, request_id, ip_hash, metadata
  ) values (
    p_actor_id, p_actor_id, p_pregnancy_id, 'sharing.invitation_created',
    'partner_invitation', invitation_id, p_request_id, p_ip_hash,
    pg_catalog.jsonb_build_object('permission_count', pg_catalog.cardinality(p_permissions))
  );
  return pg_catalog.jsonb_build_object('accepted', true, 'invitation_id', invitation_id);
end;
$function$;

create or replace function public.cancel_partner_invitation_delivery(
  p_actor_id uuid,
  p_invitation_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  invitation public.partner_invitations%rowtype;
begin
  update public.partner_invitations
  set status = 'revoked', revoked_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_invitation_id and owner_id = p_actor_id and status = 'pending'
  returning * into invitation;
  if found then
    insert into public.access_audit_events (
      actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
      resource_id, request_id
    ) values (
      p_actor_id, p_actor_id, invitation.pregnancy_id,
      'sharing.invitation_delivery_failed', 'partner_invitation', invitation.id,
      p_request_id
    );
  end if;
end;
$function$;

create or replace function public.accept_partner_invitation(
  p_actor_id uuid,
  p_raw_token text,
  p_request_id uuid,
  p_ip_hash text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  invitation public.partner_invitations%rowtype;
  actor_email text;
  permission_name text;
begin
  if p_actor_id is null or p_raw_token is null
    or pg_catalog.octet_length(p_raw_token) < 43
    or pg_catalog.octet_length(p_raw_token) > 512 then
    raise exception 'invitation is invalid or expired' using errcode = '22023';
  end if;
  select pg_catalog.lower(pg_catalog.btrim(auth_user.email)) into actor_email
  from auth.users auth_user where auth_user.id = p_actor_id;
  select invitation_row.* into invitation
  from public.partner_invitations invitation_row
  where invitation_row.token_hash = pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_raw_token, 'UTF8'), 'sha256'), 'hex'
    )
    and invitation_row.status = 'pending'
    and invitation_row.expires_at > pg_catalog.now()
    and invitation_row.invited_email = actor_email
  for update;
  if not found then
    raise exception 'invitation is invalid or expired' using errcode = '22023';
  end if;

  update public.partner_invitations
  set status = 'accepted', accepted_at = pg_catalog.now(),
      accepted_by_user_id = p_actor_id, updated_at = pg_catalog.now()
  where id = invitation.id and status = 'pending';
  if not found then
    raise exception 'invitation is invalid or expired' using errcode = '22023';
  end if;

  insert into public.pregnancy_members (
    pregnancy_id, owner_id, user_id, membership_role, status, joined_at
  ) values (
    invitation.pregnancy_id, invitation.owner_id, p_actor_id,
    invitation.invitation_role, 'active', pg_catalog.now()
  ) on conflict (pregnancy_id, user_id) do update
  set membership_role = excluded.membership_role, status = 'active',
      joined_at = excluded.joined_at, left_at = null, updated_at = pg_catalog.now();

  foreach permission_name in array invitation.permissions loop
    insert into public.sharing_grants (
      pregnancy_id, owner_id, grantee_user_id, permission, granted_at
    ) values (
      invitation.pregnancy_id, invitation.owner_id, p_actor_id,
      permission_name, pg_catalog.now()
    ) on conflict (pregnancy_id, grantee_user_id, permission)
      where revoked_at is null do update
      set expires_at = null, updated_at = pg_catalog.now();
  end loop;
  insert into public.sharing_grants (
    pregnancy_id, owner_id, grantee_user_id, permission, granted_at
  ) values (
    invitation.pregnancy_id, invitation.owner_id, p_actor_id,
    'pregnancy.read', pg_catalog.now()
  ) on conflict (pregnancy_id, grantee_user_id, permission)
    where revoked_at is null do update set expires_at = null, updated_at = pg_catalog.now();

  insert into public.access_audit_events (
    actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
    resource_id, request_id, ip_hash, metadata
  ) values (
    p_actor_id, invitation.owner_id, invitation.pregnancy_id,
    'sharing.invitation_accepted', 'partner_invitation', invitation.id,
    p_request_id, p_ip_hash,
    pg_catalog.jsonb_build_object('permission_count', pg_catalog.cardinality(invitation.permissions))
  );
  perform app_private.insert_sharing_notification(
    invitation.owner_id, invitation.pregnancy_id, 'sharing.invitation_accepted',
    'Partner invitation accepted',
    'A partner accepted an invitation. Review their current access categories.'
  );
  return invitation.pregnancy_id;
end;
$function$;

create or replace function public.decline_partner_invitation(
  p_actor_id uuid,
  p_raw_token text,
  p_request_id uuid,
  p_ip_hash text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  invitation public.partner_invitations%rowtype;
  actor_email text;
begin
  select pg_catalog.lower(pg_catalog.btrim(auth_user.email)) into actor_email
  from auth.users auth_user where auth_user.id = p_actor_id;
  select invitation_row.* into invitation
  from public.partner_invitations invitation_row
  where invitation_row.token_hash = pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_raw_token, 'UTF8'), 'sha256'), 'hex'
    )
    and invitation_row.status = 'pending'
    and invitation_row.expires_at > pg_catalog.now()
    and invitation_row.invited_email = actor_email
  for update;
  if not found then
    raise exception 'invitation is invalid or expired' using errcode = '22023';
  end if;
  update public.partner_invitations
  set status = 'declined', updated_at = pg_catalog.now()
  where id = invitation.id and status = 'pending';
  insert into public.access_audit_events (
    actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
    resource_id, request_id, ip_hash
  ) values (
    p_actor_id, invitation.owner_id, invitation.pregnancy_id,
    'sharing.invitation_declined', 'partner_invitation', invitation.id,
    p_request_id, p_ip_hash
  );
  perform app_private.insert_sharing_notification(
    invitation.owner_id, invitation.pregnancy_id, 'sharing.invitation_declined',
    'Partner invitation declined', 'A partner declined an invitation.'
  );
end;
$function$;

create or replace function public.revoke_partner_access(
  p_actor_id uuid,
  p_pregnancy_id uuid,
  p_grantee_user_id uuid,
  p_request_id uuid,
  p_ip_hash text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
begin
  if not exists (
    select 1 from public.pregnancies pregnancy
    where pregnancy.id = p_pregnancy_id and pregnancy.owner_id = p_actor_id
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_pregnancy_id::text || p_grantee_user_id::text, 0)
  );
  update public.sharing_grants set revoked_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where pregnancy_id = p_pregnancy_id and owner_id = p_actor_id
    and grantee_user_id = p_grantee_user_id and revoked_at is null;
  update public.pregnancy_members
  set status = 'removed', left_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where pregnancy_id = p_pregnancy_id and owner_id = p_actor_id
    and user_id = p_grantee_user_id and status = 'active';
  insert into public.access_audit_events (
    actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
    resource_id, request_id, ip_hash
  ) values (
    p_actor_id, p_grantee_user_id, p_pregnancy_id,
    'sharing.partner_revoked', 'pregnancy_member', p_grantee_user_id,
    p_request_id, p_ip_hash
  );
  perform app_private.insert_sharing_notification(
    p_actor_id, p_pregnancy_id, 'sharing.partner_revoked',
    'Partner access revoked',
    'Partner access was revoked at the database and applies to the next request.'
  );
end;
$function$;

create or replace function public.set_partner_permissions(
  p_actor_id uuid,
  p_pregnancy_id uuid,
  p_grantee_user_id uuid,
  p_permissions text[],
  p_request_id uuid,
  p_ip_hash text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  permission_name text;
begin
  if not app_private.valid_together_permissions(p_permissions)
    or not exists (
      select 1 from public.pregnancies pregnancy
      where pregnancy.id = p_pregnancy_id and pregnancy.owner_id = p_actor_id
    )
    or not exists (
      select 1 from public.pregnancy_members member
      where member.pregnancy_id = p_pregnancy_id
        and member.user_id = p_grantee_user_id and member.status = 'active'
    ) then raise exception 'not authorized' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_pregnancy_id::text || p_grantee_user_id::text, 0)
  );
  update public.sharing_grants
  set revoked_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where pregnancy_id = p_pregnancy_id and owner_id = p_actor_id
    and grantee_user_id = p_grantee_user_id and revoked_at is null
    and permission = any(array[
      'appointments.read', 'tasks.read', 'support_requests.read', 'journal.read'
    ]::text[])
    and not (permission = any(p_permissions));
  foreach permission_name in array p_permissions loop
    insert into public.sharing_grants (
      pregnancy_id, owner_id, grantee_user_id, permission, granted_at
    ) values (
      p_pregnancy_id, p_actor_id, p_grantee_user_id, permission_name, pg_catalog.now()
    ) on conflict (pregnancy_id, grantee_user_id, permission)
      where revoked_at is null do update set expires_at = null, updated_at = pg_catalog.now();
  end loop;
  insert into public.access_audit_events (
    actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
    request_id, ip_hash, metadata
  ) values (
    p_actor_id, p_grantee_user_id, p_pregnancy_id,
    'sharing.permissions_changed', 'sharing_grant', p_request_id, p_ip_hash,
    pg_catalog.jsonb_build_object('permission_count', pg_catalog.cardinality(p_permissions))
  );
  perform app_private.insert_sharing_notification(
    p_actor_id, p_pregnancy_id, 'sharing.permissions_changed',
    'Partner permissions changed',
    'Sensitive sharing categories changed. Preview partner access to confirm the result.'
  );
end;
$function$;

create or replace function public.set_sharing_item_override(
  p_actor_id uuid,
  p_pregnancy_id uuid,
  p_grantee_user_id uuid,
  p_permission text,
  p_resource_type text,
  p_resource_id uuid,
  p_allowed boolean,
  p_request_id uuid,
  p_ip_hash text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  resource_belongs boolean := false;
begin
  if not exists (
    select 1 from public.pregnancies pregnancy
    where pregnancy.id = p_pregnancy_id and pregnancy.owner_id = p_actor_id
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_permission = 'appointments.read' and p_resource_type = 'appointment' then
    select exists (select 1 from public.appointments row where row.id = p_resource_id and row.pregnancy_id = p_pregnancy_id and row.owner_id = p_actor_id) into resource_belongs;
  elsif p_permission = 'tasks.read' and p_resource_type = 'task' then
    select exists (select 1 from public.tasks row join public.projects project on project.id = row.project_id where row.id = p_resource_id and project.pregnancy_id = p_pregnancy_id and row.owner_id = p_actor_id) into resource_belongs;
  elsif p_permission = 'support_requests.read' and p_resource_type = 'support_request' then
    select exists (select 1 from public.support_requests row where row.id = p_resource_id and row.pregnancy_id = p_pregnancy_id and row.owner_id = p_actor_id) into resource_belongs;
  elsif p_permission = 'journal.read' and p_resource_type = 'journal_entry' then
    select exists (select 1 from public.journal_entries row where row.id = p_resource_id and row.pregnancy_id = p_pregnancy_id and row.owner_id = p_actor_id and row.privacy_level = 'shared') into resource_belongs;
  end if;
  if not resource_belongs then raise exception 'invalid sharing item' using errcode = '22023'; end if;

  insert into public.sharing_item_overrides (
    pregnancy_id, owner_id, grantee_user_id, permission,
    resource_type, resource_id, allowed
  ) values (
    p_pregnancy_id, p_actor_id, p_grantee_user_id, p_permission,
    p_resource_type, p_resource_id, p_allowed
  ) on conflict (pregnancy_id, grantee_user_id, permission, resource_type, resource_id)
  do update set allowed = excluded.allowed, updated_at = pg_catalog.now();
  insert into public.access_audit_events (
    actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
    resource_id, request_id, ip_hash,
    metadata
  ) values (
    p_actor_id, p_grantee_user_id, p_pregnancy_id,
    'sharing.item_override_changed', p_resource_type, p_resource_id,
    p_request_id, p_ip_hash, pg_catalog.jsonb_build_object('allowed', p_allowed)
  );
  perform app_private.insert_sharing_notification(
    p_actor_id, p_pregnancy_id, 'sharing.item_override_changed',
    'Partner item access changed',
    'An item-level sharing override changed. Preview partner access to confirm the result.'
  );
end;
$function$;

create or replace function public.revoke_partner_invitation(
  p_actor_id uuid,
  p_invitation_id uuid,
  p_request_id uuid,
  p_ip_hash text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  invitation public.partner_invitations%rowtype;
begin
  update public.partner_invitations
  set status = 'revoked', revoked_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_invitation_id and owner_id = p_actor_id and status = 'pending'
  returning * into invitation;
  if not found then raise exception 'invitation is invalid' using errcode = '22023'; end if;
  insert into public.access_audit_events (
    actor_user_id, subject_user_id, pregnancy_id, event_type, resource_type,
    resource_id, request_id, ip_hash
  ) values (
    p_actor_id, p_actor_id, invitation.pregnancy_id,
    'sharing.invitation_revoked', 'partner_invitation', invitation.id,
    p_request_id, p_ip_hash
  );
  perform app_private.insert_sharing_notification(
    p_actor_id, invitation.pregnancy_id, 'sharing.invitation_revoked',
    'Partner invitation revoked', 'A pending partner invitation was revoked.'
  );
end;
$function$;

create or replace function public.mark_sharing_notification_read(p_notification_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  update public.user_notifications
  set read_at = coalesce(read_at, pg_catalog.now()), updated_at = pg_catalog.now()
  where id = p_notification_id and owner_id = auth.uid();
$function$;

create or replace function public.get_sharing_access_history(p_pregnancy_id uuid)
returns table (
  id uuid,
  event_type text,
  resource_type text,
  resource_id uuid,
  actor_user_id uuid,
  subject_user_id uuid,
  occurred_at timestamptz
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select event.id, event.event_type, event.resource_type, event.resource_id,
    event.actor_user_id, event.subject_user_id, event.occurred_at
  from public.access_audit_events event
  where event.pregnancy_id = p_pregnancy_id
    and event.event_type like 'sharing.%'
    and exists (
      select 1 from public.pregnancies pregnancy
      where pregnancy.id = p_pregnancy_id and pregnancy.owner_id = auth.uid()
    )
  order by event.occurred_at desc
  limit 200;
$function$;

drop function if exists public.accept_partner_invitation(text);
revoke all on function app_private.valid_together_permissions(text[]) from public, anon, authenticated;
revoke all on function app_private.has_item_permission(uuid,text,text,uuid) from public, anon;
revoke all on function app_private.can_read_task(uuid) from public, anon;
revoke all on function app_private.can_read_support_request(uuid) from public, anon;
revoke all on function app_private.insert_sharing_notification(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function app_private.has_item_permission(uuid,text,text,uuid) to authenticated, service_role;
grant execute on function app_private.can_read_task(uuid) to authenticated, service_role;
grant execute on function app_private.can_read_support_request(uuid) to authenticated, service_role;

revoke all on function public.create_partner_invitation(uuid,uuid,text,text,text,text[],timestamptz,text,text,uuid) from public, anon, authenticated;
revoke all on function public.cancel_partner_invitation_delivery(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.accept_partner_invitation(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.decline_partner_invitation(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.revoke_partner_access(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.set_partner_permissions(uuid,uuid,uuid,text[],uuid,text) from public, anon, authenticated;
revoke all on function public.set_sharing_item_override(uuid,uuid,uuid,text,text,uuid,boolean,uuid,text) from public, anon, authenticated;
revoke all on function public.revoke_partner_invitation(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.create_partner_invitation(uuid,uuid,text,text,text,text[],timestamptz,text,text,uuid) to service_role;
grant execute on function public.cancel_partner_invitation_delivery(uuid,uuid,uuid) to service_role;
grant execute on function public.accept_partner_invitation(uuid,text,uuid,text) to service_role;
grant execute on function public.decline_partner_invitation(uuid,text,uuid,text) to service_role;
grant execute on function public.revoke_partner_access(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.set_partner_permissions(uuid,uuid,uuid,text[],uuid,text) to service_role;
grant execute on function public.set_sharing_item_override(uuid,uuid,uuid,text,text,uuid,boolean,uuid,text) to service_role;
grant execute on function public.revoke_partner_invitation(uuid,uuid,uuid,text) to service_role;

revoke insert, update, delete on public.sharing_grants from authenticated;
grant select (permissions) on public.partner_invitations to authenticated;
revoke all on function public.mark_sharing_notification_read(uuid) from public, anon;
revoke all on function public.get_sharing_access_history(uuid) from public, anon;
grant execute on function public.mark_sharing_notification_read(uuid) to authenticated;
grant execute on function public.get_sharing_access_history(uuid) to authenticated;

commit;
