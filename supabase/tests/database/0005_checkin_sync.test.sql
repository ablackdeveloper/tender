begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);

insert into public.emotions (id, slug, display_name)
values ('d1000000-0000-4000-8000-000000000001', 'sync-test-emotion', 'Sync test emotion');
insert into public.symptoms (id, slug, display_name)
values ('d2000000-0000-4000-8000-000000000001', 'sync-test-flag', 'Sync test flag');

create temporary table checkin_sync_results (
  name text primary key,
  result jsonb not null
) on commit drop;
grant select, insert on checkin_sync_results to authenticated;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-4000-8000-000000000001',
  true
);

insert into checkin_sync_results (name, result)
values (
  'partial',
  public.sync_daily_checkin(
    'b1000000-0000-4000-8000-000000000001',
    '2040-01-01',
    null,
    'd3000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'overallFeeling', 'mixed',
      'emotionSlugs', jsonb_build_array('sync-test-emotion'),
      'symptoms', jsonb_build_array(jsonb_build_object(
        'slug', 'sync-test-flag',
        'severity', 2,
        'duration_code', 'few_days',
        'interference_level', 2
      )),
      'wellness', jsonb_build_array(jsonb_build_object(
        'observation_type', 'sleep',
        'text_value', 'okay'
      )),
      'note', 'Deterministic partial check-in fixture.'
    ),
    false
  )
);

insert into checkin_sync_results (name, result)
values (
  'replay',
  public.sync_daily_checkin(
    'b1000000-0000-4000-8000-000000000001',
    '2040-01-01',
    null,
    'd3000000-0000-4000-8000-000000000001',
    '{}'::jsonb,
    false
  )
);

insert into checkin_sync_results (name, result)
values (
  'conflict',
  public.sync_daily_checkin(
    'b1000000-0000-4000-8000-000000000001',
    '2040-01-01',
    null,
    'd3000000-0000-4000-8000-000000000002',
    '{}'::jsonb,
    false
  )
);

insert into checkin_sync_results (name, result)
values (
  'complete',
  public.sync_daily_checkin(
    'b1000000-0000-4000-8000-000000000001',
    '2040-01-01',
    ((select result from checkin_sync_results where name = 'partial') ->> 'updated_at')::timestamptz,
    'd3000000-0000-4000-8000-000000000003',
    jsonb_build_object(
      'overallFeeling', 'mixed',
      'emotionSlugs', jsonb_build_array('sync-test-emotion'),
      'symptoms', '[]'::jsonb,
      'wellness', '[]'::jsonb,
      'note', 'Completed fixture.'
    ),
    true
  )
);

insert into checkin_sync_results (name, result)
values (
  'complete_replay',
  public.sync_daily_checkin(
    'b1000000-0000-4000-8000-000000000001',
    '2040-01-01',
    null,
    'd3000000-0000-4000-8000-000000000003',
    '{}'::jsonb,
    true
  )
);

reset role;

select extensions.is(
  (select result ->> 'status' from checkin_sync_results where name = 'partial'),
  'applied',
  'partial check-in is applied'
);
select extensions.is(
  (select result ->> 'completed_at' from checkin_sync_results where name = 'partial'),
  null::text,
  'partial check-in has no completion timestamp'
);
select extensions.is(
  (select result from checkin_sync_results where name = 'replay'),
  (select result from checkin_sync_results where name = 'partial'),
  'same mutation id replays idempotently'
);
select extensions.is(
  (select count(*) from public.daily_checkins where checkin_date = '2040-01-01'),
  1::bigint,
  'idempotent replay creates one daily row'
);
select extensions.is(
  (select result ->> 'status' from checkin_sync_results where name = 'conflict'),
  'conflict',
  'stale base returns an explicit conflict'
);
select extensions.is(
  (select count(*) from public.checkin_emotions emotion_link
   join public.daily_checkins checkin on checkin.id = emotion_link.checkin_id
   where checkin.checkin_date = '2040-01-01'),
  1::bigint,
  'mixed/partial child selection sync is normalized'
);
select extensions.is(
  (select result ->> 'status' from checkin_sync_results where name = 'complete'),
  'applied',
  'completion sync is applied'
);
select extensions.ok(
  (select result ->> 'completed_at' from checkin_sync_results where name = 'complete') is not null,
  'completion receives an explicit server timestamp'
);
select extensions.is(
  (select result ->> 'completed_at' from checkin_sync_results where name = 'complete_replay'),
  (select result ->> 'completed_at' from checkin_sync_results where name = 'complete'),
  'completion replay preserves the original timestamp'
);
select extensions.is(
  (select count(*) from public.checkin_symptoms symptom_link
   join public.daily_checkins checkin on checkin.id = symptom_link.checkin_id
   where checkin.checkin_date = '2040-01-01'),
  0::bigint,
  'later complete payload atomically replaces removed symptoms'
);
select extensions.ok(
  (select completed_at is not null from public.daily_checkins where checkin_date = '2040-01-01'),
  'completed_at is durable on the daily row'
);
select extensions.ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_checkins'
      and column_name in ('score', 'streak')
  ),
  'check-ins store no score or streak'
);

select * from extensions.finish();
rollback;
