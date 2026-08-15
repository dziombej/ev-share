-- Refresh pocs.updated_at automatically on every update (e.g. an availability toggle).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pocs_set_updated_at
before update on public.pocs
for each row
execute function public.set_updated_at();
