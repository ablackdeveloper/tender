begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(11);

select extensions.is(
  (select public from storage.buckets where id = 'tender-media'),
  false,
  'journal media bucket is private'
);
select extensions.is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'media_assets'
     and column_name in ('signed_url', 'signed_url_expires_at')),
  0::bigint,
  'signed URLs are never stored in media metadata'
);
select extensions.is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_orphaned_media_objects(timestamptz,integer)',
    'execute'
  ),
  false,
  'orphan cleanup RPC is inaccessible to clients'
);

create temporary table journal_privacy_results (
  name text primary key,
  value bigint
) on commit drop;
grant select, insert on journal_privacy_results to authenticated, service_role;

set local role service_role;
update public.media_assets
set upload_status = 'ready', upload_error_code = null
where id in (
  'b2300000-0000-4000-8000-000000000001',
  'b2300000-0000-4000-8000-000000000002'
);
insert into storage.objects (bucket_id, name)
values
  ('tender-media', 'b2300000-0000-4000-8000-000000000001/b3300000-0000-4000-8000-000000000001.jpg'),
  ('tender-media', 'b2300000-0000-4000-8000-000000000002/b3300000-0000-4000-8000-000000000002.jpg');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
insert into journal_privacy_results values
  ('owner_entries', (select count(*) from public.journal_entries where id in ('b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002'))),
  ('owner_media', (select count(*) from public.media_assets where id in ('b2300000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000002')));
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into journal_privacy_results values
  ('partner_shared_entry', (select count(*) from public.journal_entries where id = 'b2000000-0000-4000-8000-000000000002')),
  ('partner_private_entry', (select count(*) from public.journal_entries where id = 'b2000000-0000-4000-8000-000000000001')),
  ('partner_media', (select count(*) from public.media_assets where id in ('b2300000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000002'))),
  ('partner_storage', (select count(*) from storage.objects where bucket_id = 'tender-media'));
reset role;

set local role service_role;
update public.sharing_grants
set revoked_at = pg_catalog.now()
where pregnancy_id = 'b1000000-0000-4000-8000-000000000002'
  and grantee_user_id = 'b0000000-0000-4000-8000-000000000002'
  and permission = 'journal.read';
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into journal_privacy_results values
  ('revoked_entries', (select count(*) from public.journal_entries where id = 'b2000000-0000-4000-8000-000000000002')),
  ('revoked_storage', (select count(*) from storage.objects where bucket_id = 'tender-media'));
reset role;

select extensions.is(value, 2::bigint, name)
from journal_privacy_results where name in ('owner_entries', 'owner_media');
select extensions.is(value, 1::bigint, name)
from journal_privacy_results where name in ('partner_shared_entry', 'partner_media', 'partner_storage');
select extensions.is(value, 0::bigint, name)
from journal_privacy_results where name in ('partner_private_entry', 'revoked_entries', 'revoked_storage');

select * from extensions.finish();
rollback;
