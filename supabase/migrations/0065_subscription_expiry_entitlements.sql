-- Faz a vigência financeira participar efetivamente das permissões do SaaS.
-- Exclusivo do projeto IMOBILIARIAS. Não aplicar em Moto Connect.

create or replace function public.agency_has_valid_subscription(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_subscriptions s
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at > now())
  )
$$;

revoke all on function public.agency_has_valid_subscription(uuid) from public;
grant execute on function public.agency_has_valid_subscription(uuid) to authenticated;

create or replace function public.agency_can_create_property(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with history as (
    select exists(select 1 from public.agency_subscriptions s where s.agency_id = p_agency_id) as has_history
  ), current_plan as (
    select p.max_properties
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at > now())
      and p.active = true
    order by s.starts_at desc
    limit 1
  )
  select case
    when not (select has_history from history) then true
    when not exists(select 1 from current_plan) then false
    else (
      select cp.max_properties is null
        or (select count(*) from public.properties pr where pr.agency_id = p_agency_id and pr.status <> 'inactive') < cp.max_properties
      from current_plan cp
    )
  end
$$;

create or replace function public.agency_can_add_member(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with history as (
    select exists(select 1 from public.agency_subscriptions s where s.agency_id = p_agency_id) as has_history
  ), current_plan as (
    select p.max_users
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at > now())
      and p.active = true
    order by s.starts_at desc
    limit 1
  )
  select case
    when not (select has_history from history) then true
    when not exists(select 1 from current_plan) then false
    else (
      select cp.max_users is null
        or (select count(*) from public.agency_memberships am where am.agency_id = p_agency_id and am.active = true) < cp.max_users
      from current_plan cp
    )
  end
$$;

create or replace function public.agency_can_use_ai_description(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with history as (
    select exists(select 1 from public.agency_subscriptions s where s.agency_id = p_agency_id) as has_history
  ), current_plan as (
    select p.max_ai_descriptions, p.features
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at > now())
      and p.active = true
    order by s.starts_at desc
    limit 1
  )
  select case
    when not (select has_history from history) then true
    when not exists(select 1 from current_plan) then false
    else (
      select lower(coalesce(cp.features ->> 'ai_descriptions','true')) in ('true','1','yes','on')
        and (
          cp.max_ai_descriptions is null
          or (select count(*) from public.ai_usage_events au where au.agency_id = p_agency_id and au.created_at >= date_trunc('month', now())) < cp.max_ai_descriptions
        )
      from current_plan cp
    )
  end
$$;

create or replace function public.agency_can_use_custom_domain(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin() then true
    when not public.is_agency_member(p_agency_id) then false
    else coalesce((
      select lower(coalesce(sp.features ->> 'custom_domain', 'false')) in ('true','1','yes','on')
      from public.agency_subscriptions s
      join public.subscription_plans sp on sp.id = s.plan_id
      where s.agency_id = p_agency_id
        and s.status in ('trial','active','past_due')
        and (s.ends_at is null or s.ends_at > now())
        and sp.active = true
      order by s.starts_at desc
      limit 1
    ), false)
  end
$$;

create or replace function public.agency_plan_feature_snapshot(p_agency_id uuid)
returns table (
  plan_name text,
  broker_app boolean,
  push_notifications boolean,
  email_leads boolean,
  ai_descriptions boolean,
  custom_domain boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_history boolean;
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select exists(select 1 from public.agency_subscriptions s where s.agency_id = p_agency_id)
  into has_history;

  return query
  with plan as (
    select sp.name, sp.features
    from public.agency_subscriptions s
    join public.subscription_plans sp on sp.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at > now())
      and sp.active = true
    order by s.starts_at desc
    limit 1
  )
  select
    coalesce((select p.name from plan p), case when has_history then 'Assinatura expirada' else 'Sem plano configurado' end)::text,
    case when exists(select 1 from plan) then coalesce((select lower(coalesce(p.features ->> 'broker_app','true')) in ('true','1','yes','on') from plan p), true) else not has_history end,
    case when exists(select 1 from plan) then coalesce((select lower(coalesce(p.features ->> 'push_notifications','true')) in ('true','1','yes','on') from plan p), true) else not has_history end,
    case when exists(select 1 from plan) then coalesce((select lower(coalesce(p.features ->> 'email_leads','true')) in ('true','1','yes','on') from plan p), true) else not has_history end,
    case when exists(select 1 from plan) then coalesce((select lower(coalesce(p.features ->> 'ai_descriptions','true')) in ('true','1','yes','on') from plan p), true) else not has_history end,
    coalesce((select lower(coalesce(p.features ->> 'custom_domain','false')) in ('true','1','yes','on') from plan p), false);
end;
$$;

revoke all on function public.agency_can_create_property(uuid) from public;
revoke all on function public.agency_can_add_member(uuid) from public;
revoke all on function public.agency_can_use_ai_description(uuid) from public;
revoke all on function public.agency_can_use_custom_domain(uuid) from public;
revoke all on function public.agency_plan_feature_snapshot(uuid) from public;
grant execute on function public.agency_can_create_property(uuid) to authenticated;
grant execute on function public.agency_can_add_member(uuid) to authenticated;
grant execute on function public.agency_can_use_ai_description(uuid) to authenticated;
grant execute on function public.agency_can_use_custom_domain(uuid) to authenticated;
grant execute on function public.agency_plan_feature_snapshot(uuid) to authenticated;
