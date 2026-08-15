-- This local dev environment does not seed default table-level privileges for
-- anon/authenticated (confirmed via `\ddp` returning zero rows), so RLS policies
-- alone are insufficient: Postgres denies the operation at the grant level before
-- RLS is even evaluated. RLS policies remain the actual row-level gate; these
-- grants only ungate the table-level operation itself.
grant select, insert, update on public.pocs to authenticated;
grant select on public.pocs to anon;

grant select, insert on public.charging_sessions to authenticated;
