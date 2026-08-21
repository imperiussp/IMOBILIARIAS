-- Snapshot seguro dos recursos comerciais habilitados para a imobiliária.
-- Enquanto não houver plano vinculado, preserva as funções já existentes; domínio próprio permanece restrito.

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
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  return query
  with plan as (
    select sp.name, sp.features
    from public.agency_subscriptions s
    join public.subscription_plans sp on sp.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and sp.active = true
    order by s.starts_at desc
    limit 1
  )
  select
    coalesce((select p.name from plan p), 'Sem plano configurado')::text,
    coalesce((select lower(coalesce(p.features ->> 'broker_app','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'push_notifications','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'email_leads','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'ai_descriptions','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'custom_domain','false')) in ('true','1','yes','on') from plan p), false);
end;
$$;

revoke all on function public.agency_plan_feature_snapshot(uuid) from public;
grant execute on function public.agency_plan_feature_snapshot(uuid) to authenticated;
