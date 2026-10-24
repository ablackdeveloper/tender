begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(15);

create temporary table meal_results (name text primary key, value bigint) on commit drop;
grant select, insert on meal_results to anon, authenticated, service_role;
create temporary table meal_text_results (name text primary key, value text) on commit drop;
grant select, insert on meal_text_results to authenticated, service_role;

set local role service_role;
insert into public.sharing_grants (
  id, pregnancy_id, owner_id, grantee_user_id, permission, granted_at
) values (
  'e1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'tracking.read', pg_catalog.now()
);
insert into public.meals (
  id, pregnancy_id, owner_id, occurred_at, meal_type, notes
) values (
  'e2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  '2026-08-22T12:00:00Z', 'snack', 'SYNTHETIC TEST FIXTURE'
);
insert into public.media_assets (
  id, pregnancy_id, owner_id, meal_id, storage_bucket, storage_path,
  mime_type, byte_size, media_kind, upload_status
) values (
  'e3000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001', 'tender-media',
  'e3000000-0000-4000-8000-000000000001/e4000000-0000-4000-8000-000000000001.jpg',
  'image/jpeg', 100, 'image', 'ready'
);
insert into storage.objects (bucket_id, name) values (
  'tender-media',
  'e3000000-0000-4000-8000-000000000001/e4000000-0000-4000-8000-000000000001.jpg'
);
insert into meal_results values
  ('service_meal', (select count(*) from public.meals where id = 'e2000000-0000-4000-8000-000000000001')),
  ('service_media', (select count(*) from public.media_assets where id = 'e3000000-0000-4000-8000-000000000001')),
  ('service_storage', (select count(*) from storage.objects where bucket_id = 'tender-media' and name like 'e3000000%'));
reset role;

set local role anon;
do $probe$
declare
  meal_count bigint := 0;
  storage_count bigint := 0;
begin
  begin
    select count(*) into meal_count
    from public.meals
    where id = 'e2000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    meal_count := 0;
  end;

  begin
    select count(*) into storage_count
    from storage.objects
    where bucket_id = 'tender-media' and name like 'e3000000%';
  exception when insufficient_privilege then
    storage_count := 0;
  end;

  insert into meal_results values
    ('anonymous_meal', meal_count),
    ('anonymous_storage', storage_count);
end;
$probe$;
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
insert into meal_results values
  ('owner_meal', (select count(*) from public.meals where id = 'e2000000-0000-4000-8000-000000000001')),
  ('owner_media', (select count(*) from public.media_assets where id = 'e3000000-0000-4000-8000-000000000001'));
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into meal_results values
  ('partner_meal', (select count(*) from public.meals where id = 'e2000000-0000-4000-8000-000000000001')),
  ('partner_media', (select count(*) from public.media_assets where id = 'e3000000-0000-4000-8000-000000000001')),
  ('partner_storage', (select count(*) from storage.objects where bucket_id = 'tender-media' and name like 'e3000000%'));
with changed as (
  update public.meals set notes = 'BLOCKED'
  where id = 'e2000000-0000-4000-8000-000000000001'
  returning 1
)
insert into meal_results
select 'partner_update', count(*) from changed;
with removed as (
  delete from public.meals
  where id = 'e2000000-0000-4000-8000-000000000001'
  returning 1
)
insert into meal_results
select 'partner_delete', count(*) from removed;
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000003', true);
insert into meal_results values ('attacker_meal', (select count(*) from public.meals where id = 'e2000000-0000-4000-8000-000000000001'));
reset role;

set local role service_role;
update public.sharing_grants set revoked_at = pg_catalog.now() where id = 'e1000000-0000-4000-8000-000000000001';
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into meal_results values ('revoked_storage', (select count(*) from storage.objects where bucket_id = 'tender-media' and name like 'e3000000%'));
reset role;

select extensions.is(value, 1::bigint, name) from meal_results where name in ('service_meal', 'service_media', 'service_storage', 'owner_meal', 'owner_media', 'partner_meal', 'partner_media', 'partner_storage');
select extensions.is(value, 0::bigint, name) from meal_results where name in ('anonymous_meal', 'anonymous_storage', 'partner_update', 'partner_delete', 'attacker_meal', 'revoked_storage');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
insert into meal_text_results values (
  'optional_save',
  public.save_meal_log(
    'e5000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000001'
  )->>'status'
);
reset role;

select extensions.is(
  (select value from meal_text_results where name = 'optional_save'),
  'saved',
  'an all-optional meal log saves without user-entered values'
);

select * from extensions.finish();
rollback;
