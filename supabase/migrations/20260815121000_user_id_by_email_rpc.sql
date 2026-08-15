-- Minimal, single-purpose lookup for FR-007's "log a session for another user by email" —
-- resolves an email to a user id without exposing any other auth.users data or standing
-- up a general-purpose user directory.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;

grant execute on function public.get_user_id_by_email(text) to authenticated;
