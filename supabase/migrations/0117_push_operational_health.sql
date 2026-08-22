-- Saúde operacional global do push.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace view public.platform_push_operational_health
with (security_invoker=true)
as
select
  (select count(*)::bigint from public.device_push_tokens where enabled=true) as active_devices,
  (select count(*)::bigint from public.app_notifications where push_sent_at is null and push_attempts<5) as pending_notifications,
  (select count(*)::bigint from public.app_notifications where push_sent_at is null and push_attempts<5 and created_at<now()-interval '15 minutes') as stale_notifications,
  (select count(*)::bigint from public.app_notifications where push_sent_at is null and push_attempts>=5) as exhausted_notifications,
  (select count(*)::bigint from public.app_notifications where push_sent_at>=now()-interval '24 hours') as sent_last_24h,
  (select max(push_sent_at) from public.app_notifications) as last_push_sent_at;

revoke all on public.platform_push_operational_health from public,anon;
grant select on public.platform_push_operational_health to authenticated;

comment on view public.platform_push_operational_health is 'Saude global da fila de push: dispositivos ativos, pendencias, atrasos, tentativas esgotadas e ultima entrega.';
