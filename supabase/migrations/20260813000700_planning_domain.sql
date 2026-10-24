begin;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  title text not null,
  description text,
  status text not null default 'active',
  due_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_id_owner_key unique (id, owner_id),
  constraint projects_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint projects_title_check check (char_length(btrim(title)) between 1 and 240),
  constraint projects_status_check check (
    status in ('active', 'completed', 'archived')
  ),
  constraint projects_completion_check check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  ),
  constraint projects_archive_check check (
    (status = 'archived' and archived_at is not null)
    or status <> 'archived'
  ),
  constraint projects_timestamps_check check (updated_at >= created_at)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open',
  priority smallint not null default 1,
  due_at timestamptz,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_project_owner_fk
    foreign key (project_id, owner_id)
    references public.projects(id, owner_id) on delete cascade,
  constraint tasks_title_check check (char_length(btrim(title)) between 1 and 240),
  constraint tasks_status_check check (
    status in ('open', 'in_progress', 'completed', 'cancelled')
  ),
  constraint tasks_priority_check check (priority between 0 and 3),
  constraint tasks_position_check check (position >= 0),
  constraint tasks_completion_check check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  ),
  constraint tasks_timestamps_check check (updated_at >= created_at)
);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  requested_from_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open',
  requested_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_requests_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint support_requests_title_check check (
    char_length(btrim(title)) between 1 and 240
  ),
  constraint support_requests_status_check check (
    status in ('open', 'accepted', 'resolved', 'declined', 'cancelled')
  ),
  constraint support_requests_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or status <> 'resolved'
  ),
  constraint support_requests_declined_check check (
    (status = 'declined' and declined_at is not null)
    or status <> 'declined'
  ),
  constraint support_requests_timestamps_check check (updated_at >= created_at)
);

create index projects_owner_status_due_idx
  on public.projects(owner_id, status, due_at);
create index tasks_project_status_position_idx
  on public.tasks(project_id, status, position);
create index tasks_assigned_status_due_idx
  on public.tasks(assigned_user_id, status, due_at)
  where assigned_user_id is not null;
create index support_requests_owner_status_idx
  on public.support_requests(owner_id, status, requested_at desc);
create index support_requests_recipient_status_idx
  on public.support_requests(requested_from_user_id, status, requested_at desc)
  where requested_from_user_id is not null;

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array['projects', 'tasks', 'support_requests'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      table_name
    );
    execute format(
      'create policy owner_access on public.%I for all to authenticated using (app_private.is_current_user(owner_id)) with check (app_private.is_current_user(owner_id))',
      table_name
    );
  end loop;
end;
$migration$;

commit;
