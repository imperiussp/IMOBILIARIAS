-- Indicadores de velocidade de atendimento dos leads.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create or replace view public.agency_lead_response_performance as
with first_response as (
  select
    l.agency_id,
    l.id as lead_id,
    l.created_at,
    min(e.created_at) filter (
      where e.event_type='status_changed'
        and coalesce(e.detail->>'to','') in ('contacted','visit_scheduled','won','lost')
    ) as responded_at
  from public.leads l
  left join public.lead_activity_events e
    on e.agency_id=l.agency_id and e.lead_id=l.id
  group by l.agency_id,l.id,l.created_at
)
select
  agency_id,
  count(*)::bigint as total_leads,
  count(*) filter (where responded_at is not null)::bigint as responded_leads,
  count(*) filter (where responded_at is null)::bigint as awaiting_response,
  round(coalesce(avg(extract(epoch from (responded_at-created_at))/60.0) filter (where responded_at is not null),0),1) as avg_first_response_minutes,
  round(
    case when count(*) > 0 then
      100.0 * count(*) filter (where responded_at is not null and responded_at <= created_at + interval '24 hours') / count(*)
    else 0 end,
    1
  ) as responded_within_24h_percent,
  count(*) filter (where responded_at is null and created_at < now()-interval '24 hours')::bigint as unanswered_over_24h
from first_response
group by agency_id;

revoke all on public.agency_lead_response_performance from public,anon;
grant select on public.agency_lead_response_performance to authenticated;

create or replace view public.agency_unanswered_leads as
select
  l.agency_id,
  l.id as lead_id,
  l.name,
  l.phone,
  l.email,
  l.source,
  l.created_at,
  extract(epoch from (now()-l.created_at))/3600.0 as waiting_hours
from public.leads l
where l.status='new';

revoke all on public.agency_unanswered_leads from public,anon;
grant select on public.agency_unanswered_leads to authenticated;
