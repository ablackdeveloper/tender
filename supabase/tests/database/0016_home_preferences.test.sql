begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
create temporary table home_results (name text, value text) on commit drop;
grant select, insert on home_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
insert into public.user_preferences (owner_id, home_focus, show_weekly_content, show_due_date, show_progress_counts, show_size_comparisons)
values ('b0000000-0000-4000-8000-000000000001', 'memories', true, false, true, false)
on conflict (owner_id) do update set home_focus='memories', show_weekly_content=true, show_due_date=false, show_progress_counts=true, show_size_comparisons=false;
insert into home_results select 'owner_choices', (home_focus='memories' and show_weekly_content and not show_due_date and show_progress_counts and not show_size_comparisons)::text
from public.user_preferences where owner_id=auth.uid();
-- Setup retry must preserve independent display choices.
select public.complete_onboarding('e1700000-0000-4000-8000-000000000016', null, null, null, null, 'UTC', 'unspecified', '', 'system', 'metric', false, false, false);
insert into home_results select 'setup_preserves', (home_focus='memories' and not show_due_date)::text from public.user_preferences where owner_id=auth.uid();
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into home_results select 'other_read', count(*)::text from public.user_preferences where owner_id='b0000000-0000-4000-8000-000000000001';
update public.user_preferences set home_focus='support' where owner_id='b0000000-0000-4000-8000-000000000001';
reset role;
select extensions.is((select value from home_results where name='owner_choices'), 'true', 'owner saves independent choices');
select extensions.is((select value from home_results where name='setup_preserves'), 'true', 'onboarding preserves focus and visibility');
select extensions.is((select value from home_results where name='other_read'), '0', 'another account cannot read choices');
select extensions.is((select home_focus from public.user_preferences where owner_id='b0000000-0000-4000-8000-000000000001'), 'memories', 'another account cannot change choices');
select extensions.throws_ok($$update public.user_preferences set home_focus='invalid' where owner_id='b0000000-0000-4000-8000-000000000001'$$, '23514', null, 'unknown focus rejected');
select * from extensions.finish();
rollback;
