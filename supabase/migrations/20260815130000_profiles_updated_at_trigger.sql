-- Refresh profiles.updated_at automatically on every update (e.g. an upsert's update path).
-- Reuses public.set_updated_at(), already defined by the pocs migration.
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
