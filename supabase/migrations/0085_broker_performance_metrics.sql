-- Desempenho comercial por corretor e por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.
-- Nesta etapa ainda não existe property_visit_appointments (criada em 0086),
-- portanto a primeira versão das métricas usa imóveis e leads. A 0086 amplia a
-- mesma view com métricas de visitas após criar a tabela correspondente.

drop view if exists public.agency_broker_performance;
create view public.agency_broker_performance
with (security_invoker = true)
as
with property_metrics as (
  select
    p.agency_id,
    p.broker_id,
    count(*)::bigint as properties_total,
    count(*) filter (where p.status='available' and p.publication_state='published')::bigint as properties_available
  from public.properties p
  where p.broker_id is not null
  group by p.agency_id,p.broker_id
),
lead_metrics as (
  select
    l.agency_id,
    l.broker_id,
    count(*)::bigint as leads_total,
    count(*) filter (where l.status='won')::bigint as deals_won,
    count(*) filter (where l.status='lost')::bigint as deals_lost,
    round(100.0 * count(*) filter (where l.status='won') / nullif(count(*) filter (where l.status in ('won','lost')),0),1) as close_rate_percent,
    round(avg(extract(epoch from (l.first_response_at-l.created_at))/60.0) filter (where l.first_response_at is not null),1) as avg_first_response_minutes
  from public.leads l
  where l.broker_id is not null
  group by l.agency_id,l.broker_id
)
select
  b.agency_id,
  b.id as broker_id,
  b.name as broker_name,
  coalesce(pm.properties_total,0)::bigint as properties_total,
  coalesce(pm.properties_available,0)::bigint as properties_available,
  coalesce(lm.leads_total,0)::bigint as leads_total,
  0::bigint as visits_scheduled,
  0::bigint as visits_completed,
  0::bigint as visits_no_show,
  coalesce(lm.deals_won,0)::bigint as deals_won,
  coalesce(lm.deals_lost,0)::bigint as deals_lost,
  coalesce(lm.close_rate_percent,0) as close_rate_percent,
  coalesce(lm.avg_first_response_minutes,0) as avg_first_response_minutes
from public.brokers b
left join property_metrics pm on pm.agency_id=b.agency_id and pm.broker_id=b.id
left join lead_metrics lm on lm.agency_id=b.agency_id and lm.broker_id=b.id
where b.active=true;

revoke all on public.agency_broker_performance from public, anon;
grant select on public.agency_broker_performance to authenticated;
