-- Project-wide decision (POC stage, no per-user data isolation needed yet): disable RLS on
-- both domain tables rather than maintain owner-scoped policies. Existing policies are left in
-- place (inert while RLS is off) rather than dropped, so re-enabling RLS later is a one-line revert.
alter table public.pocs disable row level security;
alter table public.profiles disable row level security;

-- With RLS off, Postgres still enforces plain table grants for non-owner roles. pocs never had
-- explicit grants (it relied on RLS-adjacent policies); add them now so the API keeps working.
grant select, insert, update on public.pocs to authenticated;
