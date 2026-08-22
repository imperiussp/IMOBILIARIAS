-- Defesa no banco contra criação de nova imobiliária durante homologação.
-- Complementa o bloqueio visual/RPC do formulário e impede bypass por chamada direta ao Auth.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.handle_new_agency_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_kind text;
  requested_name text;
  requested_slug text;
  final_slug text;
  new_agency_id uuid;
  registrations_enabled boolean := false;
  maintenance_enabled boolean := false;
begin
  requested_kind := coalesce(new.raw_user_meta_data ->> 'onboarding_kind', '');
  if requested_kind <> 'agency_owner' then
    return new;
  end if;

  select coalesce(new_registrations_enabled,false), coalesce(maintenance_mode,false)
    into registrations_enabled, maintenance_enabled
  from public.platform_release_controls
  where id=1;

  if maintenance_enabled or not registrations_enabled then
    raise exception 'Novos cadastros de imobiliárias estão bloqueados pelo controle global de homologação.';
  end if;

  if exists (
    select 1 from public.agency_memberships am
    where am.user_id = new.id and am.role = 'owner'
  ) then
    return new;
  end if;

  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'agency_name', ''));
  requested_slug := trim(coalesce(new.raw_user_meta_data ->> 'agency_slug', ''));

  if requested_name = '' then
    raise exception 'Informe o nome da imobiliária.';
  end if;

  final_slug := public.normalize_agency_slug(case when requested_slug <> '' then requested_slug else requested_name end);

  if length(final_slug) < 3 then
    raise exception 'O endereço da imobiliária deve ter pelo menos 3 caracteres.';
  end if;
  if length(final_slug) > 48 then
    raise exception 'O endereço da imobiliária deve ter no máximo 48 caracteres.';
  end if;
  if public.is_reserved_agency_slug(final_slug) then
    raise exception 'Este endereço está reservado pela plataforma.';
  end if;
  if exists (select 1 from public.agencies a where a.slug = final_slug) then
    raise exception 'Este endereço já está sendo usado por outra imobiliária.';
  end if;

  insert into public.agencies (slug, name, status)
  values (final_slug, requested_name, 'trial')
  returning id into new_agency_id;

  insert into public.agency_memberships (agency_id, user_id, role, active)
  values (new_agency_id, new.id, 'owner', true);

  insert into public.agency_domains (agency_id, hostname, kind, is_primary, verified, verified_at)
  values (
    new_agency_id,
    final_slug || '.imoveis.lenoy.com.br',
    'platform',
    true,
    true,
    now()
  );

  return new;
end;
$$;

revoke all on function public.handle_new_agency_owner() from public,anon,authenticated;

comment on function public.handle_new_agency_owner() is
'Cria tenant self-service somente quando o controle global permite novos cadastros; convites de equipe não usam onboarding_kind=agency_owner e permanecem separados.';
