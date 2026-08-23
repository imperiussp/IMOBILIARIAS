-- Pré-voo v4: infraestrutura real passa a fazer parte da prontidão.
-- Produção também exige os checkpoints marcados como required_for_production.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.guard_platform_production_promotion()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  last_successful_maintenance timestamptz;
  stale_provider_events bigint:=0;
  tenant_security_failures bigint:=0;
  validation_failures bigint:=0;
  deployment_failures bigint:=0;
begin
  if new.environment_mode='production' and old.environment_mode is distinct from 'production' then
    if new.maintenance_mode then
      raise exception 'Produção bloqueada: desligue o modo manutenção antes de promover o ambiente.';
    end if;
    if not new.public_catalog_enabled then
      raise exception 'Produção bloqueada: o catálogo público deve estar liberado antes da promoção.';
    end if;
    if length(trim(coalesce(new.release_label,''))) < 4 then
      raise exception 'Produção bloqueada: informe uma identificação de versão/release.';
    end if;
    if length(trim(coalesce(new.release_notes,''))) < 20 then
      raise exception 'Produção bloqueada: registre nas observações o motivo e o escopo da promoção.';
    end if;

    select max(started_at) into last_successful_maintenance
    from public.platform_maintenance_runs
    where success=true;
    if last_successful_maintenance is null or last_successful_maintenance < now()-interval '24 hours' then
      raise exception 'Produção bloqueada: é necessária uma execução de manutenção bem-sucedida nas últimas 24 horas.';
    end if;

    select count(*)::bigint into stale_provider_events
    from public.outreach_provider_event_inbox
    where processed_at is null and abandoned_at is null and received_at < now()-interval '30 minutes';
    if stale_provider_events > 0 then
      raise exception 'Produção bloqueada: existem % evento(s) de provedor atrasado(s) aguardando reconciliação.', stale_provider_events;
    end if;

    select count(*)::bigint into tenant_security_failures
    from public.platform_tenant_security_audit()
    where status='critical';
    if tenant_security_failures > 0 then
      raise exception 'Produção bloqueada: a auditoria multi-imobiliária encontrou % falha(s) crítica(s).', tenant_security_failures;
    end if;

    select count(*)::bigint into validation_failures
    from public.platform_release_validations
    where required_for_production and not validated;
    if validation_failures > 0 then
      raise exception 'Produção bloqueada: existem % validação(ões) obrigatória(s) de homologação pendente(s).', validation_failures;
    end if;

    select count(*)::bigint into deployment_failures
    from public.platform_deployment_checkpoints
    where required_for_production and not completed;
    if deployment_failures > 0 then
      raise exception 'Produção bloqueada: existem % checkpoint(s) obrigatório(s) de implantação pendente(s).', deployment_failures;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_platform_production_promotion() from public,anon,authenticated;

-- Recria o Pré-voo agregando as verificações anteriores e o estado da implantação.
drop view if exists public.platform_release_readiness_summary;
drop view if exists public.platform_homologation_readiness;

