-- A ativacao da assinatura ocorre em funcao SECURITY DEFINER apos o checkout
-- estar marcado como paid. O trigger de protecao deve permitir somente a
-- transicao segura para active quando ja existir assinatura ativa e vigente.
create or replace function public.protect_agency_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;

  if new.slug is distinct from old.slug then
    raise exception 'O endereço padrão da imobiliária não pode ser alterado por esta operação.';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'active'
       and exists (
         select 1
         from public.agency_subscriptions s
         where s.agency_id = old.id
           and s.status = 'active'
           and (s.ends_at is null or s.ends_at > now())
       ) then
      return new;
    end if;

    raise exception 'O status da imobiliária é controlado pela plataforma.';
  end if;

  return new;
end;
$$;
