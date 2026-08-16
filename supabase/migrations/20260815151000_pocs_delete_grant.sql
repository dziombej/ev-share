-- RLS is disabled on pocs (see 20260815140000_disable_rls.sql); table grants are the only
-- gate. Add delete so an owner can remove a POC with no charging-session history — the
-- existing charging_sessions.poc_id foreign key (no ON DELETE clause) rejects deletes for
-- POCs that do have history, which is the desired behavior (no soft-delete needed).
grant delete on public.pocs to authenticated;
