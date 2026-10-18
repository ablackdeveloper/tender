begin;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to authenticated;
set local search_path = public, extensions;
select extensions.no_plan();
\ir ../../editorial/weekly-drafts.sql
\ir ../../editorial/weekly-drafts.sql
select extensions.is((select count(*) from public.content_articles where slug like 'flutterings-week-%'), 42::bigint, 'draft import is complete and repeatable');
select extensions.is((select count(*) from public.content_articles where slug like 'flutterings-week-%' and status='in_review' and published_at is null), 42::bigint, 'all new articles require review');
select extensions.is((select count(*) from public.content_versions v join public.content_articles a on a.id=v.article_id where a.slug like 'flutterings-week-%' and v.published_at is null), 42::bigint, 'no draft version is published');
select extensions.is((select count(*) from public.clinical_reviews r join public.content_versions v on v.id=r.content_version_id join public.content_articles a on a.id=v.article_id where a.slug like 'flutterings-week-%'), 0::bigint, 'no clinical approval is fabricated');
select extensions.is((select count(*) from public.content_version_sources s join public.content_versions v on v.id=s.content_version_id join public.content_articles a on a.id=v.article_id where a.slug like 'flutterings-week-%'), 42::bigint, 'every draft has a review reference');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select extensions.is((select count(*) from public.content_articles where slug like 'flutterings-week-%'), 0::bigint, 'signed-in readers cannot see draft articles');
reset role;
select * from extensions.finish();
rollback;
