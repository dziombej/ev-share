-- Create profiles table: one row per user, holding their manually-entered location (FR-003).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- The local Supabase CLI's default ACL for tables created by the migration role grants no
-- select/insert/update to anon/authenticated (only Dxtm) — RLS alone is not sufficient without
-- these. No delete grant, matching the no-delete-policy stance below.
grant select, insert, update on public.profiles to authenticated;

-- A user can only read their own location — unlike pocs, this is private, not discoverable.
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- A user can only create their own profile row.
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- A user can only update their own profile row.
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy: with RLS enabled and no matching policy, delete is denied by default.
