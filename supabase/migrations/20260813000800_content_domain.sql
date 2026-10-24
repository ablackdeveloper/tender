begin;

create table public.pregnancy_weeks (
  id uuid primary key default gen_random_uuid(),
  week_number smallint not null unique,
  title text not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pregnancy_weeks_number_check check (week_number between 1 and 45),
  constraint pregnancy_weeks_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint pregnancy_weeks_timestamps_check check (updated_at >= created_at)
);

create table public.content_articles (
  id uuid primary key default gen_random_uuid(),
  pregnancy_week_id uuid references public.pregnancy_weeks(id) on delete set null,
  slug text not null unique,
  title text not null,
  summary text,
  content_kind text not null,
  status text not null default 'draft',
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_articles_slug_check check (slug ~ '^[a-z][a-z0-9-]{0,119}$'),
  constraint content_articles_title_check check (char_length(btrim(title)) between 1 and 240),
  constraint content_articles_kind_check check (
    content_kind in ('education', 'planning', 'wellbeing', 'care_preparation')
  ),
  constraint content_articles_status_check check (
    status in ('draft', 'in_review', 'published', 'archived')
  ),
  constraint content_articles_publish_check check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  ),
  constraint content_articles_archive_check check (
    (status = 'archived' and archived_at is not null)
    or status <> 'archived'
  ),
  constraint content_articles_timestamps_check check (updated_at >= created_at)
);

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text,
  authors text,
  source_url text not null,
  published_at timestamptz,
  accessed_at timestamptz,
  external_identifier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_sources_title_check check (char_length(btrim(title)) between 1 and 500),
  constraint content_sources_url_check check (source_url ~ '^https://'),
  constraint content_sources_timestamps_check check (updated_at >= created_at),
  constraint content_sources_url_key unique (source_url)
);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.content_articles(id) on delete cascade,
  version_number integer not null,
  body_markdown text not null,
  change_summary text,
  authored_by_user_id uuid references auth.users(id) on delete set null,
  submitted_for_review_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_versions_id_article_key unique (id, article_id),
  constraint content_versions_article_version_key unique (article_id, version_number),
  constraint content_versions_number_check check (version_number > 0),
  constraint content_versions_body_check check (
    char_length(btrim(body_markdown)) between 1 and 500000
  ),
  constraint content_versions_timestamps_check check (updated_at >= created_at)
);

create table public.content_version_sources (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions(id) on delete cascade,
  content_source_id uuid not null references public.content_sources(id) on delete restrict,
  citation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_version_sources_pair_key unique (content_version_id, content_source_id),
  constraint content_version_sources_timestamps_check check (updated_at >= created_at)
);

create table public.urgent_guidance (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body_markdown text not null,
  action_label text,
  action_uri text,
  region_code text,
  status text not null default 'draft',
  effective_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint urgent_guidance_slug_check check (slug ~ '^[a-z][a-z0-9-]{0,119}$'),
  constraint urgent_guidance_title_check check (char_length(btrim(title)) between 1 and 240),
  constraint urgent_guidance_body_check check (
    char_length(btrim(body_markdown)) between 1 and 100000
  ),
  constraint urgent_guidance_action_check check (
    (action_label is null) = (action_uri is null)
  ),
  constraint urgent_guidance_action_uri_check check (
    action_uri is null or action_uri ~ '^(https://|tel:)'
  ),
  constraint urgent_guidance_region_check check (
    region_code is null or region_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'
  ),
  constraint urgent_guidance_status_check check (
    status in ('draft', 'in_review', 'published', 'retired')
  ),
  constraint urgent_guidance_effective_order_check check (
    expires_at is null or effective_at is null or expires_at > effective_at
  ),
  constraint urgent_guidance_publish_check check (
    (status = 'published' and published_at is not null and effective_at is not null)
    or status <> 'published'
  ),
  constraint urgent_guidance_timestamps_check check (updated_at >= created_at)
);

comment on table public.urgent_guidance is
  'Clinically reviewed escalation copy only. It must not diagnose, score risk, or infer conditions.';

