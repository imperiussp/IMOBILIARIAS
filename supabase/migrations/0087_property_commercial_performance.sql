-- Desempenho comercial dos imóveis por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

drop view if exists public.agency_property_commercial_performance;
create view public.agency_property_commercial_performance
with (security_invoker = true)
as
select
  p.agency_id,
  p.id as property_id,
  p.code,
  p.title,
  p.status,
  p.publication_state,
  p.price,
  p.published_at,
  count(distinct f.user_id)::bigint as favorites_count,
  count(distinct l.id)::bigint as leads_count,
  count(distinct l.id) filter (where l.status='visit_scheduled')::bigint as visits_count,
  count(distinct l.id) filter (where l.status='won')::bigint as won_count,
  count(distinct l.id) filter (where l.created_at >= now()-interval '30 days')::bigint as leads_last_30d,
  case when p.published_at is null then null else floor(extract(epoch from (now()-p.published_at))/86400)::integer end as days_published
from public.properties p
left join public.favorites f on f.property_id=p.id
left join public.leads l on l.property_id=p.id and l.agency_id=p.agency_id
group by p.agency_id,p.id,p.code,p.title,p.status,p.publication_state,p.price,p.published_at;

revoke all on public.agency_property_commercial_performance from public,anon;
grant select on public.agency_property_commercial_performance to authenticated;
