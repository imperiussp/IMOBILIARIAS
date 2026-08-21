-- Domínio próprio passa a respeitar o plano da imobiliária.
-- A feature é lida de subscription_plans.features -> custom_domain.

create or replace function public.agency_can_use_custom_domain(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin() then true
    when not public.is_agency_member(p_agency_id) then false
    else coalesce((
      select case
        when lower(coalesce(sp.features ->> 'custom_domain', 'false')) in ('true','1','yes','on') then true
        else false
      end
      from public.agency_subscriptions s
      join public.subscription_plans sp on sp.id = s.plan_id
      where s.agency_id = p_agency_id
        and s.status in ('trial','active','past_due')
        and sp.active = true
      order by s.starts_at desc
      limit 1
    ), false)
  end
$$;

revoke all on function public.agency_can_use_custom_domain(uuid) from public;
grant execute on function public.agency_can_use_custom_domain(uuid) to authenticated;

create or replace function public.request_custom_agency_domain(p_agency_id uuid, p_hostname text)
returns table (
  id uuid,
  hostname text,
  verified boolean,
  verification_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  token text;
  created_id uuid;
begin
  normalized := lower(trim(coalesce(p_hostname, '')));
  normalized := regexp_replace(normalized, '^https?://', '', 'i');
  normalized := split_part(normalized, '/', 1);
  normalized := split_part(normalized, ':', 1);

  if not exists (
    select 1 from public.agency_memberships am
    where am.agency_id = p_agency_id
      and am.user_id = auth.uid()
      and am.active = true
      and am.role in ('owner','admin')
  ) and not public.is_platform_admin() then
    raise exception 'Sem permissão para gerenciar domínios desta imobiliária.';
  end if;

  if not public.agency_can_use_custom_domain(p_agency_id) then
    raise exception 'O plano atual não inclui domínio próprio.';
  end if;

  if normalized = '' or position('.' in normalized) = 0 then
    raise exception 'Informe um domínio válido.';
  end if;

  if normalized = 'imoveis.lenoy.com.br' or normalized like '%.imoveis.lenoy.com.br' then
    raise exception 'Endereços da plataforma são criados automaticamente.';
  end if;

  if normalized !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' then
    raise exception 'Formato de domínio inválido.';
  end if;

  if exists (select 1 from public.agency_domains d where lower(d.hostname) = normalized) then
    raise exception 'Este domínio já está cadastrado na plataforma.';
  end if;

  token := 'lenoy-' || encode(gen_random_bytes(18), 'hex');

  insert into public.agency_domains (
    agency_id, hostname, kind, is_primary, verified
  ) values (
    p_agency_id, normalized, 'custom', false, false
  ) returning agency_domains.id into created_id;

  return query select created_id, normalized, false, token;
end;
$$;

revoke all on function public.request_custom_agency_domain(uuid, text) from public;
grant execute on function public.request_custom_agency_domain(uuid, text) to authenticated;

-- Evita que um cliente contorne a checagem do plano inserindo diretamente na tabela.
revoke insert on public.agency_domains from authenticated;

-- Mantém leitura/edição/exclusão conforme as policies existentes; criação de domínio customizado usa RPC.
