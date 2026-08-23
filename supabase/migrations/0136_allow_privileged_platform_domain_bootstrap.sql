-- Permite que rotinas internas SECURITY DEFINER da plataforma criem domínios internos,
-- sem abrir essa permissão para clientes anon/authenticated.

create or replace function public.normalize_domain_hostname()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged_backend boolean := current_user = 'postgres';
begin
  new.hostname := lower(trim(new.hostname));
  new.hostname := regexp_replace(new.hostname, '^https?://', '');
  new.hostname := regexp_replace(new.hostname, '/.*$', '');
  new.hostname := regexp_replace(new.hostname, ':\d+$', '');

  if new.hostname = '' or position('.' in new.hostname) = 0 then
    raise exception 'Domínio inválido.';
  end if;

  if new.kind = 'custom' and (
    new.hostname = 'imoveis.lenoy.com.br'
    or new.hostname like '%.imoveis.lenoy.com.br'
  ) then
    raise exception 'Endereços da plataforma são reservados.';
  end if;

  if not public.is_admin() and not privileged_backend then
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

comment on function public.normalize_domain_hostname() is
'Normaliza e protege domínios; gravações internas executadas pelo backend privilegiado postgres podem criar domínios kind=platform, enquanto anon/authenticated continuam restritos a custom não verificado.';
