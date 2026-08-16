-- Denormalize the owner's email onto pocs, mirroring how charging_sessions already
-- snapshots host_email/seeker_email — avoids a new privileged join for every list render.
alter table public.pocs add column owner_email text;

update public.pocs p
set owner_email = u.email
from auth.users u
where u.id = p.owner_id;

alter table public.pocs alter column owner_email set not null;
