-- Gestão de equipe por imobiliária no modelo SaaS.
-- Proprietários e administradores gerenciam apenas membros do próprio tenant.

-- Idempotência: evita conflito caso a policy já exista em uma base de teste.
drop policy if exists "agency managers read member profiles" on public.profiles;
create policy "agency managers read member profiles" on public.profiles
for select to authenticated
using (
  auth.uid() = user_id
  or public.is_admin()
  or exists (
    select 1
    from public.agency_memberships manager
    join public.agency_memberships member
      on member.agency_id = manager.agency_id
    where manager.user_id = auth.uid()
      and manager.active = true
      and manager.role in ('owner','admin')
      and member.user_id = profiles.user_id
      and member.active = true
  )
);

create or replace function public.agency_set_member_role(
  p_agency_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_broker_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select am.role into caller_role
  from public.agency_memberships am
  where am.agency_id = p_agency_id
    and am.user_id = auth.uid()
    and am.active = true
  limit 1;

  if not public.is_admin() and caller_role not in ('owner','admin') then
    raise exception 'Acesso negado';
  end if;

  if p_role not in ('admin','broker','staff') then
    raise exception 'Perfil inválido';
  end if;

  if caller_role = 'admin' and p_role = 'admin' then
    raise exception 'Somente o proprietário pode promover outro administrador';
  end if;

  if not exists (
    select 1 from public.agency_memberships am
    where am.agency_id = p_agency_id and am.user_id = p_target_user_id
  ) then
    raise exception 'Usuário não pertence a esta imobiliária';
  end if;

  if exists (
    select 1 from public.agency_memberships am
    where am.agency_id = p_agency_id
      and am.user_id = p_target_user_id
      and am.role = 'owner'
  ) then
    raise exception 'O proprietário principal não pode ter o perfil alterado por esta operação';
  end if;

  update public.agency_memberships
  set role = p_role, active = true
  where agency_id = p_agency_id and user_id = p_target_user_id;

  if p_role = 'broker' then
    if p_broker_id is null then
      raise exception 'Selecione um corretor para vincular';
    end if;
    if not exists (
      select 1 from public.brokers b
      where b.id = p_broker_id and b.agency_id = p_agency_id and b.active = true
    ) then
      raise exception 'Corretor não pertence a esta imobiliária';
    end if;
    update public.brokers
      set user_id = null
      where agency_id = p_agency_id
        and user_id = p_target_user_id
        and id <> p_broker_id;
    update public.brokers
      set user_id = p_target_user_id
      where id = p_broker_id and agency_id = p_agency_id;
  else
    update public.brokers
      set user_id = null
      where agency_id = p_agency_id and user_id = p_target_user_id;
  end if;
end;
$$;

create or replace function public.agency_revoke_member(
  p_agency_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  select am.role into caller_role
  from public.agency_memberships am
  where am.agency_id = p_agency_id
    and am.user_id = auth.uid()
    and am.active = true
  limit 1;

  if not public.is_admin() and caller_role not in ('owner','admin') then
    raise exception 'Acesso negado';
  end if;

  select am.role into target_role
  from public.agency_memberships am
  where am.agency_id = p_agency_id and am.user_id = p_target_user_id
  limit 1;

  if target_role is null then
    raise exception 'Usuário não pertence a esta imobiliária';
  end if;
  if target_role = 'owner' then
    raise exception 'O proprietário principal não pode ser revogado';
  end if;
  if caller_role = 'admin' and target_role = 'admin' then
    raise exception 'Somente o proprietário pode revogar outro administrador';
  end if;

  update public.agency_memberships
  set active = false
  where agency_id = p_agency_id and user_id = p_target_user_id;

  update public.brokers
  set user_id = null
  where agency_id = p_agency_id and user_id = p_target_user_id;
end;
$$;

-- SECURITY DEFINER não deve herdar EXECUTE para PUBLIC.
revoke all on function public.agency_set_member_role(uuid, uuid, text, uuid) from public;
revoke all on function public.agency_revoke_member(uuid, uuid) from public;
grant execute on function public.agency_set_member_role(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.agency_revoke_member(uuid, uuid) to authenticated;
