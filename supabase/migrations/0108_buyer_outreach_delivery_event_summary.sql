-- Resumo escalável do histórico técnico por tentativa de mensageria.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

drop view if exists public.agency_buyer_outreach_delivery_event_summary;
create view public.agency_buyer_outreach_delivery_event_summary
with (security_invoker = true)
as
select
  a.id as attempt_id,
  a.agency_id,
  a.lead_id,
  count(e.id)::bigint as event_count,
  latest.event_type as latest_event_type,
  latest.current_status as latest_current_status,
  latest.occurred_at as latest_occurred_at,
  latest.error_message as latest_error_message
from public.buyer_outreach_delivery_attempts a
left join public.buyer_outreach_delivery_events e on e.attempt_id=a.id
left join lateral (
  select e2.event_type,e2.current_status,e2.occurred_at,e2.error_message
  from public.buyer_outreach_delivery_events e2
  where e2.attempt_id=a.id
  order by e2.occurred_at desc,e2.created_at desc,e2.id desc
  limit 1
) latest on true
group by
  a.id,a.agency_id,a.lead_id,
  latest.event_type,latest.current_status,latest.occurred_at,latest.error_message;

revoke all on public.agency_buyer_outreach_delivery_event_summary from public,anon;
grant select on public.agency_buyer_outreach_delivery_event_summary to authenticated;

comment on view public.agency_buyer_outreach_delivery_event_summary is
'Resumo tenant-scoped do histórico imutável de mensageria, respeitando RLS das tabelas-base via security_invoker.';