create view public.platform_homologation_readiness
with (security_invoker=true)
as
with controls as (
  select * from public.platform_release_controls where id=1
), maintenance as (
  select started_at,success,failed_tasks from public.platform_maintenance_runs order by started_at desc limit 1
), provider_queue as (
  select count(*) filter(where processed_at is null and abandoned_at is null)::bigint as pending,
         count(*) filter(where processed_at is null and abandoned_at is null and received_at < now()-interval '30 minutes')::bigint as stale
  from public.outreach_provider_event_inbox
), billing as (
  select count(*) filter(where processing_status='failed')::bigint as failed from public.billing_events
), domains as (
  select count(*) filter(where kind='custom' and verified=false)::bigint as pending_custom from public.agency_domains
), tenant_security as (
  select count(*) filter(where status='critical')::bigint as critical_failures from public.platform_tenant_security_audit()
), validations as (
  select count(*) filter(where required_for_production and not validated)::bigint as required_pending from public.platform_release_validations
), deployment as (
  select count(*) filter(where required_for_network and not completed)::bigint as network_pending,
         count(*) filter(where required_for_production and not completed)::bigint as production_pending
  from public.platform_deployment_checkpoints
)
select * from (
  select 10 as sort_order,'environment_mode'::text as check_key,'Ambiente identificado'::text as label,
    (c.environment_mode in ('development','homologation','production')) as ok,('Modo atual: '||c.environment_mode)::text as detail,'required'::text as severity from controls c
  union all
  select 15,'release_identity','Release identificada e documentada',
    (length(trim(coalesce(c.release_label,'')))>=4 and length(trim(coalesce(c.release_notes,'')))>=20),
    case when length(trim(coalesce(c.release_notes,'')))>=20 then 'Identificação e observações registradas.' else 'Inclua identificação e ao menos 20 caracteres de observações da release.' end,
    case when c.environment_mode='production' then 'required' else 'recommended' end from controls c
  union all
  select 20,'homologation_guard','Freios externos coerentes com o ambiente',
    case when c.environment_mode='production' then true else (not c.real_billing_enabled and not c.external_messaging_enabled and not c.ai_generation_enabled and not c.push_notifications_enabled) end,
    case when c.environment_mode='production' then 'Produção pode liberar integrações individualmente.' when not c.real_billing_enabled and not c.external_messaging_enabled and not c.ai_generation_enabled and not c.push_notifications_enabled then 'Cobrança, mensageria, IA e push permanecem bloqueados.' else 'Há recurso externo sensível liberado fora de produção.' end,
    'required' from controls c
  union all
  select 25,'deployment_network','Infraestrutura necessária para homologação online',coalesce(d.network_pending,0)=0,
    (coalesce(d.network_pending,0)||' checkpoint(s) de rede pendente(s).')::text,
    case when c.environment_mode='development' then 'recommended' else 'required' end from controls c cross join deployment d
  union all
  select 30,'public_catalog','Catálogo público disponível',c.public_catalog_enabled,
    case when c.public_catalog_enabled then 'Catálogo público liberado.' else 'Catálogo público está bloqueado.' end,
    case when c.environment_mode='production' then 'required' else 'recommended' end from controls c
  union all
  select 40,'maintenance_mode','Modo manutenção desligado',not c.maintenance_mode,
    case when c.maintenance_mode then 'Sistema está em modo manutenção.' else 'Operação normal permitida.' end,'required' from controls c
  union all
  select 50,'maintenance_recent','Manutenção automática recente',(m.started_at is not null and m.started_at>=now()-interval '24 hours'),
    case when m.started_at is null then 'Ainda não existe execução registrada.' else 'Última execução: '||to_char(m.started_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') end,
    case when c.environment_mode='production' then 'required' else 'recommended' end from controls c left join maintenance m on true
  union all
  select 55,'maintenance_success','Última manutenção concluída sem falhas',coalesce(m.success,false),
    case when m.started_at is null then 'Nenhuma execução disponível para validar.' when m.success then 'Última manutenção finalizou com sucesso.' else 'Última manutenção registrou '||coalesce(m.failed_tasks,0)||' tarefa(s) com falha.' end,
    case when c.environment_mode='production' then 'required' else 'recommended' end from controls c left join maintenance m on true
  union all
  select 60,'provider_queue','Fila técnica de provedores saudável',coalesce(p.stale,0)=0,
    (coalesce(p.pending,0)||' pendente(s); '||coalesce(p.stale,0)||' atrasado(s).')::text,
    case when c.environment_mode='production' then 'required' else 'recommended' end from controls c cross join provider_queue p
  union all
  select 65,'tenant_security','Isolamento multi-imobiliária sem falhas críticas',coalesce(t.critical_failures,0)=0,
    (coalesce(t.critical_failures,0)||' falha(s) crítica(s) na auditoria estrutural.')::text,'required' from tenant_security t
  union all
  select 67,'required_validations','Testes obrigatórios de homologação validados',coalesce(v.required_pending,0)=0,
    (coalesce(v.required_pending,0)||' validação(ões) obrigatória(s) pendente(s).')::text,
    case when c.environment_mode='production' then 'required' else 'recommended' end from controls c cross join validations v
  union all
  select 68,'deployment_production','Infraestrutura obrigatória de produção concluída',coalesce(d.production_pending,0)=0,
    (coalesce(d.production_pending,0)||' checkpoint(s) obrigatório(s) de produção pendente(s).')::text,
    case when c.environment_mode='production' then 'required' else 'recommended' end from controls c cross join deployment d
  union all
  select 70,'billing_failures','Sem falhas financeiras pendentes',coalesce(b.failed,0)=0,(coalesce(b.failed,0)||' falha(s) financeira(s) registrada(s).')::text,'recommended' from billing b
  union all
  select 80,'custom_domains','Domínios personalizados sem pendência',coalesce(d.pending_custom,0)=0,(coalesce(d.pending_custom,0)||' domínio(s) personalizado(s) aguardando verificação.')::text,'optional' from domains d
  union all
  select 90,'production_audit','Promoção para produção registrada',case when c.environment_mode='production' then c.production_activated_at is not null else true end,
    case when c.environment_mode<>'production' then 'Ainda não promovido para produção.' when c.production_activated_at is null then 'Produção ativa sem timestamp de promoção.' else 'Produção promovida em '||to_char(c.production_activated_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') end,'required' from controls c
) checks;

create view public.platform_release_readiness_summary
with (security_invoker=true)
as
select count(*)::int as total_checks,
  count(*) filter(where ok)::int as passed_checks,
  count(*) filter(where not ok and severity='required')::int as blockers,
  count(*) filter(where not ok and severity='recommended')::int as recommendations,
  count(*) filter(where not ok and severity='optional')::int as optional_pending,
  case when count(*)=0 then 0 else round((count(*) filter(where ok)::numeric/count(*)::numeric)*100)::int end as readiness_percent
from public.platform_homologation_readiness;

revoke all on public.platform_homologation_readiness from public,anon;
revoke all on public.platform_release_readiness_summary from public,anon;
grant select on public.platform_homologation_readiness to authenticated;
grant select on public.platform_release_readiness_summary to authenticated;

comment on view public.platform_homologation_readiness is 'Pré-voo v4 incluindo implantação real, isolamento multi-tenant e evidências funcionais.';
