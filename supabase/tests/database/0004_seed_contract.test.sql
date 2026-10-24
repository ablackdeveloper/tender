begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(20);

create temporary table seed_rls_results (
  persona text primary key,
  pregnancies bigint,
  journals bigint,
  appointments bigint,
  checkins bigint,
  meals bigint,
  tasks bigint,
  media bigint
) on commit drop;
grant select, insert on seed_rls_results to authenticated;

select extensions.is(
  (select count(*) from auth.users where id::text like 'b0000000-%'),
  3::bigint,
  'exactly three synthetic seed personas exist'
);
select extensions.is(
  (
    select count(*) from auth.users
    where id::text like 'b0000000-%'
      and encrypted_password = ''
      and email like '%@tender.invalid'
  ),
  3::bigint,
  'seed personas use reserved addresses and no login password'
);
select extensions.is(
  (
    select count(*) from public.pregnancies
    where owner_id = 'b0000000-0000-4000-8000-000000000001'
  ),
  6::bigint,
  'primary persona owns six representative pregnancy fixtures'
);
select extensions.is(
  (
    select count(*) from public.pregnancies
    where id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002',
      'b1000000-0000-4000-8000-000000000003',
      'b1000000-0000-4000-8000-000000000004',
      'b1000000-0000-4000-8000-000000000005'
    )
      and ended_at is null
  ),
  5::bigint,
  'five active fixtures cover gestational display boundaries'
);
select extensions.is(
  (
    select count(*) from public.pregnancies
    where id = 'b1000000-0000-4000-8000-000000000006'
      and ended_at = '2026-05-24T16:00:00Z'
  ),
  1::bigint,
  'one ended pregnancy drives the compassionate-state fixture'
);
select extensions.is(
  (
    select array_agg(permission order by permission)
    from public.sharing_grants
    where grantee_user_id = 'b0000000-0000-4000-8000-000000000002'
      and revoked_at is null
      and expires_at is null
  ),
  array['journal.read', 'pregnancy.read']::text[],
  'limited partner receives only pregnancy and journal read capabilities'
);
select extensions.is(
  (
    select array_agg(status order by status)
    from public.partner_invitations
    where id::text like 'b1200000-%'
      and token_hash ~ '^[0-9a-f]{64}$'
  ),
  array['expired', 'revoked']::text[],
  'historical invitations are expired/revoked and digest-only'
);
select extensions.is(
  (select count(*) from public.journal_entries where id::text like 'b2000000-%'),
  3::bigint,
  'private, shared, and compassionate journal fixtures exist'
);
select extensions.ok(
  exists (
    select 1
    from public.journal_entries entry
    join public.sharing_grants grant_row
      on grant_row.pregnancy_id = entry.pregnancy_id
    where entry.id = 'b2000000-0000-4000-8000-000000000002'
      and grant_row.grantee_user_id = 'b0000000-0000-4000-8000-000000000002'
      and grant_row.permission = 'journal.read'
      and grant_row.revoked_at is null
      and grant_row.expires_at is null
  ),
  'shared journal entry belongs to the explicitly granted pregnancy'
);
select extensions.is(
  (
    select count(*) from public.media_assets asset
    where asset.id::text like 'b2300000-%'
      and asset.upload_status = 'failed'
      and not exists (
        select 1 from storage.objects object
        where object.bucket_id = asset.storage_bucket
          and object.name = asset.storage_path
      )
  ),
  2::bigint,
  'failed media placeholders have no storage object'
);
select extensions.is(
  (select count(*) from public.appointments where id::text like 'b3000000-%'),
  4::bigint,
  'four appointments cover DST gaps and folds'
);
select extensions.is(
  (
    select count(*)
    from public.checkin_symptoms association
    join public.symptoms symptom on symptom.id = association.symptom_id
    where association.id::text like 'b4200000-%'
      and symptom.slug like 'synthetic-%'
      and association.severity in (1, 3)
  ),
  2::bigint,
  'neutral symptom logs cover severity boundaries'
);
select extensions.ok(
  (select count(*) from public.meals where id::text like 'b5000000-%') = 2
  and (select count(*) from public.tasks where id::text like 'b6100000-%') = 3,
  'meal and task fixtures are present'
);
select extensions.is(
  (select count(*) from public.pregnancy_weeks where id::text like 'a1000000-%'),
  45::bigint,
  'editorial seed contains all 45 deterministic week records'
);
select extensions.is(
  (
    select count(*)
    from public.content_versions version
    join public.clinical_reviews review on review.content_version_id = version.id
    where version.id::text like 'a4000000-%'
      and version.version_number = 1
      and version.body_markdown like '%NOT CLINICALLY APPROVED%'
      and review.status = 'changes_requested'
      and review.reviewed_at = '2026-01-15T12:00:00Z'
      and review.reviewer_name = 'SEED REVIEWER PLACEHOLDER — NOT A CLINICIAN'
  ),
  45::bigint,
  'every editorial version is visibly unapproved and reviewed by a placeholder'
);
select extensions.is(
  (
    select count(*) from public.clinical_reviews
    where id::text like 'a6000000-%' and status = 'approved'
  ),
  0::bigint,
  'no synthetic editorial review is approved'
);
select extensions.ok(
  exists (
    select 1 from public.content_sources
    where id = 'a3000000-0000-4000-8000-000000000001'
      and source_url = 'https://example.invalid/tender/pregnancy-week-placeholder-source'
      and publisher = 'Tender synthetic fixture — NOT A REAL PUBLISHER'
      and jurisdiction_code = 'ZZ-TEST'
  ),
  'editorial source uses a reserved URL, fictional publisher, and test jurisdiction'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
insert into seed_rls_results
select
  'primary',
  (select count(*) from public.pregnancies),
  (select count(*) from public.journal_entries),
  (select count(*) from public.appointments),
  (select count(*) from public.daily_checkins),
  (select count(*) from public.meals),
  (select count(*) from public.tasks),
  (select count(*) from public.media_assets);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
insert into seed_rls_results
select
  'limited_partner',
  (select count(*) from public.pregnancies),
  (select count(*) from public.journal_entries),
  (select count(*) from public.appointments),
  (select count(*) from public.daily_checkins),
  (select count(*) from public.meals),
  (select count(*) from public.tasks),
  (select count(*) from public.media_assets);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000003', true);
insert into seed_rls_results
select
  'unrelated_attacker',
  (select count(*) from public.pregnancies),
  (select count(*) from public.journal_entries),
  (select count(*) from public.appointments),
  (select count(*) from public.daily_checkins),
  (select count(*) from public.meals),
  (select count(*) from public.tasks),
  (select count(*) from public.media_assets);
reset role;

select extensions.is(
  (select row(pregnancies, journals, appointments, checkins, meals, tasks, media)::text
   from seed_rls_results where persona = 'primary'),
  '(6,3,4,2,2,3,2)',
  'primary persona sees every owned application fixture'
);
select extensions.is(
  (select row(pregnancies, journals, appointments, checkins, meals, tasks, media)::text
   from seed_rls_results where persona = 'limited_partner'),
  '(1,1,0,0,0,0,0)',
  'limited partner sees only the granted pregnancy and ready journal data'
);
select extensions.is(
  (select row(pregnancies, journals, appointments, checkins, meals, tasks, media)::text
   from seed_rls_results where persona = 'unrelated_attacker'),
  '(0,0,0,0,0,0,0)',
  'unrelated attacker sees no application fixture'
);

select * from extensions.finish();
rollback;
