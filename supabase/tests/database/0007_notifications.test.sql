begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_table('public', 'notification_jobs', 'notification jobs exist');
select extensions.has_table('public', 'notification_delivery_attempts', 'delivery audit exists');
select extensions.ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.notification_jobs'::regclass), 'notification jobs enforce RLS');
select extensions.ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.notification_delivery_attempts'::regclass), 'delivery audit enforces RLS');
select extensions.ok(not has_table_privilege('authenticated', 'public.notification_devices', 'select'), 'clients cannot read encrypted device tokens');
select extensions.ok(not has_table_privilege('authenticated', 'public.notification_jobs', 'select'), 'clients cannot enumerate notification jobs');
select extensions.ok(not has_table_privilege('authenticated', 'public.notification_delivery_attempts', 'select'), 'clients cannot read delivery audit');
select extensions.is(app_private.apply_notification_quiet_hours('2026-03-08 06:30:00+00'::timestamptz, 'America/New_York', '22:00'::time, '08:00'::time), '2026-03-08 12:00:00+00'::timestamptz, 'quiet hours resume at 08:00 local across spring DST');
select extensions.is(app_private.apply_notification_quiet_hours('2026-11-01 05:30:00+00'::timestamptz, 'America/New_York', '22:00'::time, '08:00'::time), '2026-11-01 13:00:00+00'::timestamptz, 'quiet hours resume at 08:00 local across fall DST');
select extensions.ok(not has_function_privilege('anon', 'public.resolve_notification_destination(uuid)', 'execute'), 'anonymous users cannot resolve notification destinations');
select extensions.ok(has_function_privilege('authenticated', 'public.resolve_notification_destination(uuid)', 'execute'), 'authenticated users may request a fresh destination authorization check');
select extensions.ok(has_function_privilege('authenticated', 'public.respond_to_support_request(uuid,text)', 'execute'), 'authenticated recipients may request a constrained support transition');
select extensions.ok(not has_function_privilege('authenticated', 'public.claim_notification_jobs(integer)', 'execute'), 'clients cannot claim notification jobs');
select extensions.ok(has_function_privilege('service_role', 'public.claim_notification_jobs(integer)', 'execute'), 'service role can atomically claim due jobs');

select * from extensions.finish();
rollback;
