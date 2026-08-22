-- Desempenho comercial dos imóveis por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

-- Agregações separadas evitam multiplicação cartesiana entre favoritos, leads e visitas.
drop view if exists public.agency_property_commercial_performance;
create view public.agency_property_commercial_performance
with (security_invoker = true)
as
with favorite_metrics as (
  select
    f.property_id,
    count(distinct f.user_id)::bigint as favorites_count
  from public.favorites f
  group by f.property_id
),
lead_metrics as (
  select
    l.agency_id,
    l.property_id,
    count(*)::bigint as leads_count,
    count(*) filter (where l.status='won')::bigint as won_count,
    count(*) filter (where l.created_at >= now()-interval '30 days')::bigint as leads_last_30d
  from public.leads l
  where l.property_id is not null
  group by l.agency_id,l.property_id
),
visit_metrics as (
  select
    v.agency_id,
    v.property_id,
    count(*) filter (where v.status in ('scheduled','completed','no_show'))::bigint as visits_count,
    count(*) filter (where v.status='completed')::bigint as completed_visits_count,
    count(*) filter (where v.status='scheduled' and v.scheduled_at >= now())::bigint as upcoming_visits_count
  from public.property_visit_appointments v
  where v.property_id is not null
  group by v.agency_id,v.property_id
)
select
  p.agency_id,
  p.id as property_id,
  p.code,
  p.title,
  p.status,
  p.publication_state,
  p.price,
  p.published_at,
  coalesce(fm.favorites_count,0)::bigint as favorites_count,
  coalesce(lm.leads_count,0)::bigint as leads_count,
  coalesce(vm.visits_count,0)::bigint as visits_count,
  coalesce(vm.completed_visits_count,0)::bigint as completed_visits_count,
  coalesce(vm.upcoming_visits_count,0)::bigint as upcoming_visits_count,
  coalesce(lm.won_count,0)::bigint as won_count,
  coalesce(lm.leads_last_30d,0)::bigint as leads_last_30d,
  case when p.published_at is null then null else floor(extract(epoch from (now()-p.published_at))/86400)::integer end as days_published
from public.properties p
left join favorite_metrics fm on fm.property_id=p.id
left join lead_metrics lm on lm.agency_id=p.agency_id and lm.property_id=p.id
left join visit_metrics vm on vm.agency_id=p.agency_id and vm.property_id=p.id;

revoke all on public.agency_property_commercial_performance from public,anon;
grant select on public.agency_property_commercial_performance to authenticated;
