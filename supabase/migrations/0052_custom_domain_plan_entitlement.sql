-- Domínio próprio passa a respeitar o plano da imobiliária.
-- A feature é lida de subscription_plans.features -> custom_domain.
-- A verificação DNS fica protegida contra alteração pelo próprio cliente.

alter table public.agency_domains
  add column if not exists verification_token text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists last_verification_at timestamptz,
  add column if not exists verification_error text;

alter table public.agency_domains
  drop constraint if exists agency_domains_verification_status_check;
alter table public.agency_domains
  add constraint agency_domains_verification_status_check
  check (verification_status in ('pending','checking','verified','failed'));

update public.agency_domains
set verification_status = case when verified then 'verified' else 'pending' end
where verification_status is null
   or (verified = true and verification_status <> 'verified');

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
      select lower(coalesce(sp.features ->> 'custom_domain', 'false')) in ('true','1','yes','on')
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
  verification_token text,
  verification_status text
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
    agency_id, hostname, kind, is_primary, verified,
    verification_token, verification_status, verification_error
  ) values (
    p_agency_id, normalized, 'custom', false, false,
    token, 'pending', null
  ) returning agency_domains.id into created_id;

  return query select created_id, normalized, false, token, 'pending'::text;
end;
$$;

revoke all on function public.request_custom_agency_domain(uuid, text) from public;
grant execute on function public.request_custom_agency_domain(uuid, text) to authenticated;

-- Evita que um cliente contorne a checagem do plano inserindo diretamente na tabela.
revoke insert on public.agency_domains from authenticated;

-- Somente a plataforma pode marcar um domínio como verificado, alterar token/status
-- de verificação ou trocar seu kind para 'platform'.
create or replace function public.protect_domain_verification_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  if new.verified is distinct from old.verified
     or new.verified_at is distinct from old.verified_at
     or new.verification_token is distinct from old.verification_token
     or new.verification_status is distinct from old.verification_status
     or new.last_verification_at is distinct from old.last_verification_at
     or new.verification_error is distinct from old.verification_error
     or new.kind is distinct from old.kind
     or (old.kind = 'platform' and new.hostname is distinct from old.hostname) then
    raise exception 'Os campos de verificação do domínio são controlados pela plataforma.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_domain_verification_fields() from public;

drop trigger if exists agency_domains_protect_verification on public.agency_domains;
create trigger agency_domains_protect_verification
before update on public.agency_domains
for each row execute function public.protect_domain_verification_fields();

create index if not exists agency_domains_verification_queue_idx
on public.agency_domains (verification_status, last_verification_at)
where kind = 'custom' and verified = false;
