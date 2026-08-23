-- Bootstrap seguro e temporário para criar owners de homologação sem abrir cadastro público.
-- O token é armazenado somente como SHA-256, expira e é consumido atomicamente no trigger de Auth.

create table if not exists public.platform_owner_bootstrap_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  purpose text not null default 'agency_owner' check (purpose = 'agency_owner'),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint platform_owner_bootstrap_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$')
);

alter table public.platform_owner_bootstrap_tokens enable row level security;
revoke all on table public.platform_owner_bootstrap_tokens from public, anon, authenticated;

comment on table public.platform_owner_bootstrap_tokens is
'Tokens SHA-256 de uso único para bootstrap controlado de owners durante homologação; sem acesso por clientes.';

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
  requested_bootstrap text;
  final_slug text;
  new_agency_id uuid;
  bootstrap_id uuid;
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

  if maintenance_enabled then
    raise exception 'Novos cadastros de imobiliárias estão bloqueados durante manutenção.';
  end if;

  -- Em homologação fechada, permite somente token temporário válido e não utilizado.
  if not registrations_enabled then
    requested_bootstrap := trim(coalesce(new.raw_user_meta_data ->> 'bootstrap_token', ''));
    if requested_bootstrap = '' then
      raise exception 'Novos cadastros de imobiliárias estão bloqueados pelo controle global de homologação.';
    end if;

    select t.id
      into bootstrap_id
    from public.platform_owner_bootstrap_tokens t
    where t.purpose='agency_owner'
      and t.token_hash=encode(extensions.digest(requested_bootstrap,'sha256'),'hex')
      and t.used_at is null
      and t.expires_at > now()
    for update
    limit 1;

    if bootstrap_id is null then
      raise exception 'Token de homologação inválido, expirado ou já utilizado.';
    end if;
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

  if bootstrap_id is not null then
    update public.platform_owner_bootstrap_tokens
    set used_at=now(), used_by=new.id
    where id=bootstrap_id and used_at is null;
    if not found then
      raise exception 'Token de homologação já utilizado.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_agency_owner() from public, anon, authenticated;

comment on function public.handle_new_agency_owner() is
'Cria tenant self-service com cadastro público habilitado ou, durante homologação fechada, mediante token SHA-256 temporário de uso único.';
