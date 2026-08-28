-- Regras comerciais definitivas: implantação, mensal/anual e desconto manual por cliente.
-- O cadastro pode existir sem assinatura, mas o acesso operacional depende de pagamento confirmado no backend.

alter table public.subscription_plans
  add column if not exists implementation_fee numeric(12,2) not null default 0,
  add column if not exists annual_discount_percent numeric(5,2) not null default 25;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_annual_discount_percent_check;
alter table public.subscription_plans
  add constraint subscription_plans_annual_discount_percent_check
  check (annual_discount_percent >= 0 and annual_discount_percent < 100);

-- Quatro ofertas comerciais. O plano interno de homologação é preservado e nunca entra no checkout público.
insert into public.subscription_plans (
  code, name, description, monthly_price, annual_price, implementation_fee,
  annual_discount_percent, max_properties, max_users, max_ai_descriptions,
  features, active, display_order
)
values
  (
    'inicial', 'Inicial', 'Para o corretor começar com site, CRM e operação essencial.',
    39.90, 359.10, 99.00, 25, 100, 1, 5,
    jsonb_build_object(
      'commercial', true, 'internal_only', false, 'default_trial', false,
      'exclusive_site', true, 'crm_real_estate', true, 'customer_management', true,
      'broker_app', true, 'email_leads', true, 'push_notifications', true,
      'ai_descriptions', true, 'custom_domain', false,
      'max_buyer_outreach_per_month', 20
    ),
    true, 10
  ),
  (
    'profissional', 'Profissional', 'Mais capacidade para corretores e imobiliárias em crescimento.',
    59.90, 539.10, 149.00, 25, 500, 3, 15,
    jsonb_build_object(
      'commercial', true, 'internal_only', false, 'default_trial', false,
      'exclusive_site', true, 'full_management', true, 'broker_app', true,
      'crm_real_estate', true, 'customer_management', true, 'sales_management', true,
      'visit_agenda', true, 'proposal_control', true, 'email_leads', true,
      'push_notifications', true, 'ai_descriptions', true, 'custom_domain', false,
      'max_buyer_outreach_per_month', 60
    ),
    true, 20
  ),
  (
    'imobiliaria', 'Imobiliária', 'Gestão comercial ampliada, equipe e automações para a imobiliária.',
    79.90, 719.10, 199.00, 25, 1500, 7, 30,
    jsonb_build_object(
      'commercial', true, 'internal_only', false, 'default_trial', false,
      'exclusive_site', true, 'full_management', true, 'broker_app', true,
      'crm_real_estate', true, 'documents', true, 'ai_buyer_outreach', true,
      'customer_management', true, 'sales_management', true, 'visit_agenda', true,
      'proposal_control', true, 'key_control', true, 'inspections', true,
      'advanced_lead_reservation', true, 'user_permissions', true,
      'strategic_reports', true, 'email_leads', true, 'push_notifications', true,
      'ai_descriptions', true, 'custom_domain', false,
      'max_buyer_outreach_per_month', 150
    ),
    true, 30
  ),
  (
    'premium', 'Premium', 'Maior capacidade, automação e domínio próprio para operações completas.',
    110.00, 990.00, 249.00, 25, 5000, 15, 50,
    jsonb_build_object(
      'commercial', true, 'internal_only', false, 'default_trial', false,
      'exclusive_site', true, 'full_management', true, 'broker_app', true,
      'crm_real_estate', true, 'documents', true, 'ai_buyer_outreach', true,
      'customer_management', true, 'sales_management', true, 'visit_agenda', true,
      'proposal_control', true, 'key_control', true, 'inspections', true,
      'advanced_lead_reservation', true, 'user_permissions', true,
      'strategic_reports', true, 'multi_team', true, 'property_portals', true,
      'facebook_lead_ads', true, 'email_leads', true, 'push_notifications', true,
      'ai_descriptions', true, 'custom_domain', true,
      'max_buyer_outreach_per_month', 300
    ),
    true, 40
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  implementation_fee = excluded.implementation_fee,
  annual_discount_percent = excluded.annual_discount_percent,
  max_properties = excluded.max_properties,
  max_users = excluded.max_users,
  max_ai_descriptions = excluded.max_ai_descriptions,
  features = coalesce(public.subscription_plans.features, '{}'::jsonb) || excluded.features,
  active = true,
  display_order = excluded.display_order,
  updated_at = now();

-- Planos comerciais antigos deixam de ser oferecidos, sem apagar histórico nem quebrar assinaturas existentes.
update public.subscription_plans
set active = false, updated_at = now()
where code not in ('inicial','profissional','imobiliaria','premium','homologacao')
  and lower(coalesce(features ->> 'internal_only', 'false')) not in ('true','1','yes','on');

-- Novos cadastros não recebem mais teste gratuito automático.
-- Assinaturas de homologação já existentes continuam intactas.
drop trigger if exists agencies_attach_default_trial_plan on public.agencies;

create table if not exists public.agency_billing_profiles (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  implementation_status text not null default 'pending'
    check (implementation_status in ('pending','paid','waived')),
  implementation_paid_at timestamptz,
  implementation_waived_at timestamptz,
  billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly','annual')),
  updated_at timestamptz not null default now()
);

alter table public.agency_billing_profiles enable row level security;

drop policy if exists "tenant managers read billing profile" on public.agency_billing_profiles;
create policy "tenant managers read billing profile" on public.agency_billing_profiles
for select to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin());

