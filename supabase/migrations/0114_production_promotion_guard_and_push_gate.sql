-- Promocao segura para producao + controle independente de push.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

alter table public.platform_release_controls
  add column if not exists push_notifications_enabled boolean not null default false,
  add column if not exists production_activated_at timestamptz,
  add column if not exists production_activated_by uuid references auth.users(id) on delete set null;

alter table public.platform_release_control_history
  add column if not exists push_notifications_enabled boolean not null default false;

create or replace function public.capture_platform_release_control_history()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.updated_at:=now();
  new.updated_by:=auth.uid();

  if new.environment_mode='production' and old.environment_mode is distinct from 'production' then
    new.production_activated_at:=now();
    new.production_activated_by:=auth.uid();
  end if;

  insert into public.platform_release_control_history(
    environment_mode,maintenance_mode,public_catalog_enabled,new_registrations_enabled,
    real_billing_enabled,external_messaging_enabled,ai_generation_enabled,push_notifications_enabled,
    release_label,release_notes,changed_by
  ) values (
    new.environment_mode,new.maintenance_mode,new.public_catalog_enabled,new.new_registrations_enabled,
    new.real_billing_enabled,new.external_messaging_enabled,new.ai_generation_enabled,new.push_notifications_enabled,
    new.release_label,new.release_notes,auth.uid()
  );
  return new;
end;
$$;
revoke all on function public.capture_platform_release_control_history() from public,anon,authenticated;

create or replace function public.guard_platform_production_promotion()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  last_maintenance timestamptz;
  stale_provider_events bigint:=0;
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

    select max(started_at) into last_maintenance from public.platform_maintenance_runs;
    if last_maintenance is null or last_maintenance < now()-interval '24 hours' then
      raise exception 'Produção bloqueada: é necessária ao menos uma execução de manutenção nas últimas 24 horas.';
    end if;

    select count(*)::bigint into stale_provider_events
    from public.outreach_provider_event_inbox
    where processed_at is null
      and abandoned_at is null
      and received_at < now()-interval '30 minutes';

    if stale_provider_events > 0 then
      raise exception 'Produção bloqueada: existem % evento(s) de provedor atrasado(s) aguardando reconciliação.', stale_provider_events;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_platform_production_promotion() from public,anon,authenticated;

drop trigger if exists platform_release_production_guard on public.platform_release_controls;
create trigger platform_release_production_guard
before update on public.platform_release_controls
for each row execute function public.guard_platform_production_promotion();

create or replace function public.platform_runtime_flag(p_flag text)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare v public.platform_release_controls%rowtype;
begin
  select * into v from public.platform_release_controls where id=1;
  if not found then return false; end if;
  return case p_flag
    when 'maintenance_mode' then v.maintenance_mode
    when 'public_catalog_enabled' then v.public_catalog_enabled
    when 'new_registrations_enabled' then v.new_registrations_enabled
    when 'real_billing_enabled' then v.real_billing_enabled
    when 'external_messaging_enabled' then v.external_messaging_enabled
    when 'ai_generation_enabled' then v.ai_generation_enabled
    when 'push_notifications_enabled' then v.push_notifications_enabled
    else false
  end;
end;
$$;
revoke all on function public.platform_runtime_flag(text) from public,anon;
grant execute on function public.platform_runtime_flag(text) to authenticated;

comment on column public.platform_release_controls.push_notifications_enabled is 'Freio global independente para notificacoes push do aplicativo.';
comment on function public.guard_platform_production_promotion() is 'Impede promocao acidental para producao sem catalogo, manutencao recente, fila de provedores saudavel e justificativa de release.';
