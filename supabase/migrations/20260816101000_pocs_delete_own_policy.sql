-- 20260815100000_create_pocs.sql originally noted "no delete policy" since delete
-- wasn't supported yet. Delete is now supported (20260815151000_pocs_delete_grant.sql),
-- so add the owner-scoped policy mirroring pocs_update_own/pocs_insert_own. Dormant
-- today since RLS is disabled on pocs (20260815140000_disable_rls.sql) — this just
-- keeps delete symmetric with the other operations for whenever RLS is re-enabled.
create policy pocs_delete_own
  on public.pocs
  for delete
  to authenticated
  using (owner_id = auth.uid());
