-- Fix: search_users_by_email_prefix's LIKE pattern did not escape %/_ in the
-- caller-supplied prefix. Since '_' matches any single character, a 3-char
-- prefix of "___" (which passes the app's own 3-char minimum) matched almost
-- every registered email, defeating the function's stated intent to bound
-- directory enumeration. Escape LIKE metacharacters before building the pattern.
create or replace function public.search_users_by_email_prefix(p_prefix text, p_limit int default 5)
returns table(id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select id, email
  from auth.users
  where lower(email) like lower(replace(replace(replace(p_prefix, '\', '\\'), '%', '\%'), '_', '\_')) || '%' escape '\'
  order by email asc
  limit greatest(least(p_limit, 20), 1)
$$;
