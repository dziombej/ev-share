-- Lets anonymous visitors to "/" see the public POC list (FR-006 extended to anon) —
-- additive only, does not touch pocs_select_authenticated or any insert/update policy.
create policy pocs_select_anon
  on public.pocs
  for select
  to anon
  using (true);