drop policy if exists "platform admins manage billing profiles" on public.agency_billing_profiles;
create policy "platform admins manage billing profiles" on public.agency_billing_profiles
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant select on public.agency_billing_profiles to authenticated;
revoke insert, update, delete on public.agency_billing_profiles from anon, authenticated;

-- Clientes que já tinham assinatura comercial antes desta mudança não devem pagar implantação retroativamente.
insert into public.agency_billing_profiles (agency_id, implementation_status, implementation_paid_at, billing_cycle)
select a.id,
       case when exists (
         select 1
         from public.agency_subscriptions s
         join public.subscription_plans p on p.id = s.plan_id
         where s.agency_id = a.id
           and lower(coalesce(p.features ->> 'internal_only','false')) not in ('true','1','yes','on')
       ) then 'paid' else 'pending' end,
       case when exists (
         select 1
         from public.agency_subscriptions s
         join public.subscription_plans p on p.id = s.plan_id
         where s.agency_id = a.id
           and lower(coalesce(p.features ->> 'internal_only','false')) not in ('true','1','yes','on')
       ) then now() else null end,
       null
from public.agencies a
on conflict (agency_id) do nothing;

create table if not exists public.agency_billing_discounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  base_amount numeric(12,2) not null check (base_amount > 0),
  final_amount numeric(12,2) not null check (final_amount > 0),
  discount_percent numeric(7,4) not null check (discount_percent >= 0 and discount_percent < 100),
  status text not null default 'active' check (status in ('active','consumed','cancelled','expired')),
  valid_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists agency_billing_discounts_one_active_idx
on public.agency_billing_discounts (agency_id, plan_id, billing_cycle)
where status = 'active';

create index if not exists agency_billing_discounts_agency_idx
on public.agency_billing_discounts (agency_id, status, created_at desc);

alter table public.agency_billing_discounts enable row level security;

drop policy if exists "platform admins manage billing discounts" on public.agency_billing_discounts;
create policy "platform admins manage billing discounts" on public.agency_billing_discounts
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant select on public.agency_billing_discounts to authenticated;
revoke insert, update, delete on public.agency_billing_discounts from anon, authenticated;

