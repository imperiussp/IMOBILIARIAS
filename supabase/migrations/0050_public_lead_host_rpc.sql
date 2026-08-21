-- Criação pública de leads sempre resolvida pelo hostname do tenant.
-- Evita que o navegador escolha livremente agency_id/broker_id de outra imobiliária.

create or replace function public.create_public_lead_for_host(
  p_hostname text,
  p_property_id uuid default null,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_message text default null,
  p_source text default 'web'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostname text := lower(trim(coalesce(p_hostname, '')));
  v_agency_id uuid;
  v_broker_id uuid;
  v_lead_id uuid;
  v_source text := lower(trim(coalesce(p_source, 'web')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if v_hostname = '' or length(v_hostname) > 253 then
    raise exception 'Hostname inválido.';
  end if;

  if v_name is null or length(v_name) > 160 then
    raise exception 'Nome inválido.';
  end if;

  if v_phone is null and v_email is null then
    raise exception 'Informe telefone ou e-mail.';
  end if;

  if v_phone is not null and length(v_phone) > 40 then
    raise exception 'Telefone inválido.';
  end if;

  if v_email is not null and (length(v_email) > 254 or position('@' in v_email) = 0) then
    raise exception 'E-mail inválido.';
  end if;

  if v_message is null or length(v_message) > 4000 then
    raise exception 'Mensagem inválida.';
  end if;

  if v_source not in ('web','web-general-contact','web-owner-property','web-property-detail','portal','email') then
    v_source := 'web';
  end if;

  select d.agency_id
    into v_agency_id
  from public.agency_domains d
  join public.agencies a on a.id = d.agency_id
  where lower(d.hostname) = v_hostname
    and d.verified = true
    and a.status in ('trial','active','past_due')
  limit 1;

  if v_agency_id is null then
    raise exception 'Imobiliária não encontrada para este endereço.';
  end if;

  if p_property_id is not null then
    select p.broker_id
      into v_broker_id
    from public.properties p
    where p.id = p_property_id
      and p.agency_id = v_agency_id
      and p.publication_state = 'published'
      and p.status in ('available','reserved','rented','sold')
    limit 1;

    if not found then
      raise exception 'Imóvel indisponível para este endereço.';
    end if;
  end if;

  insert into public.leads (
    agency_id,
    property_id,
    broker_id,
    name,
    phone,
    email,
    message,
    source
  ) values (
    v_agency_id,
    p_property_id,
    v_broker_id,
    v_name,
    v_phone,
    v_email,
    v_message,
    v_source
  )
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

-- O navegador anônimo não deve mais inserir diretamente em leads.
revoke insert on table public.leads from anon;

-- SECURITY DEFINER acessível somente pelos papéis necessários.
revoke all on function public.create_public_lead_for_host(text, uuid, text, text, text, text, text) from public;
grant execute on function public.create_public_lead_for_host(text, uuid, text, text, text, text, text) to anon, authenticated;
