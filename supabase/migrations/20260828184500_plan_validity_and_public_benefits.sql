-- Planos totalmente administráveis pela Plataforma: validade por ciclo e benefícios públicos.
-- Também alinha o cadastro central com o comparativo atualmente aprovado no site.

alter table public.subscription_plans
  add column if not exists monthly_validity_days integer not null default 30,
  add column if not exists annual_validity_days integer not null default 365;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_monthly_validity_days_check;
alter table public.subscription_plans
  add constraint subscription_plans_monthly_validity_days_check
  check (monthly_validity_days between 1 and 3650);

alter table public.subscription_plans
  drop constraint if exists subscription_plans_annual_validity_days_check;
alter table public.subscription_plans
  add constraint subscription_plans_annual_validity_days_check
  check (annual_validity_days between 1 and 3650);

update public.subscription_plans
set
  monthly_validity_days = coalesce(monthly_validity_days, 30),
  annual_validity_days = coalesce(annual_validity_days, 365),
  max_properties = case code when 'inicial' then 30 when 'profissional' then 400 when 'imobiliaria' then 1000 when 'premium' then 3000 else max_properties end,
  max_users = case code when 'inicial' then 1 when 'profissional' then 3 when 'imobiliaria' then 5 when 'premium' then 10 else max_users end,
  features = coalesce(features,'{}'::jsonb) || case code
    when 'inicial' then jsonb_build_object(
      'max_concurrent_accesses',2,'max_professional_emails',1,'max_photos_per_property',5,
      'property_catalog',true,'property_portals',true,'whatsapp_site',true,'seo_site',true,
      'broker_app',false,'full_management',false,'sales_management',false,'key_control',false,
      'proposal_control',false,'visit_agenda',false,'inspections',false,'documents',false,
      'advanced_lead_reservation',false,'user_permissions',false,'strategic_reports',false,
      'multi_team',false,'facebook_lead_ads',false,'ai_buyer_outreach',false,
      'buyer_property_matching',false,'consented_auto_outreach',false,'featured',false,
      'public_benefits',jsonb_build_array()
    )
    when 'profissional' then jsonb_build_object(
      'max_concurrent_accesses',6,'max_professional_emails',3,'max_photos_per_property',50,
      'property_catalog',true,'property_portals',true,'whatsapp_site',true,'seo_site',true,
      'broker_app',true,'full_management',true,'sales_management',true,'key_control',true,
      'proposal_control',true,'visit_agenda',true,'inspections',true,'documents',false,
      'advanced_lead_reservation',false,'user_permissions',false,'strategic_reports',false,
      'multi_team',false,'facebook_lead_ads',true,'ai_buyer_outreach',false,
      'buyer_property_matching',false,'consented_auto_outreach',false,'featured',true,
      'public_benefits',jsonb_build_array()
    )
    when 'imobiliaria' then jsonb_build_object(
      'max_concurrent_accesses',10,'max_professional_emails',5,'max_photos_per_property',50,
      'property_catalog',true,'property_portals',true,'whatsapp_site',true,'seo_site',true,
      'broker_app',true,'full_management',true,'sales_management',true,'key_control',true,
      'proposal_control',true,'visit_agenda',true,'inspections',true,'documents',true,
      'advanced_lead_reservation',true,'user_permissions',true,'strategic_reports',true,
      'multi_team',false,'facebook_lead_ads',true,'ai_buyer_outreach',true,
      'buyer_property_matching',true,'consented_auto_outreach',true,'featured',false,
      'public_benefits',jsonb_build_array()
    )
    when 'premium' then jsonb_build_object(
      'max_concurrent_accesses',20,'max_professional_emails',10,'max_photos_per_property',50,
      'property_catalog',true,'property_portals',true,'whatsapp_site',true,'seo_site',true,
      'broker_app',true,'full_management',true,'sales_management',true,'key_control',true,
      'proposal_control',true,'visit_agenda',true,'inspections',true,'documents',true,
      'advanced_lead_reservation',true,'user_permissions',true,'strategic_reports',true,
      'multi_team',true,'facebook_lead_ads',true,'ai_buyer_outreach',true,
      'buyer_property_matching',true,'consented_auto_outreach',true,'priority_operations',true,
      'advanced_automation',true,'featured',false,'public_benefits',jsonb_build_array()
    )
    else '{}'::jsonb
  end,
  updated_at = now()
