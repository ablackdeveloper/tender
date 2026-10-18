-- Local source only. Apply to a hosted environment only with separate authorization.
alter table public.user_preferences
  add column home_focus text not null default 'balanced',
  add column show_weekly_content boolean not null default true,
  add column show_due_date boolean not null default true,
  add column show_progress_counts boolean not null default true,
  add column show_size_comparisons boolean not null default true,
  add constraint user_preferences_home_focus_check
    check (home_focus in ('balanced', 'memories', 'care', 'support'));

comment on column public.user_preferences.home_focus is
  'Explicit owner choice. Timely care and support still take priority. No inferred interests.';
comment on column public.user_preferences.show_weekly_content is
  'Additional content suppression only. Lifecycle and compassionate protections take precedence.';
