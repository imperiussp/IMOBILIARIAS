-- Metas mensais por corretor.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.broker_monthly_goals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  broker_id uuid not null references public.brokers(id) on delete cascade,
  month date not null,
  leads_goal integer not null default 0 check (leads_goal >= 0),
  visits_goal integer not null default 0 check (visits_goal >= 0),
  won_goal integer not null default 0 check (won_goal >= 0),
  new_properties_goal integer not null default 0 check (new_properties_goal >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id,broker_id,month)
);

create index if not exists broker_monthly_goals_agency_month_idx on public.broker_monthly_goals(agency_id,month desc);
alter table public.broker_monthly_goals enable row level security;

drop policy if exists "tenant managers manage broker goals" on public.broker_monthly_goals;
create policy "tenant managers manage broker goals" on public.broker_monthly_goals
for all to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin())
with check (public.can_manage_agency(agency_id) or public.is_platform_admin());

drop policy if exists "tenant members read broker goals" on public.broker_monthly_goals;
create policy "tenant members read broker goals" on public.broker_monthly_goals
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());

create or replace function public.validate_broker_goal_tenant()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.brokers b where b.id=new.broker_id and b.agency_id=new.agency_id) then raise exception 'Corretor fora da imobiliária atual.'; end if;
  new.month := date_trunc('month',new.month)::date;
  new.created_by := coalesce(new.created_by,auth.uid());
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.validate_broker_goal_tenant() from public,anon,authenticated;

drop trigger if exists broker_monthly_goals_validate on public.broker_monthly_goals;
create trigger broker_monthly_goals_validate before insert or update on public.broker_monthly_goals
for each row execute function public.validate_broker_goal_tenant();

create or replace view public.broker_monthly_goal_progress as
select
  g.agency_id,g.broker_id,g.month,g.leads_goal,g.visits_goal,g.won_goal,g.new_properties_goal,
  (select count(*) from public.leads l where l.agency_id=g.agency_id and l.broker_id=g.broker_id and l.created_at>=g.month and l.created_at<g.month+interval '1 month')::bigint as leads_done,
  (select count(*) from public.property_visit_appointments v where v.agency_id=g.agency_id and v.broker_id=g.broker_id and v.status='completed' and v.scheduled_at>=g.month and v.scheduled_at<g.month+interval '1 month')::bigint as visits_done,
  (select count(*) from public.leads l where l.agency_id=g.agency_id and l.broker_id=g.broker_id and l.status='won' and l.updated_at>=g.month and l.updated_at<g.month+interval '1 month')::bigint as won_done,
  (select count(*) from public.properties p where p.agency_id=g.agency_id and p.broker_id=g.broker_id and p.created_at>=g.month and p.created_at<g.month+interval '1 month')::bigint as new_properties_done
from public.broker_monthly_goals g;
revoke all on public.broker_monthly_goal_progress from public,anon;
grant select on public.broker_monthly_goal_progress to authenticated;
