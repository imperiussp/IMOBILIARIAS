-- Cadastro self-service de uma nova imobiliária na plataforma SaaS.
-- A criação nasce dos metadados do usuário no Auth e já gera o tenant + domínio padrão.

create or replace function public.normalize_agency_slug(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      lower(translate(
        coalesce(p_value, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
      )),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-+', '-', 'g'
  ))
$$;

create or replace function public.is_reserved_agency_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(coalesce(p_slug, '')) = any(array[
    'www','app','api','admin','administracao','painel','login','cadastro','conta',
    'suporte','ajuda','status','mail','email','smtp','ftp','cdn','assets','static',
    'imoveis','lenoy','sistema','sistemas','cliente','clientes','corretor','corretores'
  ]::text[])
$$;

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
begin
  requested_kind := coalesce(new.raw_user_meta_data ->> 'onboarding_kind', '');
  if requested_kind <> 'agency_owner' then
    return new;
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

drop trigger if exists on_auth_user_created_agency_owner on auth.users;
create trigger on_auth_user_created_agency_owner
after insert on auth.users
for each row execute function public.handle_new_agency_owner();

create or replace function public.agency_slug_available(p_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := public.normalize_agency_slug(p_slug);
  if length(normalized) < 3 or length(normalized) > 48 or public.is_reserved_agency_slug(normalized) then
    return false;
  end if;
  return not exists (select 1 from public.agencies a where a.slug = normalized);
end;
$$;

grant execute on function public.agency_slug_available(text) to anon, authenticated;
