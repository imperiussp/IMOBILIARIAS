-- Endurece a promoção para produção com segurança multi-tenant e manutenção bem-sucedida.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.guard_platform_production_promotion()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  last_successful_maintenance timestamptz;
  stale_provider_events bigint:=0;
  tenant_security_failures integer:=0;
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
      raise exception 'Produção bloqueada: é necessária uma manutenção BEM-SUCEDIDA nas últimas 24 horas.';
    end if;

    select count(*)::bigint into stale_provider_events
    from public.outreach_provider_event_inbox
    where processed_at is null
      and abandoned_at is null
      and received_at < now()-interval '30 minutes';

    if stale_provider_events > 0 then
      raise exception 'Produção bloqueada: existem % evento(s) de provedor atrasado(s) aguardando reconciliação.', stale_provider_events;
    end if;

    select count(*)::integer into tenant_security_failures
    from public.platform_tenant_security_audit()
    where status='critical';

    if tenant_security_failures > 0 then
      raise exception 'Produção bloqueada: a auditoria multi-imobiliária encontrou % falha(s) crítica(s) de isolamento.', tenant_security_failures;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_platform_production_promotion() from public,anon,authenticated;

comment on function public.guard_platform_production_promotion() is
'Bloqueia promoção para produção sem manutenção bem-sucedida recente, fila técnica saudável, release documentada e isolamento multi-tenant estrutural aprovado.';
