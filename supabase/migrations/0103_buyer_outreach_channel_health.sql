-- Saúde de entrega por canal das oportunidades automáticas.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

drop view if exists public.agency_buyer_outreach_channel_health;
create view public.agency_buyer_outreach_channel_health
with (security_invoker = true)
as
select
  agency_id,
  channel,
  coalesce(provider,'unknown') as provider,
  count(*) filter(where attempted_at >= now()-interval '30 days')::bigint as attempts_30d,
  count(*) filter(where attempted_at >= now()-interval '30 days' and status in ('sent','delivered','read'))::bigint as sent_30d,
  count(*) filter(where attempted_at >= now()-interval '30 days' and status in ('delivered','read'))::bigint as delivered_30d,
  count(*) filter(where attempted_at >= now()-interval '30 days' and status='read')::bigint as read_30d,
  count(*) filter(where attempted_at >= now()-interval '30 days' and status='failed')::bigint as failed_30d,
  round(
    100.0 * count(*) filter(where attempted_at >= now()-interval '30 days' and status in ('delivered','read'))
    / nullif(count(*) filter(where attempted_at >= now()-interval '30 days'),0),
    1
  ) as delivery_rate_30d,
  round(
    100.0 * count(*) filter(where attempted_at >= now()-interval '30 days' and status='read')
    / nullif(count(*) filter(where attempted_at >= now()-interval '30 days'),0),
    1
  ) as read_rate_30d,
  round(
    100.0 * count(*) filter(where attempted_at >= now()-interval '30 days' and status='failed')
    / nullif(count(*) filter(where attempted_at >= now()-interval '30 days'),0),
    1
  ) as failure_rate_30d,
  max(attempted_at) as last_attempt_at
from public.buyer_outreach_delivery_attempts
group by agency_id,channel,coalesce(provider,'unknown');

revoke all on public.agency_buyer_outreach_channel_health from public,anon;
grant select on public.agency_buyer_outreach_channel_health to authenticated;
