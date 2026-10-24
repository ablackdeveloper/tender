begin;

-- Runtime cryptographic primitives are installed in the non-exposed extensions
-- schema. Additional extensions require a concrete schema or operational need.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app_private;

comment on schema app_private is
  'Internal helpers for policies and triggers; not exposed by the Data API.';

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;
grant usage on schema app_private to authenticated;
grant usage on schema app_private to service_role;

-- Prevent arbitrary users from creating objects that could shadow trusted names.
revoke create on schema public from public;

commit;
