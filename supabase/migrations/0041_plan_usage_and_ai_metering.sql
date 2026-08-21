-- Medição de uso por plano. Não define preços e não ativa cobrança.
-- Os limites só serão usados quando um plano real estiver vinculado à imobiliária.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'property_description',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_agency_month_idx
on public.ai_usage_events (agency_id, created_at desc);

alter table public.ai_usage_events enable row level security;

create policy "tenant members create own ai usage" on public.ai_usage_events
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_agency_member(agency_id)
);

create policy "tenant managers read own ai usage" on public.ai_usage_events
for select to authenticated
using (public.can_manage_agency(agency_id));

create policy "platform admins manage ai usage" on public.ai_usage_events
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

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
  if not public.is_admin() and not public.is_agency_member(p_agency_id) then
    raise exception 'Acesso negado';
  end if;

  return query
  with current_subscription as (
    select s.status, s.renews_at, p.name, p.max_properties, p.max_users, p.max_ai_descriptions
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
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

grant execute on function public.agency_usage_snapshot(uuid) to authenticated;

create or replace function public.agency_can_create_property(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_plan as (
    select p.max_properties
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
    order by s.starts_at desc
    limit 1
  )
  select coalesce(
    (
      select cp.max_properties is null
        or (select count(*) from public.properties pr where pr.agency_id = p_agency_id and pr.status <> 'inactive') < cp.max_properties
      from current_plan cp
    ),
    true
  )
$$;

create or replace function public.agency_can_add_member(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_plan as (
    select p.max_users
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
    order by s.starts_at desc
    limit 1
  )
  select coalesce(
    (
      select cp.max_users is null
        or (select count(*) from public.agency_memberships am where am.agency_id = p_agency_id and am.active = true) < cp.max_users
      from current_plan cp
    ),
    true
  )
$$;

create or replace function public.agency_can_use_ai_description(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_plan as (
    select p.max_ai_descriptions
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
    order by s.starts_at desc
    limit 1
  )
  select coalesce(
    (
      select cp.max_ai_descriptions is null
        or (select count(*) from public.ai_usage_events au where au.agency_id = p_agency_id and au.created_at >= date_trunc('month', now())) < cp.max_ai_descriptions
      from current_plan cp
    ),
    true
  )
$$;

revoke all on function public.agency_can_create_property(uuid) from public;
revoke all on function public.agency_can_add_member(uuid) from public;
revoke all on function public.agency_can_use_ai_description(uuid) from public;
grant execute on function public.agency_can_create_property(uuid) to authenticated;
grant execute on function public.agency_can_add_member(uuid) to authenticated;
grant execute on function public.agency_can_use_ai_description(uuid) to authenticated;
