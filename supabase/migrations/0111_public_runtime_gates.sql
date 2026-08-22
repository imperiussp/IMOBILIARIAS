-- RPCs publicas estreitas para o front respeitar os freios globais sem expor configuracoes sensiveis.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.platform_registration_status()
returns table(enabled boolean, environment_mode text, release_label text)
language sql
stable
security definer
set search_path=public
as $$
  select
    (not maintenance_mode and new_registrations_enabled) as enabled,
    environment_mode,
    release_label
  from public.platform_release_controls
  where id=1;
$$;
revoke all on function public.platform_registration_status() from public;
grant execute on function public.platform_registration_status() to anon,authenticated;

create or replace function public.platform_public_catalog_status()
returns table(enabled boolean, maintenance_mode boolean, environment_mode text)
language sql
stable
security definer
set search_path=public
as $$
  select
    (not maintenance_mode and public_catalog_enabled) as enabled,
    maintenance_mode,
    environment_mode
  from public.platform_release_controls
  where id=1;
$$;
revoke all on function public.platform_public_catalog_status() from public;
grant execute on function public.platform_public_catalog_status() to anon,authenticated;

comment on function public.platform_registration_status() is 'Expõe somente o estado necessário para abrir ou bloquear novos cadastros públicos.';
comment on function public.platform_public_catalog_status() is 'Expõe somente o estado necessário para abrir ou bloquear o catálogo público.';
