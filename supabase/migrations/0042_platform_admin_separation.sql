-- Separa administradores da plataforma dos administradores de cada imobiliária.
-- O legado user_roles.admin é migrado uma única vez para platform_admins.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.platform_admins (user_id)
select ur.user_id
from public.user_roles ur
where ur.role = 'admin'
on conflict (user_id) do nothing;

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  )
$$;

-- Compatibilidade: funções e policies antigas que chamam is_admin()
-- passam a reconhecer apenas administradores globais da plataforma.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.current_agency_ids() from public;
revoke all on function public.is_agency_member(uuid) from public;
revoke all on function public.can_manage_agency(uuid) from public;
revoke all on function public.can_sell_for_agency(uuid) from public;
grant execute on function public.current_agency_ids() to authenticated;
grant execute on function public.is_agency_member(uuid) to authenticated;
grant execute on function public.can_manage_agency(uuid) to authenticated;
grant execute on function public.can_sell_for_agency(uuid) to authenticated;

-- A própria lista global não fica exposta a tenants.
drop policy if exists "platform admins read platform admins" on public.platform_admins;
create policy "platform admins read platform admins" on public.platform_admins
for select to authenticated
using (public.is_platform_admin());

-- Administração global somente pelo backend/plataforma. Nenhum tenant recebe
-- policy de INSERT/UPDATE/DELETE nesta tabela.

-- Substitui a antiga gestão global de user_roles para impedir que um admin
-- de imobiliária consiga se transformar em administrador da plataforma.
drop policy if exists "admins manage roles" on public.user_roles;
create policy "platform admins manage legacy roles" on public.user_roles
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Protege também a gestão dos planos comerciais.
drop policy if exists "admins manage subscription plans" on public.subscription_plans;
create policy "platform admins manage subscription plans" on public.subscription_plans
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage subscriptions" on public.agency_subscriptions;
create policy "platform admins manage subscriptions" on public.agency_subscriptions
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
