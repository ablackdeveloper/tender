begin;

-- pgTAP is test-only and transactionally removed when it was not already present.
create extension if not exists pgtap with schema extensions;

select extensions.plan(21);

select extensions.ok(
  exists(select 1 from pg_extension where extname = 'pgcrypto'),
  'pgcrypto is installed'
);
select extensions.ok(
  exists(select 1 from pg_extension where extname = 'pgtap'),
  'pgtap is installed'
);
select extensions.has_schema('app_private', 'private helper schema exists');
select extensions.ok(
  not exists (
    select 1
    from pg_catalog.pg_namespace namespace,
      lateral pg_catalog.aclexplode(
        coalesce(
          namespace.nspacl,
          pg_catalog.acldefault('n', namespace.nspowner)
        )
      ) acl
    where namespace.nspname = 'app_private'
      and acl.grantee = 0
      and acl.privilege_type = 'USAGE'
  ),
  'PUBLIC cannot use the private helper schema'
);
select extensions.ok(
  not has_schema_privilege('anon', 'app_private', 'usage'),
  'anonymous users cannot use the private helper schema'
);
select extensions.ok(
  has_schema_privilege('authenticated', 'app_private', 'usage'),
  'authenticated users can use policy helpers'
);

select extensions.ok(
  to_regprocedure('app_private.current_user_id()') is not null,
  'current_user_id helper exists'
);
select extensions.ok(
  to_regprocedure('app_private.is_current_user(uuid)') is not null,
  'ownership predicate exists'
);
select extensions.ok(
  to_regprocedure('app_private.set_updated_at()') is not null,
  'updated_at trigger helper exists'
);

select extensions.is(
  (select prosecdef from pg_proc where oid = 'app_private.current_user_id()'::regprocedure),
  false,
  'current_user_id is security invoker'
);
select extensions.is(
  (select prosecdef from pg_proc where oid = 'app_private.is_current_user(uuid)'::regprocedure),
  false,
  'is_current_user is security invoker'
);
select extensions.is(
  (select prosecdef from pg_proc where oid = 'app_private.set_updated_at()'::regprocedure),
  false,
  'set_updated_at is security invoker'
);

select extensions.ok(
  (select proconfig @> array['search_path=""']
   from pg_proc where oid = 'app_private.current_user_id()'::regprocedure),
  'current_user_id has an empty search_path'
);
select extensions.ok(
  (select proconfig @> array['search_path=""']
   from pg_proc where oid = 'app_private.is_current_user(uuid)'::regprocedure),
  'is_current_user has an empty search_path'
);
select extensions.ok(
  (select proconfig @> array['search_path=""']
   from pg_proc where oid = 'app_private.set_updated_at()'::regprocedure),
  'set_updated_at has an empty search_path'
);

select extensions.ok(
  has_function_privilege('authenticated', 'app_private.current_user_id()', 'execute'),
  'authenticated users can execute current_user_id'
);
select extensions.ok(
  not has_function_privilege('anon', 'app_private.current_user_id()', 'execute'),
  'anonymous users cannot execute current_user_id'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select extensions.is(
  app_private.current_user_id(),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'current_user_id reads the authenticated subject'
);
select extensions.ok(
  app_private.is_current_user('11111111-1111-4111-8111-111111111111'::uuid),
  'is_current_user accepts the authenticated owner'
);
select extensions.ok(
  not app_private.is_current_user('22222222-2222-4222-8222-222222222222'::uuid),
  'is_current_user rejects a different owner'
);

create temporary table updated_at_probe (
  id integer primary key,
  updated_at timestamptz not null default '-infinity'::timestamptz
);
create trigger set_updated_at_before_update
before update on updated_at_probe
for each row execute function app_private.set_updated_at();
insert into updated_at_probe (id) values (1);
update updated_at_probe set id = id where id = 1;
select extensions.ok(
  (select updated_at > '-infinity'::timestamptz from updated_at_probe where id = 1),
  'set_updated_at stamps an updated row'
);

select * from extensions.finish();
rollback;
