-- Auto-create AppUser when a Supabase auth.users row is inserted.
-- Idempotent: re-running this file is safe.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, role, "createdAt", "updatedAt")
  values (new.id, new.email, 'OWNER', now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill any existing auth users that don't have an AppUser yet.
insert into public.app_users (id, email, role, "createdAt", "updatedAt")
select u.id, u.email, 'OWNER', now(), now()
from auth.users u
left join public.app_users a on a.id = u.id
where a.id is null;