create table public.clinical_reviews (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid references public.content_versions(id) on delete cascade,
  urgent_guidance_id uuid references public.urgent_guidance(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewer_name text not null,
  credentials_snapshot text not null,
  status text not null default 'pending',
  review_notes text,
  reviewed_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_reviews_single_target_check check (
    num_nonnulls(content_version_id, urgent_guidance_id) = 1
  ),
  constraint clinical_reviews_reviewer_name_check check (
    char_length(btrim(reviewer_name)) between 1 and 200
  ),
  constraint clinical_reviews_credentials_check check (
    char_length(btrim(credentials_snapshot)) between 1 and 500
  ),
  constraint clinical_reviews_status_check check (
    status in ('pending', 'approved', 'changes_requested', 'expired', 'withdrawn')
  ),
  constraint clinical_reviews_completion_check check (
    (status in ('approved', 'changes_requested') and reviewed_at is not null)
    or status not in ('approved', 'changes_requested')
  ),
  constraint clinical_reviews_validity_check check (
    valid_until is null or reviewed_at is null or valid_until > reviewed_at
  ),
  constraint clinical_reviews_timestamps_check check (updated_at >= created_at)
);

alter table public.content_articles
  add column current_version_id uuid,
  add constraint content_articles_current_version_fk
    foreign key (current_version_id, id)
    references public.content_versions(id, article_id) on delete set null (current_version_id),
  add constraint content_articles_published_version_check check (
    status <> 'published' or current_version_id is not null
  );

create or replace function app_private.has_approved_clinical_review(
  target_content_version_id uuid,
  target_urgent_guidance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select
    pg_catalog.num_nonnulls(target_content_version_id, target_urgent_guidance_id) = 1
    and exists (
      select 1
      from public.clinical_reviews review
      where review.status = 'approved'
        and review.reviewed_at is not null
        and (review.valid_until is null or review.valid_until > pg_catalog.now())
        and (
          review.content_version_id = target_content_version_id
          or review.urgent_guidance_id = target_urgent_guidance_id
        )
    );
$function$;

revoke all on function app_private.has_approved_clinical_review(uuid, uuid) from public;
revoke all on function app_private.has_approved_clinical_review(uuid, uuid) from anon;
grant execute on function app_private.has_approved_clinical_review(uuid, uuid)
  to authenticated, service_role;

create index content_articles_week_status_idx
  on public.content_articles(pregnancy_week_id, status, published_at desc);
create index content_versions_article_created_idx
  on public.content_versions(article_id, created_at desc);
create index content_version_sources_source_idx
  on public.content_version_sources(content_source_id, content_version_id);
create index clinical_reviews_version_status_idx
  on public.clinical_reviews(content_version_id, status, reviewed_at desc)
  where content_version_id is not null;
create index clinical_reviews_guidance_status_idx
  on public.clinical_reviews(urgent_guidance_id, status, reviewed_at desc)
  where urgent_guidance_id is not null;
create index urgent_guidance_status_effective_idx
  on public.urgent_guidance(status, effective_at, expires_at);

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pregnancy_weeks',
    'content_articles',
    'content_sources',
    'content_versions',
    'content_version_sources',
    'urgent_guidance',
    'clinical_reviews'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$migration$;

grant select on
  public.pregnancy_weeks,
  public.content_articles,
  public.content_sources,
  public.content_versions,
  public.content_version_sources,
  public.urgent_guidance,
  public.clinical_reviews
to authenticated;

create policy pregnancy_weeks_read on public.pregnancy_weeks
  for select to authenticated using (true);
create policy published_articles_read on public.content_articles
  for select to authenticated
  using (
    status = 'published'
    and current_version_id is not null
    and app_private.has_approved_clinical_review(current_version_id, null)
  );
create policy published_content_sources_read on public.content_sources
  for select to authenticated
  using (
    exists (
      select 1
      from public.content_version_sources version_source
      join public.content_versions version
        on version.id = version_source.content_version_id
      join public.content_articles article on article.id = version.article_id
      where version_source.content_source_id = content_sources.id
        and version.published_at is not null
        and article.status = 'published'
        and article.current_version_id = version.id
        and app_private.has_approved_clinical_review(version.id, null)
    )
  );
create policy published_versions_read on public.content_versions
  for select to authenticated
  using (
    published_at is not null
    and exists (
      select 1 from public.content_articles article
      where article.id = content_versions.article_id
        and article.status = 'published'
        and article.current_version_id = content_versions.id
    )
  );
create policy published_version_sources_read on public.content_version_sources
  for select to authenticated
  using (
    exists (
      select 1 from public.content_versions version
      join public.content_articles article on article.id = version.article_id
      where version.id = content_version_sources.content_version_id
        and version.published_at is not null
        and article.status = 'published'
        and article.current_version_id = version.id
        and app_private.has_approved_clinical_review(version.id, null)
    )
  );
create policy approved_clinical_reviews_read on public.clinical_reviews
  for select to authenticated
  using (
    status = 'approved'
    and reviewed_at is not null
    and (valid_until is null or valid_until > now())
    and (
      (
        content_version_id is not null
        and exists (
          select 1
          from public.content_versions version
          join public.content_articles article on article.id = version.article_id
          where version.id = clinical_reviews.content_version_id
            and article.status = 'published'
            and article.current_version_id = version.id
        )
      )
      or (
        urgent_guidance_id is not null
        and exists (
          select 1
          from public.urgent_guidance guidance
          where guidance.id = clinical_reviews.urgent_guidance_id
            and guidance.status = 'published'
            and guidance.effective_at <= now()
            and (guidance.expires_at is null or guidance.expires_at > now())
        )
      )
    )
  );
create policy published_urgent_guidance_read on public.urgent_guidance
  for select to authenticated
  using (
    status = 'published'
    and effective_at <= now()
    and (expires_at is null or expires_at > now())
    and app_private.has_approved_clinical_review(null, id)
  );

commit;
