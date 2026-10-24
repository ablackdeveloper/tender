begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table lifecycle_results (name text primary key, count_value bigint) on commit drop;
grant select, insert on lifecycle_results to authenticated;

select extensions.has_table('public', 'support_resources', 'configurable support resources exist');
select extensions.ok(
  not has_function_privilege('anon', 'public.transition_pregnancy_status(uuid,text,boolean,boolean)', 'execute'),
  'anonymous callers cannot change pregnancy lifecycle'
);

set local role service_role;
insert into public.notification_jobs (
  id, owner_id, pregnancy_id, category, destination_type, scheduled_for,
  next_attempt_at, timezone, dedupe_key
) values
  ('c9000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'weekly_update', 'journey', now() + interval '1 day', now() + interval '1 day', 'America/New_York', repeat('a', 64)),
  ('c9000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'photo', 'journal', now() + interval '1 day', now() + interval '1 day', 'America/New_York', repeat('b', 64)),
  ('c9000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'appointment', 'care', now() + interval '1 day', now() + interval '1 day', 'America/New_York', repeat('c', 64));
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select public.transition_pregnancy_status(
  'b1000000-0000-4000-8000-000000000001', 'paused', true, false
);
reset role;

select extensions.is(
  (select lifecycle_status from public.pregnancy_experience_settings where pregnancy_id = 'b1000000-0000-4000-8000-000000000001'),
  'paused',
  'status and compassionate suppression commit together'
);
select extensions.is(
  (select count(*) from public.notification_jobs where id in ('c9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000002') and status = 'cancelled'),
  2::bigint,
  'already queued weekly and photo notifications are cancelled'
);
select extensions.is(
  (select status from public.notification_jobs where id = 'c9000000-0000-4000-8000-000000000003'),
  'pending',
  'neutral appointment notification remains queued'
);
select extensions.ok(
  exists(select 1 from public.journal_entries where pregnancy_id = 'b1000000-0000-4000-8000-000000000001'),
  'lifecycle transition preserves authored records'
);
select extensions.ok(
  not exists(select 1 from public.user_notifications where event_type = 'pregnancy.lifecycle_changed'),
  'lifecycle changes do not create partner notifications'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select public.transition_pregnancy_status('b1000000-0000-4000-8000-000000000001', 'active', false, false);
select public.transition_pregnancy_status('b1000000-0000-4000-8000-000000000001', 'birth', false, true);
reset role;
select extensions.ok(
  (select lifecycle_status = 'birth' and postpartum_mode_enabled and birth_at is not null from public.pregnancy_experience_settings where pregnancy_id = 'b1000000-0000-4000-8000-000000000001'),
  'birth adds maternal postpartum mode without replacing the pregnancy'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select public.transition_pregnancy_status('b1000000-0000-4000-8000-000000000001', 'active', false, false);
select public.transition_pregnancy_status('b1000000-0000-4000-8000-000000000001', 'archived', false, false);
select public.transition_pregnancy_status('b1000000-0000-4000-8000-000000000001', 'active', false, false);
reset role;
select extensions.is(
  (select lifecycle_status from public.pregnancy_experience_settings where pregnancy_id = 'b1000000-0000-4000-8000-000000000001'),
  'active',
  'archive restores only its previous status'
);
select extensions.ok(
  exists(
    select 1 from public.access_audit_events
    where pregnancy_id = 'b1000000-0000-4000-8000-000000000001'
      and event_type = 'pregnancy.lifecycle_changed'
      and metadata @> '{"sharing_permissions_changed": false}'::jsonb
  ),
  'transition audit states that sharing permissions were unchanged'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into lifecycle_results values (
  'partner_visibility',
  (select count(*) from public.pregnancy_experience_settings)
);
reset role;
select extensions.is(
  (select count_value from lifecycle_results where name = 'partner_visibility'),
  0::bigint,
  'a partner with pregnancy.read cannot infer owner lifecycle settings'
);

select * from extensions.finish();
rollback;
