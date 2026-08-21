-- Regras SaaS para identidade da imobiliária e domínios próprios.
-- Clientes podem editar sua marca, mas não podem alterar slug/status do tenant
-- nem marcar um domínio como verificado por conta própria.

create policy "tenant managers update own agency branding" on public.agencies
for update to authenticated
using (public.can_manage_agency(id))
with check (public.can_manage_agency(id));

create or replace function public.protect_agency_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.slug is distinct from old.slug then
    raise exception 'O endereço padrão da imobiliária não pode ser alterado por esta operação.';
  end if;
  if new.status is distinct from old.status then
    raise exception 'O status da imobiliária é controlado pela plataforma.';
  end if;
  return new;
end;
$$;

drop trigger if exists agencies_protect_system_fields_trigger on public.agencies;
create trigger agencies_protect_system_fields_trigger
before update on public.agencies
for each row execute function public.protect_agency_system_fields();

create or replace function public.normalize_domain_hostname()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.hostname := lower(trim(new.hostname));
  new.hostname := regexp_replace(new.hostname, '^https?://', '');
  new.hostname := regexp_replace(new.hostname, '/.*$', '');
  new.hostname := regexp_replace(new.hostname, ':\d+$', '');

  if new.hostname = '' or position('.' in new.hostname) = 0 then
    raise exception 'Domínio inválido.';
  end if;

  if new.kind = 'custom' and (new.hostname = 'imoveis.lenoy.com.br' or new.hostname like '%.imoveis.lenoy.com.br') then
    raise exception 'Endereços da plataforma são reservados.';
  end if;

  if not public.is_admin() then
    if new.kind <> 'custom' then
      raise exception 'Somente a plataforma pode criar domínios internos.';
    end if;
    if new.verified = true or new.verified_at is not null then
      raise exception 'A verificação do domínio é feita pela plataforma.';
    end if;
    if new.is_primary = true then
      raise exception 'O domínio principal só pode ser definido após verificação.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists agency_domains_normalize_trigger on public.agency_domains;
create trigger agency_domains_normalize_trigger
before insert or update on public.agency_domains
for each row execute function public.normalize_domain_hostname();

create unique index if not exists agency_domains_hostname_lower_unique_idx
on public.agency_domains (lower(hostname));

-- Substitui a política ampla anterior por operações explicitamente seguras.
drop policy if exists "agency admins manage domains" on public.agency_domains;

create policy "tenant managers add custom domains" on public.agency_domains
for insert to authenticated
with check (
  public.can_manage_agency(agency_id)
  and kind = 'custom'
  and verified = false
  and verified_at is null
  and is_primary = false
);

create policy "tenant managers remove custom domains" on public.agency_domains
for delete to authenticated
using (
  public.can_manage_agency(agency_id)
  and kind = 'custom'
);

create policy "platform admins manage all domains" on public.agency_domains
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
