-- Produção exige uma release de homologação realmente implantada e validada.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.guard_platform_production_promotion()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  last_success timestamptz;
  stale_provider_events bigint:=0;
  tenant_security_critical bigint:=0;
  required_validations_pending bigint:=0;
  deployment_pending bigint:=0;
  validated_release_count bigint:=0;
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

    select max(started_at) into last_success
    from public.platform_maintenance_runs
    where success=true;
    if last_success is null or last_success < now()-interval '24 hours' then
      raise exception 'Produção bloqueada: é necessária uma manutenção bem-sucedida nas últimas 24 horas.';
    end if;

    select count(*)::bigint into stale_provider_events
    from public.outreach_provider_event_inbox
    where processed_at is null and abandoned_at is null and received_at < now()-interval '30 minutes';
    if stale_provider_events > 0 then
      raise exception 'Produção bloqueada: existem % evento(s) de provedor atrasado(s).', stale_provider_events;
    end if;

    select count(*)::bigint into tenant_security_critical
    from public.platform_tenant_security_audit()
    where critical=true and ok=false;
    if tenant_security_critical > 0 then
      raise exception 'Produção bloqueada: existem % falha(s) crítica(s) na auditoria multi-imobiliária.', tenant_security_critical;
    end if;

    select count(*)::bigint into required_validations_pending
    from public.platform_release_validations
    where required_for_production=true and validated=false;
    if required_validations_pending > 0 then
      raise exception 'Produção bloqueada: existem % evidência(s) obrigatória(s) de homologação pendentes.', required_validations_pending;
    end if;

    select count(*)::bigint into deployment_pending
    from public.platform_deployment_checkpoints
    where required_for_production=true and completed=false;
    if deployment_pending > 0 then
      raise exception 'Produção bloqueada: existem % checkpoint(s) de implantação obrigatórios pendentes.', deployment_pending;
    end if;

    select count(*)::bigint into validated_release_count
    from public.platform_deployment_releases
    where environment_mode='homologation'
      and active=true
      and smoke_status='passed'
      and smoke_checked_at is not null;
    if validated_release_count=0 then
      raise exception 'Produção bloqueada: registre uma release ativa de homologação com smoke test aprovado.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_platform_production_promotion() from public,anon,authenticated;

comment on function public.guard_platform_production_promotion() is 'Trava final: produção exige infraestrutura, evidências, isolamento e release ativa de homologação com smoke aprovado.';
