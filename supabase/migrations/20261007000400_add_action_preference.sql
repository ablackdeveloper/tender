begin;

alter table public.user_preferences
  add column default_add_action text,
  add constraint user_preferences_default_add_action_check check (
    default_add_action is null
    or default_add_action in (
      'check_in',
      'memory',
      'meal',
      'appointment_question'
    )
  );

comment on column public.user_preferences.default_add_action is
  'Owner-selected Add shortcut. Tender never changes this choice automatically.';

commit;
