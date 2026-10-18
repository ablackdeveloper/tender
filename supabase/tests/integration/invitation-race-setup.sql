\set ON_ERROR_STOP on

delete from auth.users
where id in (
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000002'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'f1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'synthetic-owner@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'synthetic-partner@example.test',
    '',
    now(),
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('f1000000-0000-4000-8000-000000000001', 'Synthetic owner'),
  ('f1000000-0000-4000-8000-000000000002', 'Synthetic partner');

insert into public.pregnancies (
  id,
  owner_id,
  label,
  estimated_due_date,
  due_date_source,
  timezone
)
values (
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'Synthetic concurrency pregnancy',
  current_date + 100,
  'manual',
  'America/New_York'
);

insert into public.pregnancy_members (
  id,
  pregnancy_id,
  owner_id,
  user_id,
  membership_role,
  status,
  joined_at
)
values (
  'f2100000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'owner',
  'active',
  now()
);

insert into public.journal_entries (
  id,
  pregnancy_id,
  owner_id,
  body,
  privacy_level
)
values (
  'f4000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'Synthetic cascade record',
  'private'
);

insert into public.media_assets (
  id,
  pregnancy_id,
  owner_id,
  journal_entry_id,
  storage_bucket,
  storage_path,
  mime_type,
  byte_size,
  upload_status
)
values (
  'f5000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  'tender-media',
  'f5000000-0000-4000-8000-000000000001/f5100000-0000-4000-8000-000000000001.jpg',
  'image/jpeg',
  128,
  'ready'
);

insert into public.partner_invitations (
  id,
  pregnancy_id,
  owner_id,
  invited_by_user_id,
  invited_email,
  token_hash,
  status,
  expires_at,
  permissions
)
values (
  'f3000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'synthetic-partner@example.test',
  encode(
    extensions.digest(
      convert_to(
        'synthetic-concurrency-token-000000000000000000000001',
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ),
  'pending',
  now() + interval '1 day',
  array['journal.read']::text[]
);
