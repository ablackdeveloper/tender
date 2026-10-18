begin;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_id_owner_key unique (id, owner_id),
  constraint tags_name_check check (char_length(btrim(name)) between 1 and 60),
  constraint tags_color_token_check check (
    color_token is null or color_token ~ '^[a-z][a-z0-9._-]{0,49}$'
  ),
  constraint tags_timestamps_check check (updated_at >= created_at)
);

create unique index tags_owner_normalized_name_key
  on public.tags(owner_id, lower(btrim(name)));

create table public.photo_series (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  title text not null,
  description text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_series_id_owner_key unique (id, owner_id),
  constraint photo_series_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint photo_series_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint photo_series_timestamps_check check (updated_at >= created_at)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  title text,
  body text not null,
  entry_at timestamptz not null default now(),
  is_pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_id_owner_key unique (id, owner_id),
  constraint journal_entries_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint journal_entries_title_check check (
    title is null or char_length(btrim(title)) between 1 and 240
  ),
  constraint journal_entries_body_check check (char_length(btrim(body)) between 1 and 100000),
  constraint journal_entries_timestamps_check check (updated_at >= created_at)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null,
  owner_id uuid not null,
  journal_entry_id uuid,
  photo_series_id uuid,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text,
  alt_text text,
  captured_at timestamptz,
  upload_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_id_owner_key unique (id, owner_id),
  constraint media_assets_pregnancy_owner_fk
    foreign key (pregnancy_id, owner_id)
    references public.pregnancies(id, owner_id) on delete cascade,
  constraint media_assets_journal_entry_owner_fk
    foreign key (journal_entry_id, owner_id)
    references public.journal_entries(id, owner_id) on delete cascade,
  constraint media_assets_photo_series_owner_fk
    foreign key (photo_series_id, owner_id)
    references public.photo_series(id, owner_id) on delete set null (photo_series_id),
  constraint media_assets_storage_bucket_check check (
    storage_bucket ~ '^[a-z0-9][a-z0-9._-]{1,62}$'
  ),
  constraint media_assets_storage_path_check check (
    char_length(btrim(storage_path)) between 1 and 1024
    and storage_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint media_assets_mime_type_check check (
    mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'
  ),
  constraint media_assets_byte_size_check check (byte_size > 0 and byte_size <= 104857600),
  constraint media_assets_sha256_check check (
    sha256 is null or sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint media_assets_upload_status_check check (
    upload_status in ('pending', 'ready', 'failed', 'deleted')
  ),
  constraint media_assets_timestamps_check check (updated_at >= created_at),
  constraint media_assets_storage_key unique (storage_bucket, storage_path)
);

create table public.journal_entry_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  journal_entry_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entry_tags_entry_owner_fk
    foreign key (journal_entry_id, owner_id)
    references public.journal_entries(id, owner_id) on delete cascade,
  constraint journal_entry_tags_tag_owner_fk
    foreign key (tag_id, owner_id)
    references public.tags(id, owner_id) on delete cascade,
  constraint journal_entry_tags_entry_tag_key unique (journal_entry_id, tag_id),
  constraint journal_entry_tags_timestamps_check check (updated_at >= created_at)
);

create index photo_series_owner_pregnancy_idx
  on public.photo_series(owner_id, pregnancy_id, started_at desc);
create index journal_entries_owner_pregnancy_entry_idx
  on public.journal_entries(owner_id, pregnancy_id, entry_at desc);
create index journal_entries_owner_pinned_idx
  on public.journal_entries(owner_id, entry_at desc)
  where is_pinned and archived_at is null;
create index media_assets_owner_pregnancy_idx
  on public.media_assets(owner_id, pregnancy_id, created_at desc);
create index media_assets_journal_entry_idx
  on public.media_assets(journal_entry_id)
  where journal_entry_id is not null;
create index media_assets_photo_series_idx
  on public.media_assets(photo_series_id, captured_at)
  where photo_series_id is not null;
create index journal_entry_tags_tag_idx
  on public.journal_entry_tags(tag_id, journal_entry_id);

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tags',
    'photo_series',
    'journal_entries',
    'media_assets',
    'journal_entry_tags'
  ] loop
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
