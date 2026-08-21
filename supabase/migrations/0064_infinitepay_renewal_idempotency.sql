-- Renovação e ativação idempotentes para pagamentos InfinitePay.
-- EXCLUSIVO do Supabase do projeto IMOBILIARIAS.
-- Um mesmo checkout pago nunca pode ativar/renovar a assinatura duas vezes.

alter table public.billing_checkout_sessions
  add column if not exists activated_subscription_id uuid references public.agency_subscriptions(id) on delete set null,
  add column if not exists activated_at timestamptz;

create index if not exists billing_checkout_activated_subscription_idx
on public.billing_checkout_sessions (activated_subscription_id)
where activated_subscription_id is not null;

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

  if checkout_row.id is null then
    raise exception 'Checkout não encontrado.';
  end if;

  if checkout_row.provider <> 'infinitepay' then
    raise exception 'Provedor de cobrança incompatível.';
  end if;

  if checkout_row.status <> 'paid' then
    raise exception 'Checkout ainda não está pago.';
  end if;

  -- Idempotência forte: webhook, retorno e reprocessamentos recebem o mesmo resultado.
  if checkout_row.activated_subscription_id is not null then
    return checkout_row.activated_subscription_id;
  end if;

  perform pg_advisory_xact_lock(hashtext(checkout_row.agency_id::text || ':billing-activation'));

  -- Verifica novamente após obter o lock por imobiliária.
  select * into checkout_row
  from public.billing_checkout_sessions
  where id = p_checkout_id
  for update;

  if checkout_row.activated_subscription_id is not null then
    return checkout_row.activated_subscription_id;
  end if;

  cycle_interval := case when checkout_row.billing_cycle = 'annual' then interval '1 year' else interval '1 month' end;

  select * into current_row
  from public.agency_subscriptions s
  where s.agency_id = checkout_row.agency_id
    and s.status in ('trial','active','past_due')
  order by s.starts_at desc
  limit 1
  for update;

  -- Renovação do mesmo plano preserva os dias já pagos que ainda restavam.
  if current_row.id is not null and current_row.plan_id = checkout_row.plan_id then
    cycle_base := greatest(
      now(),
      coalesce(current_row.ends_at, current_row.renews_at, now())
    );

    update public.agency_subscriptions
    set status = 'active',
        provider = 'infinitepay',
        renews_at = cycle_base + cycle_interval,
        ends_at = cycle_base + cycle_interval,
        updated_at = now()
    where id = current_row.id
    returning id into result_id;
  else
    if current_row.id is not null then
      update public.agency_subscriptions
      set status = 'expired',
          renews_at = null,
          ends_at = least(coalesce(ends_at, now()), now()),
          updated_at = now()
      where id = current_row.id;
    end if;

    insert into public.agency_subscriptions (
      agency_id, plan_id, status, starts_at, renews_at, ends_at, provider
    ) values (
      checkout_row.agency_id,
      checkout_row.plan_id,
      'active',
      now(),
      now() + cycle_interval,
      now() + cycle_interval,
      'infinitepay'
    ) returning id into result_id;
  end if;

  update public.billing_checkout_sessions
  set activated_subscription_id = result_id,
      activated_at = now(),
      updated_at = now()
  where id = checkout_row.id
    and activated_subscription_id is null;

  update public.agencies
  set status = 'active', updated_at = now()
  where id = checkout_row.agency_id;

  return result_id;
end;
$$;

revoke all on function public.activate_subscription_from_paid_checkout(uuid) from public;
revoke all on function public.activate_subscription_from_paid_checkout(uuid) from anon, authenticated;
