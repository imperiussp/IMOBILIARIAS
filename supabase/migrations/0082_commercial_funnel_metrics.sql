-- Indicadores comerciais e de conversão por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create or replace view public.agency_commercial_funnel as
select
  l.agency_id,
  count(*)::bigint as total_leads,
  count(*) filter (where l.status='new')::bigint as new_leads,
  count(*) filter (where l.status='contacted')::bigint as contacted_leads,
  count(*) filter (where l.status='visit_scheduled')::bigint as visits_scheduled,
  count(*) filter (where l.status='won')::bigint as won_leads,
  count(*) filter (where l.status='lost')::bigint as lost_leads,
  count(*) filter (where l.created_at >= now()-interval '7 days')::bigint as leads_last_7d,
  count(*) filter (where l.created_at >= date_trunc('month',now()))::bigint as leads_this_month,
  round(
    case when count(*) filter (where l.status in ('won','lost')) > 0
      then 100.0 * count(*) filter (where l.status='won') / count(*) filter (where l.status in ('won','lost'))
      else 0 end,
    1
  ) as close_rate_percent,
  round(
    case when count(*) > 0
      then 100.0 * count(*) filter (where l.status='visit_scheduled') / count(*)
      else 0 end,
    1
  ) as visit_rate_percent
from public.leads l
group by l.agency_id;

revoke all on public.agency_commercial_funnel from public,anon;
grant select on public.agency_commercial_funnel to authenticated;

create or replace view public.agency_lead_source_performance as
select
  l.agency_id,
  coalesce(nullif(trim(l.source),''),'outro') as source,
  count(*)::bigint as total,
  count(*) filter (where l.status='won')::bigint as won,
  count(*) filter (where l.status='lost')::bigint as lost,
  round(
    case when count(*) filter (where l.status in ('won','lost')) > 0
      then 100.0 * count(*) filter (where l.status='won') / count(*) filter (where l.status in ('won','lost'))
      else 0 end,
    1
  ) as close_rate_percent
from public.leads l
group by l.agency_id,coalesce(nullif(trim(l.source),''),'outro');

revoke all on public.agency_lead_source_performance from public,anon;
grant select on public.agency_lead_source_performance to authenticated;
