-- Mantém o painel de uso coerente com a vigência financeira.
-- Exclusivo do Supabase IMOBILIARIAS.

create or replace function public.agency_usage_snapshot(p_agency_id uuid)
returns table (
  plan_name text,
  subscription_status text,
  max_properties integer,
  used_properties bigint,
  max_users integer,
  used_users bigint,
  max_ai_descriptions integer,
  used_ai_descriptions bigint,
  renews_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() and not public.is_agency_member(p_agency_id) then
    raise exception 'Acesso negado';
  end if;

  return query
  with current_subscription as (
    select s.status, s.renews_at, p.name, p.max_properties, p.max_users, p.max_ai_descriptions
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at > now())
      and p.active = true
    order by s.starts_at desc
    limit 1
  ), usage as (
    select
      (select count(*) from public.properties pr where pr.agency_id = p_agency_id and pr.status <> 'inactive') as properties_count,
      (select count(*) from public.agency_memberships am where am.agency_id = p_agency_id and am.active = true) as users_count,
      (select count(*) from public.ai_usage_events au where au.agency_id = p_agency_id and au.created_at >= date_trunc('month', now())) as ai_count
  )
  select cs.name, cs.status, cs.max_properties, u.properties_count,
         cs.max_users, u.users_count, cs.max_ai_descriptions, u.ai_count, cs.renews_at
  from current_subscription cs
  cross join usage u;
end;
$$;

revoke all on function public.agency_usage_snapshot(uuid) from public;
grant execute on function public.agency_usage_snapshot(uuid) to authenticated;

-- Rotina de manutenção para refletir no status as assinaturas cuja vigência terminou.
-- Deve ser chamada apenas pelo backend/agendador do projeto IMOBILIARIAS.
create or replace function public.expire_due_agency_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.agency_subscriptions
  set status = 'expired', updated_at = now()
  where status in ('trial','active','past_due')
    and ends_at is not null
    and ends_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_due_agency_subscriptions() from public;
revoke all on function public.expire_due_agency_subscriptions() from anon, authenticated;
