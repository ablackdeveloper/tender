begin;

-- Local/CI-only synthetic editorial fixtures. These rows are deliberately kept
-- in review and are not eligible for client publication.
insert into public.content_sources (
  id,
  title,
  publisher,
  authors,
  source_url,
  published_at,
  accessed_at,
  external_identifier,
  jurisdiction_code,
  created_at,
  updated_at
) values (
  'a3000000-0000-4000-8000-000000000001',
  'NOT CLINICALLY APPROVED — synthetic pregnancy-week source placeholder',
  'Tender synthetic fixture — NOT A REAL PUBLISHER',
  'No real authors; generated test fixture',
  'https://example.invalid/tender/pregnancy-week-placeholder-source',
  '2026-01-01T00:00:00Z',
  '2026-01-15T12:00:00Z',
  'synthetic-fixture:v1',
  'ZZ-TEST',
  '2026-01-15T12:00:00Z',
  '2026-01-15T12:00:00Z'
);

insert into public.pregnancy_weeks (
  id,
  week_number,
  title,
  summary,
  created_at,
  updated_at
)
select
  ('a1000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  week_number,
  pg_catalog.format('Week %s — synthetic fixture', week_number),
  pg_catalog.format(
    'NOT CLINICALLY APPROVED — original placeholder summary for deterministic week %s UI testing. No medical claim is intended.',
    week_number
  ),
  '2026-01-15T12:00:00Z'::timestamptz,
  '2026-01-15T12:00:00Z'::timestamptz
from pg_catalog.generate_series(1, 45) as generated_week(week_number);

insert into public.content_articles (
  id,
  pregnancy_week_id,
  slug,
  title,
  summary,
  content_kind,
  status,
  created_at,
  updated_at
)
select
  ('a2000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  ('a1000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  pg_catalog.format('seed-week-%s-placeholder', pg_catalog.lpad(week_number::text, 2, '0')),
  pg_catalog.format('NOT CLINICALLY APPROVED — Week %s placeholder', week_number),
  'Synthetic local-development copy only; not medical guidance.',
  'education',
  'in_review',
  '2026-01-15T12:00:00Z'::timestamptz,
  '2026-01-15T12:00:00Z'::timestamptz
from pg_catalog.generate_series(1, 45) as generated_week(week_number);

insert into public.content_versions (
  id,
  article_id,
  version_number,
  body_markdown,
  change_summary,
  submitted_for_review_at,
  created_at,
  updated_at
)
select
  ('a4000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  ('a2000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  1,
  pg_catalog.format(
    E'> **NOT CLINICALLY APPROVED — SYNTHETIC PLACEHOLDER COPY**\n\nWeek %s fixture text exists only to test typography, versioning, citations, localization, and empty/loading transitions. It contains no diagnostic, developmental, symptom, risk, treatment, or outcome claim. Replace it only through the governed editorial and clinical-review workflow.',
    week_number
  ),
  'Initial deterministic synthetic version; no clinical assertions.',
  '2026-01-15T12:00:00Z'::timestamptz,
  '2026-01-15T12:00:00Z'::timestamptz,
  '2026-01-15T12:00:00Z'::timestamptz
from pg_catalog.generate_series(1, 45) as generated_week(week_number);

insert into public.content_version_sources (
  id,
  content_version_id,
  content_source_id,
  citation_note,
  created_at,
  updated_at
)
select
  ('a5000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  ('a4000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'Synthetic citation placeholder. The example.invalid URL is intentionally non-resolving.',
  '2026-01-15T12:00:00Z'::timestamptz,
  '2026-01-15T12:00:00Z'::timestamptz
from pg_catalog.generate_series(1, 45) as generated_week(week_number);

insert into public.clinical_reviews (
  id,
  content_version_id,
  reviewer_name,
  credentials_snapshot,
  status,
  review_notes,
  reviewed_at,
  created_at,
  updated_at
)
select
  ('a6000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  ('a4000000-0000-4000-8000-' || pg_catalog.lpad(week_number::text, 12, '0'))::uuid,
  'SEED REVIEWER PLACEHOLDER — NOT A CLINICIAN',
  'NO CREDENTIALS — SYNTHETIC TEST FIXTURE',
  'changes_requested',
  'NOT CLINICALLY APPROVED. Fixture deliberately fails publication review.',
  '2026-01-15T12:00:00Z'::timestamptz,
  '2026-01-15T12:00:00Z'::timestamptz,
  '2026-01-15T12:00:00Z'::timestamptz
from pg_catalog.generate_series(1, 45) as generated_week(week_number);

insert into public.support_resources (
  id, locale, jurisdiction_code, resource_kind, title, description,
  action_label, action_uri, status, reviewed_at, valid_until, priority,
  created_at, updated_at
) values
  ('a7000000-0000-4000-8000-000000000001', 'en-US', 'US', 'general', 'SYNTHETIC support directory', 'TEST FIXTURE ONLY. Configurable neutral support-directory placeholder; not clinical guidance.', 'Open placeholder directory', 'https://example.invalid/support', 'published', '2026-01-15T12:00:00Z', '2027-01-15T12:00:00Z', 100, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z'),
  ('a7000000-0000-4000-8000-000000000002', 'en-US', 'US', 'loss', 'SYNTHETIC loss support', 'TEST FIXTURE ONLY. Neutral loss-support placeholder with no medical or memorial direction.', 'Open placeholder support', 'https://example.invalid/loss-support', 'published', '2026-01-15T12:00:00Z', '2027-01-15T12:00:00Z', 50, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z'),
  ('a7000000-0000-4000-8000-000000000003', 'en-US', 'US', 'postpartum', 'SYNTHETIC maternal recovery support', 'TEST FIXTURE ONLY. Maternal-recovery support placeholder; not baby tracking or medical advice.', 'Open placeholder support', 'https://example.invalid/postpartum-support', 'published', '2026-01-15T12:00:00Z', '2027-01-15T12:00:00Z', 50, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z');

commit;
