begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
create temporary table journal_save_results (name text, value text) on commit drop;
grant insert, select on journal_save_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
insert into journal_save_results values ('v1_create', public.save_journal_entry(
  'e1800000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
  '   ', 'Synthetic legacy memory', now(), false, 'private', array[]::uuid[], null)->>'status');
insert into journal_save_results select 'v1_blank', (title is null)::text from public.journal_entries where id='e1800000-0000-4000-8000-000000000001';
insert into journal_save_results select 'v1_update', public.save_journal_entry(
  id, pregnancy_id, '  Legacy title  ', 'Updated legacy memory', entry_at, false, 'private', array[]::uuid[], updated_at)->>'status'
  from public.journal_entries where id='e1800000-0000-4000-8000-000000000001';
insert into journal_save_results values ('v2_create', public.save_journal_entry_v2(
  'e1800000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
  '  New title  ', 'Synthetic new memory', now(), false, 'private', true, array[]::uuid[], null)->>'status');
insert into journal_save_results select 'v2_trim', title from public.journal_entries where id='e1800000-0000-4000-8000-000000000002';
insert into journal_save_results select 'v2_update', public.save_journal_entry_v2(
  id, pregnancy_id, '', 'Updated new memory', entry_at, true, 'private', false, array[]::uuid[], updated_at)->>'status'
  from public.journal_entries where id='e1800000-0000-4000-8000-000000000002';
insert into journal_save_results select 'v2_conflict', public.save_journal_entry_v2(
  id, pregnancy_id, 'Stale title', 'Stale body', entry_at, false, 'private', true, array[]::uuid[], '2000-01-01'::timestamptz)->>'status'
  from public.journal_entries where id='e1800000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into journal_save_results select 'other_read', count(*)::text from public.journal_entries
  where id in ('e1800000-0000-4000-8000-000000000001','e1800000-0000-4000-8000-000000000002');
update public.journal_entries set body='Unauthorized change' where id='e1800000-0000-4000-8000-000000000001';
reset role;
select extensions.is((select value from journal_save_results where name='v1_create'), 'saved', 'legacy memory insert executes');
select extensions.is((select value from journal_save_results where name='v1_blank'), 'true', 'legacy blank title becomes null');
select extensions.is((select value from journal_save_results where name='v1_update'), 'saved', 'legacy memory update executes');
select extensions.is((select title from public.journal_entries where id='e1800000-0000-4000-8000-000000000001'), 'Legacy title', 'legacy update trims title');
select extensions.is((select value from journal_save_results where name='v2_create'), 'saved', 'V2 memory insert executes');
select extensions.is((select value from journal_save_results where name='v2_trim'), 'New title', 'V2 insert trims title');
select extensions.is((select value from journal_save_results where name='v2_update'), 'saved', 'V2 memory update executes');
select extensions.ok((select title is null and is_pinned and not resurface_allowed and resurface_reviewed_at is null from public.journal_entries where id='e1800000-0000-4000-8000-000000000002'), 'blank update preserves explicit favorite and resurfacing choices');
select extensions.is((select value from journal_save_results where name='v2_conflict'), 'conflict', 'stale save is rejected');
select extensions.is((select body from public.journal_entries where id='e1800000-0000-4000-8000-000000000002'), 'Updated new memory', 'stale save does not overwrite body');
select extensions.is((select value from journal_save_results where name='other_read'), '0', 'another account cannot read new private memories');
select extensions.is((select body from public.journal_entries where id='e1800000-0000-4000-8000-000000000001'), 'Updated legacy memory', 'another account cannot update new private memories');
select * from extensions.finish();
rollback;
