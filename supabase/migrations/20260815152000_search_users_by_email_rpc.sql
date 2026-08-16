-- Bounded, authenticated-only prefix search backing the seeker-email combobox —
-- deliberately narrow (email only, capped result count) to limit directory
-- enumeration, matching get_user_id_by_email's single-purpose precedent.
create or replace function public.search_users_by_email_prefix(p_prefix text, p_limit int default 5)
returns table(id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select id, email
  from auth.users
  where lower(email) like lower(p_prefix) || '%'
  order by email asc
  limit greatest(least(p_limit, 20), 1)
$$;

grant execute on function public.search_users_by_email_prefix(text, int) to authenticated;