create or replace function public.platform_set_agency_billing_discount(
  p_agency_id uuid,
  p_plan_id uuid,
  p_billing_cycle text,
  p_final_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  base_value numeric(12,2);
  final_value numeric(12,2);
  percent_value numeric(7,4);
  result_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;
  if p_billing_cycle not in ('monthly','annual') then
    raise exception 'Ciclo de cobrança inválido.';
  end if;

  select case when p_billing_cycle = 'annual' then annual_price else monthly_price end
  into base_value
  from public.subscription_plans
  where id = p_plan_id and active = true;

  if base_value is null or base_value <= 0 then
    raise exception 'Plano sem preço configurado para este ciclo.';
  end if;

  final_value := round(p_final_amount, 2);
  if final_value <= 0 or final_value > base_value then
    raise exception 'O valor com desconto precisa ser maior que zero e não pode superar o valor normal.';
  end if;

  update public.agency_billing_discounts
  set status = 'cancelled', updated_at = now()
  where agency_id = p_agency_id
    and plan_id = p_plan_id
    and billing_cycle = p_billing_cycle
    and status = 'active';

  if final_value = base_value then
    return null;
  end if;

  percent_value := round(((base_value - final_value) / base_value) * 100, 4);
  insert into public.agency_billing_discounts (
    agency_id, plan_id, billing_cycle, base_amount, final_amount,
    discount_percent, status, created_by
  ) values (
    p_agency_id, p_plan_id, p_billing_cycle, base_value, final_value,
    percent_value, 'active', auth.uid()
  ) returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.platform_set_agency_billing_discount(uuid,uuid,text,numeric) from public;
grant execute on function public.platform_set_agency_billing_discount(uuid,uuid,text,numeric) to authenticated;

create or replace function public.platform_clear_agency_billing_discount(
  p_agency_id uuid,
  p_plan_id uuid,
  p_billing_cycle text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'Acesso negado.'; end if;
  update public.agency_billing_discounts
  set status = 'cancelled', updated_at = now()
  where agency_id = p_agency_id
    and plan_id = p_plan_id
    and billing_cycle = p_billing_cycle
    and status = 'active';
end;
$$;

revoke all on function public.platform_clear_agency_billing_discount(uuid,uuid,text) from public;
grant execute on function public.platform_clear_agency_billing_discount(uuid,uuid,text) to authenticated;

alter table public.billing_checkout_sessions
  add column if not exists charge_type text not null default 'subscription',
  add column if not exists base_amount numeric(12,2),
  add column if not exists discount_percent numeric(7,4),
  add column if not exists discount_id uuid references public.agency_billing_discounts(id) on delete set null,
  add column if not exists implementation_waived boolean not null default false;

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_charge_type_check;
alter table public.billing_checkout_sessions
  add constraint billing_checkout_sessions_charge_type_check
  check (charge_type in ('implementation','subscription'));

alter table public.agency_subscriptions
  add column if not exists billing_cycle text;
alter table public.agency_subscriptions
  drop constraint if exists agency_subscriptions_billing_cycle_check;
alter table public.agency_subscriptions
  add constraint agency_subscriptions_billing_cycle_check
  check (billing_cycle is null or billing_cycle in ('monthly','annual'));

-- Snapshot usado pelos gates do Admin/App. Trial só libera quando for plano interno de homologação.
create or replace function public.agency_billing_status(p_agency_id uuid)
returns table (
  has_paid_access boolean,
  implementation_status text,
  billing_cycle text,
  subscription_status text,
  plan_id uuid,
  plan_name text,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;

  return query
  with current_sub as (
    select s.status, s.plan_id, s.billing_cycle, s.ends_at, p.name, p.features
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
    order by s.starts_at desc
    limit 1
  ), profile as (
    select bp.implementation_status, bp.billing_cycle
    from public.agency_billing_profiles bp
    where bp.agency_id = p_agency_id
  )
  select
    coalesce(
      case
        when cs.status = 'active' then cs.ends_at is null or cs.ends_at > now()
        when cs.status = 'past_due' then cs.ends_at is null or cs.ends_at + interval '3 days' > now()
        when cs.status = 'trial' then lower(coalesce(cs.features ->> 'internal_only','false')) in ('true','1','yes','on')
        else false
      end,
      false
    ) as has_paid_access,
    coalesce(pr.implementation_status, 'pending')::text,
    coalesce(cs.billing_cycle, pr.billing_cycle)::text,
    cs.status::text,
    cs.plan_id,
    cs.name::text,
    cs.ends_at
  from (select 1) anchor
  left join current_sub cs on true
  left join profile pr on true;
end;
$$;

revoke all on function public.agency_billing_status(uuid) from public;
grant execute on function public.agency_billing_status(uuid) to authenticated;

-- Ativação/renovação exclusivamente após o checkout ter sido marcado como pago pelo backend.
create or replace function public.activate_subscription_from_paid_checkout(p_checkout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout_row public.billing_checkout_sessions%rowtype;
  current_row public.agency_subscriptions%rowtype;
  result_id uuid;
  cycle_interval interval;
  cycle_base timestamptz;
begin
  select * into checkout_row
  from public.billing_checkout_sessions
  where id = p_checkout_id
  for update;

  if checkout_row.id is null then raise exception 'Checkout não encontrado.'; end if;
  if checkout_row.provider <> 'infinitepay' then raise exception 'Provedor de cobrança incompatível.'; end if;
  if checkout_row.status <> 'paid' then raise exception 'Checkout ainda não está pago.'; end if;
  if checkout_row.activated_subscription_id is not null then return checkout_row.activated_subscription_id; end if;

  perform pg_advisory_xact_lock(hashtext(checkout_row.agency_id::text || ':billing-activation'));
  select * into checkout_row from public.billing_checkout_sessions where id = p_checkout_id for update;
  if checkout_row.activated_subscription_id is not null then return checkout_row.activated_subscription_id; end if;

  insert into public.agency_billing_profiles (agency_id, implementation_status, billing_cycle)
  values (checkout_row.agency_id, 'pending', checkout_row.billing_cycle)
  on conflict (agency_id) do update
    set billing_cycle = excluded.billing_cycle, updated_at = now();

  if checkout_row.charge_type = 'implementation' then
    update public.agency_billing_profiles
    set implementation_status = 'paid', implementation_paid_at = now(),
        implementation_waived_at = null, billing_cycle = 'monthly', updated_at = now()
    where agency_id = checkout_row.agency_id;
    cycle_interval := interval '30 days';
  elsif checkout_row.billing_cycle = 'annual' then
    update public.agency_billing_profiles
    set implementation_status = case when implementation_status = 'paid' then 'paid' else 'waived' end,
        implementation_waived_at = case when implementation_status = 'paid' then implementation_waived_at else coalesce(implementation_waived_at, now()) end,
        billing_cycle = 'annual', updated_at = now()
    where agency_id = checkout_row.agency_id;
    cycle_interval := interval '1 year';
  else
    cycle_interval := interval '1 month';
  end if;

  select * into current_row
  from public.agency_subscriptions s
  where s.agency_id = checkout_row.agency_id
    and s.status in ('trial','active','past_due')
  order by s.starts_at desc
  limit 1
  for update;

  if current_row.id is not null and current_row.plan_id = checkout_row.plan_id then
    cycle_base := greatest(now(), coalesce(current_row.ends_at, current_row.renews_at, now()));
    -- Pagamento de implantação dá os primeiros 30 dias a partir da confirmação, sem somar um trial antigo.
    if checkout_row.charge_type = 'implementation' then cycle_base := now(); end if;
    update public.agency_subscriptions
    set status = 'active', provider = 'infinitepay', billing_cycle = checkout_row.billing_cycle,
        renews_at = cycle_base + cycle_interval, ends_at = cycle_base + cycle_interval,
        updated_at = now()
    where id = current_row.id
    returning id into result_id;
  else
    if current_row.id is not null then
      update public.agency_subscriptions
      set status = 'expired', renews_at = null,
          ends_at = least(coalesce(ends_at, now()), now()), updated_at = now()
      where id = current_row.id;
    end if;
    insert into public.agency_subscriptions (
      agency_id, plan_id, status, starts_at, renews_at, ends_at, provider, billing_cycle
    ) values (
      checkout_row.agency_id, checkout_row.plan_id, 'active', now(),
      now() + cycle_interval, now() + cycle_interval, 'infinitepay', checkout_row.billing_cycle
    ) returning id into result_id;
  end if;

  if checkout_row.discount_id is not null then
    update public.agency_billing_discounts
    set status = 'consumed', consumed_at = now(), updated_at = now()
    where id = checkout_row.discount_id and status = 'active';
  end if;

  update public.billing_checkout_sessions
  set activated_subscription_id = result_id, activated_at = now(), updated_at = now()
  where id = checkout_row.id and activated_subscription_id is null;

  update public.agencies set status = 'active', updated_at = now() where id = checkout_row.agency_id;
  return result_id;
end;
$$;

revoke all on function public.activate_subscription_from_paid_checkout(uuid) from public;
revoke all on function public.activate_subscription_from_paid_checkout(uuid) from anon, authenticated;
