-- The 3-character minimum was only enforced in /api/users/search.ts. Add it inside
-- the function itself too, matching the existing p_limit clamp's own defense-in-depth
-- reasoning ("independent of whatever cap the API route passes") — otherwise any
-- authenticated caller can invoke the RPC directly with an empty prefix and page
-- through the whole user directory.
create or replace function public.search_users_by_email_prefix(p_prefix text, p_limit int default 5)
returns table(id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select id, email
  from auth.users
  where length(p_prefix) >= 3
    and lower(email) like lower(replace(replace(replace(p_prefix, '\', '\\'), '%', '\%'), '_', '\_')) || '%' escape '\'
  order by email asc
  limit greatest(least(p_limit, 20), 1)
$$;
