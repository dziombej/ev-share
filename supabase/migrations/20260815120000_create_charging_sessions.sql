-- Create charging_sessions table: one immutable row per logged charging session.
-- Balance for any user is always derived from this table (SUM as host - SUM as seeker),
-- never stored, so there is no second write path that could drift from it.
create table if not exists public.charging_sessions (
  id uuid primary key default gen_random_uuid(),
  poc_id uuid not null references public.pocs (id),
  host_id uuid not null references auth.users (id) on delete cascade,
  host_email text not null,
  seeker_id uuid not null references auth.users (id) on delete cascade,
  seeker_email text not null,
  kwh numeric(6, 2) not null check (kwh > 0 and kwh <= 500),
  created_at timestamptz not null default now(),
  constraint charging_sessions_host_seeker_distinct check (host_id <> seeker_id)
);

alter table public.charging_sessions enable row level security;

-- Only the two participants in a session can see it (unlike pocs' public read).
create policy sessions_select_participant
  on public.charging_sessions
  for select
  to authenticated
  using (host_id = auth.uid() or seeker_id = auth.uid());

-- A user can only log a session as the host, against a POC they own.
create policy sessions_insert_own
  on public.charging_sessions
  for insert
  to authenticated
  with check (
    host_id = auth.uid()
    and exists (select 1 from public.pocs where pocs.id = poc_id and pocs.owner_id = auth.uid())
  );

-- No update or delete policy: once logged, a session is immutable.
