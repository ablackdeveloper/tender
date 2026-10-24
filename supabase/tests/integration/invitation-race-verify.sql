\set ON_ERROR_STOP on

do $verification$
begin
  if not exists (
    select 1
    from public.partner_invitations
    where id = 'f3000000-0000-4000-8000-000000000001'
      and status = 'accepted'
      and accepted_by_user_id = 'f1000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'the invitation was not accepted exactly once';
  end if;

  if (
    select count(*)
    from public.pregnancy_members
    where pregnancy_id = 'f2000000-0000-4000-8000-000000000001'
      and user_id = 'f1000000-0000-4000-8000-000000000002'
      and status = 'active'
  ) <> 1 then
    raise exception 'the invitation race created an invalid partner membership count';
  end if;

  if (
    select count(*)
    from public.sharing_grants
    where pregnancy_id = 'f2000000-0000-4000-8000-000000000001'
      and grantee_user_id = 'f1000000-0000-4000-8000-000000000002'
      and permission in ('journal.read', 'pregnancy.read')
      and revoked_at is null
  ) <> 2 then
    raise exception 'the invitation race created an invalid active grant count';
  end if;

  if (
    select count(*)
    from public.access_audit_events
    where resource_id = 'f3000000-0000-4000-8000-000000000001'
      and event_type = 'sharing.invitation_accepted'
  ) <> 1 then
    raise exception 'the invitation race created an invalid audit-event count';
  end if;

  if not exists (
    select 1
    from public.media_assets
    where id = 'f5000000-0000-4000-8000-000000000001'
      and owner_id = 'f1000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'the synthetic media metadata was not created';
  end if;

  delete from auth.users
  where id = 'f1000000-0000-4000-8000-000000000001';

  if exists (
    select 1
    from public.pregnancies
    where id = 'f2000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.partner_invitations
    where id = 'f3000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.journal_entries
    where id = 'f4000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.media_assets
    where id = 'f5000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'owner deletion did not cascade through private records';
  end if;

  if not exists (
    select 1
    from public.access_audit_events
    where resource_id = 'f3000000-0000-4000-8000-000000000001'
      and actor_user_id = 'f1000000-0000-4000-8000-000000000002'
      and subject_user_id is null
      and pregnancy_id is null
  ) then
    raise exception 'the retained audit event did not remove deleted-owner references';
  end if;

  delete from auth.users
  where id = 'f1000000-0000-4000-8000-000000000002';

  if exists (
    select 1
    from public.pregnancy_members
    where pregnancy_id = 'f2000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.sharing_grants
    where pregnancy_id = 'f2000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.user_notifications
    where pregnancy_id = 'f2000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'owner deletion left pregnancy-scoped sharing records';
  end if;
end;
$verification$;
