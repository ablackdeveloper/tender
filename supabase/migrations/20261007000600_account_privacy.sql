begin;

create or replace function public.build_account_export(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  allowed_tables constant text[] := array[
    'appointment_notes',
    'appointment_questions',
    'appointments',
    'checkin_emotions',
    'checkin_symptoms',
    'consent_records',
    'daily_checkins',
    'documents',
    'emergency_contacts',
    'health_connections',
    'health_daily_summaries',
    'health_metric_permissions',
    'home_module_preferences',
    'journal_entries',
    'journal_entry_tags',
    'meal_items',
    'meals',
    'media_assets',
    'medication_change_records',
    'medication_schedules',
    'medications',
    'memory_capsule_items',
    'memory_capsules',
    'notification_jobs',
    'notification_preferences',
    'partner_invitations',
    'photo_series',
    'pregnancies',
    'pregnancy_experience_settings',
    'pregnancy_members',
    'projects',
    'providers',
    'sharing_grants',
    'sharing_item_overrides',
    'support_requests',
    'tags',
    'tasks',
    'user_notifications',
    'user_preferences',
    'wellness_observations'
  ];
  account_profile jsonb;
  exported_records jsonb := '{}'::jsonb;
  record_payload jsonb;
  table_name text;
begin
  if p_actor_id is null or not exists (
    select 1 from auth.users account where account.id = p_actor_id
  ) then
    raise exception 'Account not found' using errcode = '22023';
  end if;

  select to_jsonb(profile)
  into account_profile
  from (
    select
      id,
      display_name,
      avatar_path,
      locale,
      timezone,
      onboarding_completed_at,
      last_seen_at,
      created_at,
      updated_at
    from public.profiles
    where id = p_actor_id
  ) profile;

  foreach table_name in array allowed_tables loop
    execute pg_catalog.format(
      'select coalesce(jsonb_agg(to_jsonb(record) - array[''token_hash'', ''ip_hash'', ''user_agent_hash'', ''search_vector'']::text[]), ''[]''::jsonb) from public.%I record where record.owner_id = $1',
      table_name
    )
    into record_payload
    using p_actor_id;
    exported_records := exported_records || pg_catalog.jsonb_build_object(
      table_name,
      record_payload
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'format_version', 1,
    'generated_at', pg_catalog.now(),
    'profile', account_profile,
    'records', exported_records,
    'shared_access', pg_catalog.jsonb_build_object(
      'memberships', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', member.id,
              'pregnancy_id', member.pregnancy_id,
              'membership_role', member.membership_role,
              'status', member.status,
              'joined_at', member.joined_at,
              'left_at', member.left_at
            )
          ),
          '[]'::jsonb
        )
        from public.pregnancy_members member
        where member.user_id = p_actor_id
          and member.owner_id <> p_actor_id
      ),
      'grants', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', sharing.id,
              'pregnancy_id', sharing.pregnancy_id,
              'permission', sharing.permission,
              'granted_at', sharing.granted_at,
              'expires_at', sharing.expires_at,
              'revoked_at', sharing.revoked_at
            )
          ),
          '[]'::jsonb
        )
        from public.sharing_grants sharing
        where sharing.grantee_user_id = p_actor_id
      )
    )
  );
end;
$function$;

revoke all on function public.build_account_export(uuid)
  from public, anon, authenticated;
grant execute on function public.build_account_export(uuid)
  to service_role;

commit;
