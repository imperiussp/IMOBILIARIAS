-- Integração específica com InfinitePay sobre a base genérica de cobrança.
-- IMPORTANTE: esta migration pertence somente ao projeto IMOBILIARIAS.
-- Não deve ser aplicada em Moto Connect, LENOY, Lê+ ou qualquer outro Supabase.

alter table public.billing_checkout_sessions
  add column if not exists billing_cycle text,
  add column if not exists order_nsu text,
  add column if not exists transaction_nsu text,
  add column if not exists invoice_slug text,
  add column if not exists receipt_url text,
  add column if not exists capture_method text,
  add column if not exists paid_amount numeric(12,2),
  add column if not exists activated_subscription_id uuid references public.agency_subscriptions(id) on delete set null,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb;

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_billing_cycle_check;
alter table public.billing_checkout_sessions
  add constraint billing_checkout_sessions_billing_cycle_check
  check (billing_cycle is null or billing_cycle in ('monthly','annual'));

create unique index if not exists billing_checkout_infinitepay_order_unique_idx
on public.billing_checkout_sessions (provider, order_nsu)
where order_nsu is not null;

create unique index if not exists billing_checkout_infinitepay_transaction_unique_idx
on public.billing_checkout_sessions (provider, transaction_nsu)
where transaction_nsu is not null;

create index if not exists billing_checkout_provider_status_idx
on public.billing_checkout_sessions (provider, status, created_at desc);

-- Ativa a assinatura somente depois de uma cobrança conciliada pelo backend.
-- É idempotente: o mesmo checkout pago nunca cria duas assinaturas.
create or replace function public.activate_subscription_from_paid_checkout(p_checkout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout_row public.billing_checkout_sessions%rowtype;
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

  if checkout_row.activated_subscription_id is not null then
    return checkout_row.activated_subscription_id;
  end if;

  if checkout_row.billing_cycle = 'annual' then
    cycle_interval := interval '1 year';
  else
    cycle_interval := interval '1 month';
  end if;

  update public.agency_subscriptions
  set status = 'expired',
      ends_at = coalesce(ends_at, now()),
      updated_at = now()
  where agency_id = checkout_row.agency_id
    and status in ('trial','active','past_due');

  insert into public.agency_subscriptions (
    agency_id, plan_id, status, starts_at, renews_at, ends_at,
    provider, provider_subscription_id
  ) values (
    checkout_row.agency_id,
    checkout_row.plan_id,
    'active',
    now(),
    now() + cycle_interval,
    now() + cycle_interval,
    'infinitepay',
    checkout_row.transaction_nsu
  ) returning id into new_subscription_id;

  update public.billing_checkout_sessions
  set activated_subscription_id = new_subscription_id,
      updated_at = now()
  where id = checkout_row.id;

  update public.agencies
  set status = 'active', updated_at = now()
  where id = checkout_row.agency_id;

  return new_subscription_id;
end;
$$;

-- Função exclusiva de backend. A Edge Function usa service role.
revoke all on function public.activate_subscription_from_paid_checkout(uuid) from public;
revoke all on function public.activate_subscription_from_paid_checkout(uuid) from anon, authenticated;

-- Clientes podem visualizar apenas suas próprias cobranças pela RLS existente,
-- mas não podem forjar dados retornados pela InfinitePay.
revoke insert, update, delete on public.billing_checkout_sessions from authenticated;
