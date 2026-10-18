begin;

alter table public.content_sources
  add column jurisdiction_code text,
  add constraint content_sources_jurisdiction_check check (
    jurisdiction_code is null
    or jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,8})?$'
  );

create index content_sources_jurisdiction_idx
  on public.content_sources(jurisdiction_code)
  where jurisdiction_code is not null;

comment on column public.content_sources.jurisdiction_code is
  'Editorial applicability code, not a user location. ZZ-* values are reserved for synthetic fixtures.';

commit;
