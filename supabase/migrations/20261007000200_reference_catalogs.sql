begin;

-- These neutral catalog values make the check-in flow usable in a new project.
-- They are labels only. They do not diagnose, score, or recommend care.
insert into public.emotions (
  id, slug, display_name, sort_order, is_active
) values
  ('c1000000-0000-4000-8000-000000000001', 'hopeful', 'Hopeful', 10, true),
  ('c1000000-0000-4000-8000-000000000002', 'grateful', 'Grateful', 20, true),
  ('c1000000-0000-4000-8000-000000000003', 'connected', 'Connected', 30, true),
  ('c1000000-0000-4000-8000-000000000004', 'content', 'Content', 40, true),
  ('c1000000-0000-4000-8000-000000000005', 'anxious', 'Anxious', 50, true),
  ('c1000000-0000-4000-8000-000000000006', 'overwhelmed', 'Overwhelmed', 60, true),
  ('c1000000-0000-4000-8000-000000000007', 'tired', 'Tired', 70, true),
  ('c1000000-0000-4000-8000-000000000008', 'sad', 'Sad', 80, true),
  ('c1000000-0000-4000-8000-000000000009', 'uncertain', 'Uncertain', 90, true),
  ('c1000000-0000-4000-8000-000000000010', 'numb', 'Numb', 100, true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.symptoms (
  id, slug, display_name, description, sort_order, is_active
) values
  ('c2000000-0000-4000-8000-000000000001', 'nausea', 'Nausea', null, 10, true),
  ('c2000000-0000-4000-8000-000000000002', 'heartburn', 'Heartburn', null, 20, true),
  ('c2000000-0000-4000-8000-000000000003', 'back-pain', 'Back pain', null, 30, true),
  ('c2000000-0000-4000-8000-000000000004', 'headache', 'Headache', null, 40, true),
  ('c2000000-0000-4000-8000-000000000005', 'leg-cramps', 'Leg cramps', null, 50, true),
  ('c2000000-0000-4000-8000-000000000006', 'swelling', 'Swelling', null, 60, true),
  ('c2000000-0000-4000-8000-000000000007', 'fatigue', 'Fatigue', null, 70, true),
  ('c2000000-0000-4000-8000-000000000008', 'trouble-sleeping', 'Trouble sleeping', null, 80, true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

commit;
