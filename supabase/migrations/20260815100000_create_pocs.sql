-- Create pocs table: one row per registered EV charging point (POC).
create table if not exists public.pocs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  power_rating_kw numeric(6, 2) not null check (power_rating_kw > 0 and power_rating_kw <= 350),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pocs enable row level security;

-- Any signed-in user can view all POCs (FR-006).
create policy pocs_select_authenticated
  on public.pocs
  for select
  to authenticated
  using (true);

-- A user can only register POCs they own.
create policy pocs_insert_own
  on public.pocs
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- A user can only update (e.g. toggle availability on) POCs they own.
create policy pocs_update_own
  on public.pocs
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- No delete policy: with RLS enabled and no matching policy, delete is denied by default.
