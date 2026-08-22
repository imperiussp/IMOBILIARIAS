-- Diagnostico de pre-voo para homologacao e producao.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

drop view if exists public.platform_homologation_readiness;
create view public.platform_homologation_readiness
with (security_invoker=true)
as
with controls as (
  select * from public.platform_release_controls where id=1
), maintenance as (
  select max(started_at) as last_run from public.platform_maintenance_runs
), provider_queue as (
  select
    count(*) filter(where processed_at is null and abandoned_at is null)::bigint as pending,
    count(*) filter(where processed_at is null and abandoned_at is null and received_at < now()-interval '30 minutes')::bigint as stale
  from public.outreach_provider_event_inbox
), billing as (
  select count(*) filter(where processing_status='failed')::bigint as failed from public.billing_events
), domains as (
  select count(*) filter(where kind='custom' and verified=false)::bigint as pending_custom from public.agency_domains
)
select * from (
  select 10 as sort_order,'environment_mode'::text as check_key,'Ambiente identificado'::text as label,
    (c.environment_mode in ('development','homologation','production')) as ok,
    ('Modo atual: '||c.environment_mode)::text as detail,'required'::text as severity from controls c
  union all
  select 20,'homologation_guard','Freios de homologação ativos',
    (not c.real_billing_enabled and not c.external_messaging_enabled),
    case when not c.real_billing_enabled and not c.external_messaging_enabled then 'Cobrança real e mensageria externa bloqueadas.' else 'Há recurso externo sensível liberado.' end,
    'required' from controls c
  union all
  select 30,'public_catalog','Catálogo público disponível',c.public_catalog_enabled,
    case when c.public_catalog_enabled then 'Pode exibir imóveis publicados durante homologação.' else 'Catálogo público está bloqueado.' end,
    'recommended' from controls c
  union all
  select 40,'maintenance_mode','Modo manutenção desligado',not c.maintenance_mode,
    case when c.maintenance_mode then 'Sistema está em modo manutenção.' else 'Operação normal permitida.' end,
    'required' from controls c
  union all
  select 50,'maintenance_recent','Manutenção automática recente',
    (m.last_run is not null and m.last_run >= now()-interval '24 hours'),
    case when m.last_run is null then 'Ainda não existe execução registrada.' else 'Última execução: '||to_char(m.last_run at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') end,
    'recommended' from maintenance m
  union all
  select 60,'provider_queue','Fila técnica de provedores saudável',coalesce(p.stale,0)=0,
    (coalesce(p.pending,0)||' pendente(s); '||coalesce(p.stale,0)||' atrasado(s).')::text,
    'recommended' from provider_queue p
  union all
  select 70,'billing_failures','Sem falhas financeiras pendentes',coalesce(b.failed,0)=0,
    (coalesce(b.failed,0)||' falha(s) financeira(s) registrada(s).')::text,
    'recommended' from billing b
  union all
  select 80,'custom_domains','Domínios personalizados sem pendência',coalesce(d.pending_custom,0)=0,
    (coalesce(d.pending_custom,0)||' domínio(s) personalizado(s) aguardando verificação.')::text,
    'optional' from domains d
) checks;

revoke all on public.platform_homologation_readiness from public,anon;
grant select on public.platform_homologation_readiness to authenticated;

comment on view public.platform_homologation_readiness is 'Checklist calculado de homologacao. Não ativa recursos nem realiza deploy; apenas diagnostica o estado atual.';
