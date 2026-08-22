-- Desempenho comercial por corretor e por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create or replace view public.agency_broker_performance as
select
  b.agency_id,
  b.id as broker_id,
  b.name as broker_name,
  count(distinct p.id)::bigint as properties_total,
  count(distinct p.id) filter (where p.status='available' and p.publication_state='published')::bigint as properties_available,
  count(distinct l.id)::bigint as leads_total,
  count(distinct l.id) filter (where l.status='visit_scheduled')::bigint as visits_scheduled,
  count(distinct l.id) filter (where l.status='won')::bigint as deals_won,
  count(distinct l.id) filter (where l.status='lost')::bigint as deals_lost,
  round(
    100.0 * count(distinct l.id) filter (where l.status='won') /
    nullif(count(distinct l.id) filter (where l.status in ('won','lost')),0), 1
  ) as close_rate_percent,
  round(
    avg(extract(epoch from (l.first_response_at-l.created_at))/60.0)
    filter (where l.first_response_at is not null), 1
  ) as avg_first_response_minutes
from public.brokers b
left join public.properties p on p.agency_id=b.agency_id and p.broker_id=b.id
left join public.leads l on l.agency_id=b.agency_id and l.broker_id=b.id
where b.active=true
group by b.agency_id,b.id,b.name;

revoke all on public.agency_broker_performance from public, anon;
grant select on public.agency_broker_performance to authenticated;
