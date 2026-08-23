-- Hardening final após auditoria real do Supabase Advisor.
-- Fecha execução anônima implícita em funções públicas e reabre somente RPCs deliberadamente públicos.
-- Também corrige search_path de trigger utilitário e endurece o registro de releases.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

-- PostgreSQL concede EXECUTE em novas funções para PUBLIC por padrão. Removemos primeiro
-- o privilégio global implícito e também qualquer grant direto do papel anon; depois
-- reabrimos explicitamente somente a superfície pública necessária ao site/onboarding.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- RPCs deliberadamente públicos do site/onboarding.
grant execute on function public.create_public_lead_for_host(text,uuid,text,text,text,text,text) to anon;
grant execute on function public.public_catalog_for_host(text) to anon;
grant execute on function public.public_property_for_host(text,uuid) to anon;
grant execute on function public.public_property_photos_for_host(text,uuid) to anon;
grant execute on function public.resolve_agency_by_host(text) to anon;
grant execute on function public.resolve_agency_by_slug(text) to anon;
grant execute on function public.agency_slug_available(text) to anon;
grant execute on function public.platform_registration_status() to anon;
grant execute on function public.platform_public_catalog_status() to anon;
grant execute on function public.public_catalog_runtime_enabled() to anon;
grant execute on function public.public_registration_runtime_enabled() to anon;
grant execute on function public.initial_admin_available() to anon;
grant execute on function public.project_identity() to anon;

-- Trigger utilitário com search_path fixo.
alter function public.set_updated_at() set search_path = public;

-- Releases: leitura, criação e atualização por platform admin; exclusão não faz parte do fluxo operacional.
drop policy if exists "platform admins manage deployment releases" on public.platform_deployment_releases;
drop policy if exists "platform admins read deployment releases" on public.platform_deployment_releases;
drop policy if exists "platform admins insert deployment releases" on public.platform_deployment_releases;
drop policy if exists "platform admins update deployment releases" on public.platform_deployment_releases;

create policy "platform admins read deployment releases"
on public.platform_deployment_releases
for select to authenticated
using(public.is_platform_admin());

create policy "platform admins insert deployment releases"
on public.platform_deployment_releases
for insert to authenticated
with check(public.is_platform_admin());

create policy "platform admins update deployment releases"
on public.platform_deployment_releases
for update to authenticated
using(public.is_platform_admin())
with check(public.is_platform_admin());

revoke delete on public.platform_deployment_releases from authenticated;
grant select,insert,update on public.platform_deployment_releases to authenticated;

-- Uma release só pode ficar ativa depois de smoke aprovado.
create or replace function public.normalize_platform_deployment_release()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.commit_sha:=lower(trim(new.commit_sha));
  if new.deployed_by is null then new.deployed_by:=auth.uid(); end if;
  if new.smoke_status in ('passed','failed') and new.smoke_checked_at is null then new.smoke_checked_at:=now(); end if;
  if new.smoke_status='pending' then new.smoke_checked_at:=null; end if;

  if new.active and new.smoke_status<>'passed' then
    raise exception 'Release só pode ser ativada depois que o smoke test estiver aprovado.';
  end if;

  if new.active then
    update public.platform_deployment_releases
      set active=false
    where environment_mode=new.environment_mode
      and id is distinct from new.id
      and active=true;
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_platform_deployment_release() from public,anon,authenticated;

comment on function public.normalize_platform_deployment_release() is
'Normaliza releases e impede ativação antes de smoke_status=passed.';
