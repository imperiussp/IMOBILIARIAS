-- Novas imobiliarias comerciais ficam apenas reservadas ate a confirmacao do pagamento.
-- O registro preliminar permite reservar o slug e iniciar o checkout, mas o site
-- publico, painel e aplicativo so sao ativados pelo backend apos pagamento confirmado.

alter table public.agencies drop constraint if exists agencies_status_check;
alter table public.agencies
  add constraint agencies_status_check
  check (status in ('pending_payment','trial','active','past_due','suspended','cancelled'));

-- Converte somente cadastros comerciais ainda sem qualquer assinatura.
-- Contas antigas de homologacao possuem assinatura e nao sao afetadas.
-- O trigger protege status em operacoes normais; a migracao precisa altera-lo
-- como operacao interna da plataforma.
alter table public.agencies disable trigger agencies_protect_system_fields_trigger;
update public.agencies a
set status = 'pending_payment',
    updated_at = now()
where a.status = 'trial'
  and not exists (
    select 1
    from public.agency_subscriptions s
    where s.agency_id = a.id
  );
alter table public.agencies enable trigger agencies_protect_system_fields_trigger;

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
  if requested_kind <> 'agency_owner' then return new; end if;

  select coalesce(new_registrations_enabled,false), coalesce(maintenance_mode,false)
    into registrations_enabled, maintenance_enabled
  from public.platform_release_controls where id=1;

  if maintenance_enabled then
    raise exception 'Novos cadastros de imobiliarias estao bloqueados durante manutencao.';
  end if;

  if not registrations_enabled then
    requested_bootstrap := trim(coalesce(new.raw_user_meta_data ->> 'bootstrap_token', ''));
    if requested_bootstrap = '' then
      raise exception 'Novos cadastros de imobiliarias estao bloqueados pelo controle global de homologacao.';
    end if;

    select t.id into bootstrap_id
    from public.platform_owner_bootstrap_tokens t
    where t.purpose='agency_owner'
      and t.token_hash=encode(extensions.digest(requested_bootstrap,'sha256'),'hex')
      and t.used_at is null
      and t.expires_at > now()
    for update limit 1;

    if bootstrap_id is null then
      raise exception 'Token de homologacao invalido, expirado ou ja utilizado.';
    end if;
  end if;

  if exists (
    select 1 from public.agency_memberships am
    where am.user_id=new.id and am.role='owner'
  ) then return new; end if;

  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'agency_name', ''));
  requested_slug := trim(coalesce(new.raw_user_meta_data ->> 'agency_slug', ''));

  if requested_name = '' then raise exception 'Informe o nome da imobiliaria.'; end if;

  final_slug := public.normalize_agency_slug(
    case when requested_slug <> '' then requested_slug else requested_name end
  );

  if length(final_slug) < 3 then raise exception 'O endereco da imobiliaria deve ter pelo menos 3 caracteres.'; end if;
  if length(final_slug) > 48 then raise exception 'O endereco da imobiliaria deve ter no maximo 48 caracteres.'; end if;
  if public.is_reserved_agency_slug(final_slug) then raise exception 'Este endereco esta reservado pela plataforma.'; end if;
  if exists (select 1 from public.agencies a where a.slug=final_slug) then
    raise exception 'Este endereco ja esta sendo usado por outra imobiliaria.';
  end if;

  -- Apenas reserva o cadastro/endereco. Nao e uma imobiliaria ativa.
  insert into public.agencies(slug,name,status)
  values(final_slug,requested_name,'pending_payment')
  returning id into new_agency_id;

  insert into public.agency_memberships(agency_id,user_id,role,active)
  values(new_agency_id,new.id,'owner',true);

  -- O dominio fica reservado, mas resolve_agency_by_host nao publica
  -- agencias em pending_payment.
  insert into public.agency_domains(agency_id,hostname,kind,is_primary,verified,verified_at)
  values(new_agency_id,final_slug||'.imoveis.lenoy.com.br','platform',true,true,now());

  if bootstrap_id is not null then
    update public.platform_owner_bootstrap_tokens
    set used_at=now(),used_by=new.id
    where id=bootstrap_id and used_at is null;
    if not found then raise exception 'Token de homologacao ja utilizado.'; end if;
  end if;

  return new;
end;
$$;