where code in ('inicial','profissional','imobiliaria','premium');

-- A ativação/renovação passa a respeitar a validade configurada no próprio plano.
create or replace function public.activate_subscription_from_paid_checkout(p_checkout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout_row public.billing_checkout_sessions%rowtype;
  current_row public.agency_subscriptions%rowtype;
  plan_row public.subscription_plans%rowtype;
  result_id uuid;
  cycle_interval interval;
  cycle_base timestamptz;
begin
  select * into checkout_row from public.billing_checkout_sessions where id = p_checkout_id for update;
  if checkout_row.id is null then raise exception 'Checkout não encontrado.'; end if;
  if checkout_row.provider <> 'infinitepay' then raise exception 'Provedor de cobrança incompatível.'; end if;
  if checkout_row.status <> 'paid' then raise exception 'Checkout ainda não está pago.'; end if;
  if checkout_row.activated_subscription_id is not null then return checkout_row.activated_subscription_id; end if;

  perform pg_advisory_xact_lock(hashtext(checkout_row.agency_id::text || ':billing-activation'));
  select * into checkout_row from public.billing_checkout_sessions where id = p_checkout_id for update;
  if checkout_row.activated_subscription_id is not null then return checkout_row.activated_subscription_id; end if;

  select * into plan_row from public.subscription_plans where id = checkout_row.plan_id;
  if plan_row.id is null then raise exception 'Plano não encontrado.'; end if;
  cycle_interval := make_interval(days => case when checkout_row.billing_cycle='annual' then plan_row.annual_validity_days else plan_row.monthly_validity_days end);

  select * into current_row
  from public.agency_subscriptions s
  where s.agency_id = checkout_row.agency_id and s.status in ('trial','active','past_due')
  order by s.starts_at desc limit 1 for update;

  if current_row.id is not null and current_row.plan_id = checkout_row.plan_id then
    cycle_base := greatest(now(), coalesce(current_row.ends_at, current_row.renews_at, now()));
    update public.agency_subscriptions
    set status='active', provider='infinitepay', renews_at=cycle_base+cycle_interval,
        ends_at=cycle_base+cycle_interval, updated_at=now()
    where id=current_row.id returning id into result_id;
  else
    if current_row.id is not null then
      update public.agency_subscriptions
      set status='expired', renews_at=null, ends_at=least(coalesce(ends_at,now()),now()), updated_at=now()
      where id=current_row.id;
    end if;
    insert into public.agency_subscriptions (agency_id,plan_id,status,starts_at,renews_at,ends_at,provider)
    values (checkout_row.agency_id,checkout_row.plan_id,'active',now(),now()+cycle_interval,now()+cycle_interval,'infinitepay')
    returning id into result_id;
  end if;

  update public.billing_checkout_sessions
  set activated_subscription_id=result_id, activated_at=now(), updated_at=now()
  where id=checkout_row.id and activated_subscription_id is null;
  update public.agencies set status='active', updated_at=now() where id=checkout_row.agency_id;
  return result_id;
end;
$$;

revoke all on function public.activate_subscription_from_paid_checkout(uuid) from public;
revoke all on function public.activate_subscription_from_paid_checkout(uuid) from anon, authenticated;

create or replace function public.complete_prepaid_agency_onboarding(
  p_intent_id uuid,
  p_user_id uuid,
  p_agency_name text,
  p_agency_slug text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  intent_row public.prepaid_purchase_intents%rowtype;
  checkout_row public.billing_checkout_sessions%rowtype;
  plan_row public.subscription_plans%rowtype;
  normalized_slug text;
  agency_id_value uuid;
  subscription_id_value uuid;
  cycle_interval interval;
begin
  if p_intent_id is null or p_user_id is null then raise exception 'Compra e usuário são obrigatórios.'; end if;
  perform pg_advisory_xact_lock(hashtext('prepaid-onboarding:'||p_intent_id::text));

  select * into intent_row from public.prepaid_purchase_intents where id=p_intent_id for update;
  if intent_row.id is null then raise exception 'Compra não encontrada.'; end if;
  if intent_row.status='completed' and intent_row.agency_id is not null then return intent_row.agency_id; end if;
  if intent_row.status not in ('paid','invite_sent','onboarding') then raise exception 'O pagamento ainda não foi confirmado.'; end if;
  if intent_row.auth_user_id is not null and intent_row.auth_user_id<>p_user_id then raise exception 'Esta compra pertence a outro usuário.'; end if;

  select * into checkout_row from public.billing_checkout_sessions where id=intent_row.checkout_id and purchase_intent_id=intent_row.id for update;
  if checkout_row.id is null or checkout_row.status<>'paid' then raise exception 'Checkout pago não encontrado.'; end if;
  select * into plan_row from public.subscription_plans where id=checkout_row.plan_id;
  if plan_row.id is null then raise exception 'Plano não encontrado.'; end if;

  normalized_slug := public.normalize_agency_slug(p_agency_slug);
  if coalesce(trim(p_agency_name),'')='' then raise exception 'Informe o nome da imobiliária.'; end if;
  if not public.agency_slug_available(normalized_slug) then raise exception 'Este endereço não está disponível.'; end if;

  insert into public.agencies(slug,name,email,status)
  values(normalized_slug, trim(p_agency_name), lower(intent_row.email), 'pending_payment')
  returning id into agency_id_value;

  insert into public.agency_memberships(agency_id,user_id,role,active)
  values(agency_id_value,p_user_id,'owner',true)
  on conflict(agency_id,user_id) do update set role='owner',active=true;

  insert into public.agency_domains(agency_id,hostname,kind,is_primary,verified,verified_at,verification_status,last_verification_at)
  values(agency_id_value,normalized_slug||'.imoveis.lenoy.com.br','platform',true,true,now(),'verified',now());

  if checkout_row.charge_type='implementation' then
    insert into public.agency_billing_profiles(agency_id,implementation_status,implementation_paid_at,billing_cycle,updated_at)
    values(agency_id_value,'paid',now(),'monthly',now());
    cycle_interval := make_interval(days => plan_row.monthly_validity_days);
  elsif checkout_row.billing_cycle='annual' then
    insert into public.agency_billing_profiles(agency_id,implementation_status,implementation_waived_at,billing_cycle,updated_at)
    values(agency_id_value,'waived',now(),'annual',now());
    cycle_interval := make_interval(days => plan_row.annual_validity_days);
  else
    insert into public.agency_billing_profiles(agency_id,implementation_status,billing_cycle,updated_at)
    values(agency_id_value,'paid','monthly',now());
    cycle_interval := make_interval(days => plan_row.monthly_validity_days);
  end if;

  insert into public.agency_subscriptions(agency_id,plan_id,status,starts_at,renews_at,ends_at,provider,billing_cycle,billing_checkout_id)
  values(agency_id_value,checkout_row.plan_id,'active',now(),now()+cycle_interval,now()+cycle_interval,'infinitepay',checkout_row.billing_cycle,checkout_row.id)
  returning id into subscription_id_value;

  update public.billing_checkout_sessions
  set agency_id=agency_id_value,activated_subscription_id=subscription_id_value,activated_at=now(),activation_completed_at=now(),updated_at=now()
  where id=checkout_row.id;
  update public.agencies set status='active',updated_at=now() where id=agency_id_value;
  update public.prepaid_purchase_intents
  set status='completed',agency_id=agency_id_value,auth_user_id=p_user_id,completed_at=now(),updated_at=now()
  where id=intent_row.id;
  return agency_id_value;
end;
$$;

revoke all on function public.complete_prepaid_agency_onboarding(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.complete_prepaid_agency_onboarding(uuid,uuid,text,text) to service_role;
