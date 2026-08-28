create table if not exists public.prepaid_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  charge_type text not null check (charge_type in ('implementation','subscription')),
  base_amount numeric not null,
  amount numeric not null,
  currency char(3) not null default 'BRL',
  status text not null default 'created' check (status in ('created','pending_payment','paid','invite_sent','onboarding','completed','expired','failed')),
  checkout_id uuid unique,
  public_status_token_hash text not null,
  onboarding_token_hash text,
  onboarding_expires_at timestamptz,
  invite_sent_at timestamptz,
  invite_error text,
  paid_at timestamptz,
  completed_at timestamptz,
  agency_id uuid references public.agencies(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prepaid_purchase_intents_email_idx on public.prepaid_purchase_intents(lower(email));
create index if not exists prepaid_purchase_intents_status_idx on public.prepaid_purchase_intents(status, created_at desc);

alter table public.prepaid_purchase_intents enable row level security;
revoke all on public.prepaid_purchase_intents from anon, authenticated;

alter table public.billing_checkout_sessions alter column agency_id drop not null;
alter table public.billing_checkout_sessions add column if not exists purchase_intent_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='billing_checkout_sessions_purchase_intent_id_fkey'
  ) then
    alter table public.billing_checkout_sessions
      add constraint billing_checkout_sessions_purchase_intent_id_fkey
      foreign key (purchase_intent_id) references public.prepaid_purchase_intents(id) on delete set null;
  end if;
end $$;

create index if not exists billing_checkout_sessions_purchase_intent_idx
  on public.billing_checkout_sessions(purchase_intent_id) where purchase_intent_id is not null;

update public.prepaid_purchase_intents i
set checkout_id = c.id
from public.billing_checkout_sessions c
where c.purchase_intent_id=i.id and i.checkout_id is null;

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

  select * into checkout_row
  from public.billing_checkout_sessions
  where id=intent_row.checkout_id and purchase_intent_id=intent_row.id
  for update;
  if checkout_row.id is null or checkout_row.status<>'paid' then raise exception 'Checkout pago não encontrado.'; end if;

  normalized_slug := public.normalize_agency_slug(p_agency_slug);
  if coalesce(trim(p_agency_name),'')='' then raise exception 'Informe o nome da imobiliária.'; end if;
  if not public.agency_slug_available(normalized_slug) then raise exception 'Este endereço não está disponível.'; end if;

  insert into public.agencies(slug,name,email,status)
  values(normalized_slug, trim(p_agency_name), lower(intent_row.email), 'pending_payment')
  returning id into agency_id_value;

  insert into public.agency_memberships(agency_id,user_id,role,active)
  values(agency_id_value,p_user_id,'owner',true)
  on conflict(agency_id,user_id) do update set role='owner',active=true;

  insert into public.agency_domains(
    agency_id,hostname,kind,is_primary,verified,verified_at,verification_status,last_verification_at
  ) values(
    agency_id_value,
    normalized_slug||'.imoveis.lenoy.com.br',
    'platform',true,true,now(),'verified',now()
  );

  if checkout_row.charge_type='implementation' then
    insert into public.agency_billing_profiles(agency_id,implementation_status,implementation_paid_at,billing_cycle,updated_at)
    values(agency_id_value,'paid',now(),'monthly',now());
    cycle_interval := interval '30 days';
  elsif checkout_row.billing_cycle='annual' then
    insert into public.agency_billing_profiles(agency_id,implementation_status,implementation_waived_at,billing_cycle,updated_at)
    values(agency_id_value,'waived',now(),'annual',now());
    cycle_interval := interval '1 year';
  else
    insert into public.agency_billing_profiles(agency_id,implementation_status,billing_cycle,updated_at)
    values(agency_id_value,'paid','monthly',now());
    cycle_interval := interval '1 month';
  end if;

  insert into public.agency_subscriptions(
    agency_id,plan_id,status,starts_at,renews_at,ends_at,provider,billing_cycle,billing_checkout_id
  ) values(
    agency_id_value,checkout_row.plan_id,'active',now(),now()+cycle_interval,now()+cycle_interval,
    'infinitepay',checkout_row.billing_cycle,checkout_row.id
  ) returning id into subscription_id_value;

  update public.billing_checkout_sessions
  set agency_id=agency_id_value,
      activated_subscription_id=subscription_id_value,
      activated_at=now(),
      activation_completed_at=now(),
      updated_at=now()
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
