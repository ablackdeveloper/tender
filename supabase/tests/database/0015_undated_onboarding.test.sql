begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
create temporary table undated_results (name text, value text) on commit drop;
grant select, insert on undated_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
insert into undated_results values ('completed', public.complete_onboarding(
 'e1700000-0000-4000-8000-000000000001', null, null, null, null,
 'America/New_York', 'unspecified', '', 'system', 'metric', false, false, false)::text);
insert into undated_results select 'no_date', (estimated_due_date is null and due_date_source = 'unknown')::text
 from public.pregnancies where id='e1700000-0000-4000-8000-000000000001';
insert into public.journal_entries (id, pregnancy_id, owner_id, title, body)
 values ('e1700000-0000-4000-8000-000000000002', 'e1700000-0000-4000-8000-000000000001',
 'b0000000-0000-4000-8000-000000000001', 'Undated sample', 'A private memory without a date');
update public.pregnancies set estimated_due_date='2040-10-18', due_date_source='manual'
 where id='e1700000-0000-4000-8000-000000000001';
insert into undated_results values ('retried', public.complete_onboarding(
 'e1700000-0000-4000-8000-000000000001', null, '2040-10-18', 'manual', null,
 'America/New_York', 'unspecified', '', 'system', 'metric', false, false, false)::text);
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into undated_results select 'other_user_memories', count(*)::text from public.journal_entries
 where id='e1700000-0000-4000-8000-000000000002';
update public.pregnancies set estimated_due_date='2041-01-01' where id='e1700000-0000-4000-8000-000000000001';
reset role;
select extensions.is((select value from undated_results where name='completed'), 'e1700000-0000-4000-8000-000000000001', 'setup creates an undated record');
select extensions.is((select value from undated_results where name='no_date'), 'true', 'no invented date is stored');
select extensions.is((select count(*) from public.journal_entries where id='e1700000-0000-4000-8000-000000000002'), 1::bigint, 'undated memory remains after date update');
select extensions.is((select estimated_due_date from public.pregnancies where id='e1700000-0000-4000-8000-000000000001'), '2040-10-18'::date, 'owner can add date; another user cannot change it');
select extensions.is((select value from undated_results where name='retried'), 'e1700000-0000-4000-8000-000000000001', 'retry returns the same record');
select extensions.is((select count(*) from public.pregnancies where id='e1700000-0000-4000-8000-000000000001'), 1::bigint, 'retry creates no duplicate');
select extensions.is((select value from undated_results where name='other_user_memories'), '0', 'another user cannot read the memory');
delete from public.notification_preferences where owner_id='b0000000-0000-4000-8000-000000000002';
insert into public.notification_preferences (owner_id) values ('b0000000-0000-4000-8000-000000000002');
select extensions.ok((select not appointment_reminders_enabled and not planning_reminders_enabled
 and not editorial_updates_enabled and not weekly_update_enabled and not partner_request_enabled
 and not photo_enabled and not medication_as_recorded_enabled
 from public.notification_preferences where owner_id='b0000000-0000-4000-8000-000000000002'), 'new notification categories start off');
select * from extensions.finish();
rollback;
