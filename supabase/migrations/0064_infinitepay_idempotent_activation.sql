-- Ativação de assinatura idempotente por checkout InfinitePay.
-- IMPORTANTE: migration exclusiva do Supabase IMOBILIARIAS.
-- Não aplicar em Moto Connect ou qualquer outro projeto.

alter table public.agency_subscriptions
  add column if not exists billing_checkout_id uuid references public.billing_checkout_sessions(id) on delete set null;

create unique index if not exists agency_subscriptions_checkout_unique_idx
on public.agency_subscriptions (billing_checkout_id)
where billing_checkout_id is not null;

alter table public.billing_checkout_sessions
  add column if not exists activated_subscription_id uuid references public.agency_subscriptions(id) on delete set null,
  add column if not exists activation_completed_at timestamptz;

create or replace function public.activate_subscription_from_paid_checkout(p_checkout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout_row public.billing_checkout_sessions%rowtype;
  existing_subscription_id uuid;
  new_subscription_id uuid;
  cycle_interval interval;
begin
  select * into checkout_row
  from public.billing_checkout_sessions
  where id = p_checkout_id
  for update;

  if checkout_row.id is null then
    raise exception 'Checkout não encontrado.';
  end if;

  if checkout_row.provider <> 'infinitepay' then
    raise exception 'Provedor de cobrança incompatível.';
  end if;

  if checkout_row.status <> 'paid' then
    raise exception 'Checkout ainda não está pago.';
  end if;

  -- Se este checkout já ativou uma assinatura, apenas devolve a mesma.
  if checkout_row.activated_subscription_id is not null then
    return checkout_row.activated_subscription_id;
  end if;

  select s.id into existing_subscription_id
  from public.agency_subscriptions s
  where s.billing_checkout_id = checkout_row.id
  limit 1;

  if existing_subscription_id is not null then
    update public.billing_checkout_sessions
    set activated_subscription_id = existing_subscription_id,
        activation_completed_at = coalesce(activation_completed_at, now()),
        updated_at = now()
    where id = checkout_row.id;
    return existing_subscription_id;
  end if;

  cycle_interval := case when checkout_row.billing_cycle = 'annual'
    then interval '1 year'
    else interval '1 month'
  end;

  update public.agency_subscriptions
  set status = 'expired',
      ends_at = coalesce(ends_at, now()),
      updated_at = now()
  where agency_id = checkout_row.agency_id
    and status in ('trial','active','past_due');

  insert into public.agency_subscriptions (
    agency_id, plan_id, status, starts_at, renews_at, ends_at,
    provider, provider_customer_id, provider_subscription_id,
    billing_checkout_id, created_at, updated_at
  ) values (
    checkout_row.agency_id,
    checkout_row.plan_id,
    'active',
    now(),
    now() + cycle_interval,
    now() + cycle_interval,
    'infinitepay',
    null,
    null,
    checkout_row.id,
    now(),
    now()
  ) returning id into new_subscription_id;

  update public.billing_checkout_sessions
  set activated_subscription_id = new_subscription_id,
      activation_completed_at = now(),
      updated_at = now()
  where id = checkout_row.id;

  update public.agencies
  set status = 'active', updated_at = now()
  where id = checkout_row.agency_id;

  return new_subscription_id;
end;
$$;

revoke all on function public.activate_subscription_from_paid_checkout(uuid) from public;
revoke all on function public.activate_subscription_from_paid_checkout(uuid) from anon, authenticated;
