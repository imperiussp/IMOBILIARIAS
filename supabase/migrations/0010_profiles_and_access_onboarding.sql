create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile" on public.profiles
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "users update own profile" on public.profiles
for update to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "admins insert profiles" on public.profiles
for insert to authenticated
with check (public.is_admin());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (user_id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (user_id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.admin_set_user_access(
  target_user_id uuid,
  target_role public.user_role,
  target_broker_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, target_role)
  on conflict (user_id) do update set role = excluded.role;

  if target_role = 'broker' then
    if target_broker_id is null then
      raise exception 'Selecione um corretor para vincular';
    end if;
    update public.brokers set user_id = null where user_id = target_user_id and id <> target_broker_id;
    update public.brokers set user_id = target_user_id where id = target_broker_id;
  else
    update public.brokers set user_id = null where user_id = target_user_id;
  end if;
end;
$$;

create or replace function public.admin_revoke_user_access(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  delete from public.user_roles where user_id = target_user_id;
  update public.brokers set user_id = null where user_id = target_user_id;
end;
$$;

grant execute on function public.admin_set_user_access(uuid, public.user_role, uuid) to authenticated;
grant execute on function public.admin_revoke_user_access(uuid) to authenticated;
