-- Aplica limites dos planos sem definir preços ou limites comerciais.
-- Se não houver plano ativo configurado, mantém compatibilidade e não bloqueia.

create or replace function public.enforce_property_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  if new.status <> 'inactive' and (
    tg_op = 'INSERT'
    or old.status = 'inactive'
    or old.agency_id is distinct from new.agency_id
  ) then
    if not public.agency_can_create_property(new.agency_id) then
      raise exception 'Limite de imóveis do plano atingido. Atualize o plano para cadastrar ou reativar novos imóveis.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists properties_plan_limit_trigger on public.properties;
create trigger properties_plan_limit_trigger
before insert or update of status, agency_id on public.properties
for each row execute function public.enforce_property_plan_limit();

create or replace function public.enforce_membership_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  if new.active = true and (
    tg_op = 'INSERT'
    or old.active = false
    or old.agency_id is distinct from new.agency_id
  ) then
    if not public.agency_can_add_member(new.agency_id) then
      raise exception 'Limite de usuários do plano atingido. Atualize o plano para adicionar novos membros.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists agency_memberships_plan_limit_trigger on public.agency_memberships;
create trigger agency_memberships_plan_limit_trigger
before insert or update of active, agency_id on public.agency_memberships
for each row execute function public.enforce_membership_plan_limit();

-- Evita uso direto das funções de limite por usuários sem vínculo com o tenant.
create or replace function public.agency_can_create_property(p_agency_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  max_allowed integer;
  used_count bigint;
begin
  if not public.is_platform_admin() and not public.is_agency_member(p_agency_id) then
    return false;
  end if;

  select p.max_properties
    into max_allowed
  from public.agency_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
  order by s.starts_at desc
  limit 1;

  if not found or max_allowed is null then
    return true;
  end if;

  select count(*) into used_count
  from public.properties pr
  where pr.agency_id = p_agency_id and pr.status <> 'inactive';

  return used_count < max_allowed;
end;
$$;

create or replace function public.agency_can_add_member(p_agency_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  max_allowed integer;
  used_count bigint;
begin
  if not public.is_platform_admin() and not public.is_agency_member(p_agency_id) then
    return false;
  end if;

  select p.max_users
    into max_allowed
  from public.agency_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
  order by s.starts_at desc
  limit 1;

  if not found or max_allowed is null then
    return true;
  end if;

  select count(*) into used_count
  from public.agency_memberships am
  where am.agency_id = p_agency_id and am.active = true;

  return used_count < max_allowed;
end;
$$;

revoke all on function public.enforce_property_plan_limit() from public;
revoke all on function public.enforce_membership_plan_limit() from public;
revoke all on function public.agency_can_create_property(uuid) from public;
revoke all on function public.agency_can_add_member(uuid) from public;
grant execute on function public.agency_can_create_property(uuid) to authenticated;
grant execute on function public.agency_can_add_member(uuid) to authenticated;
