-- Edição comercial centralizada para o administrador da plataforma.
-- Permite ajustar dados do cliente, implantação, ciclo, plano, assinatura e vencimentos
-- sem conceder escrita direta nas tabelas aos usuários comuns.

create or replace function public.platform_update_agency_commercial(
  p_agency_id uuid,
  p_name text,
  p_created_at timestamptz,
  p_agency_status text,
  p_plan_id uuid,
  p_subscription_status text,
  p_billing_cycle text,
  p_implementation_status text,
  p_renews_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_subscription_id uuid;
  result_subscription_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Informe o nome do cliente.';
  end if;

  if p_agency_status not in ('pending_payment','trial','active','past_due','suspended','cancelled') then
    raise exception 'Status de acesso inválido.';
  end if;

  if p_subscription_status not in ('none','trial','active','past_due','cancelled','expired') then
    raise exception 'Status de assinatura inválido.';
  end if;

  if p_billing_cycle not in ('monthly','annual') then
    raise exception 'Ciclo de cobrança inválido.';
  end if;

  if p_implementation_status not in ('pending','paid','waived') then
    raise exception 'Situação da implantação inválida.';
  end if;

  if p_plan_id is not null and not exists (
    select 1 from public.subscription_plans sp where sp.id = p_plan_id
  ) then
    raise exception 'Plano não encontrado.';
  end if;

  if p_subscription_status <> 'none' and p_plan_id is null then
    raise exception 'Selecione um plano para a assinatura.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_agency_id::text || ':platform-commercial-edit'));

  update public.agencies
  set name = btrim(p_name),
      created_at = coalesce(p_created_at, created_at),
      status = p_agency_status,
      updated_at = now()
  where id = p_agency_id;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  insert into public.agency_billing_profiles (
    agency_id, implementation_status, implementation_paid_at,
    implementation_waived_at, billing_cycle, updated_at
  ) values (
    p_agency_id,
    p_implementation_status,
    case when p_implementation_status = 'paid' then now() else null end,
    case when p_implementation_status = 'waived' then now() else null end,
    p_billing_cycle,
    now()
  )
  on conflict (agency_id) do update set
    implementation_status = excluded.implementation_status,
    implementation_paid_at = case
      when excluded.implementation_status = 'paid' then coalesce(public.agency_billing_profiles.implementation_paid_at, now())
      else null
    end,
    implementation_waived_at = case
      when excluded.implementation_status = 'waived' then coalesce(public.agency_billing_profiles.implementation_waived_at, now())
      else null
    end,
    billing_cycle = excluded.billing_cycle,
    updated_at = now();

  select s.id
  into current_subscription_id
  from public.agency_subscriptions s
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
  order by s.starts_at desc
  limit 1;

  if p_subscription_status = 'none' then
    if current_subscription_id is not null then
      update public.agency_subscriptions
      set status = 'expired',
          renews_at = null,
          ends_at = coalesce(p_ends_at, now()),
          updated_at = now()
      where id = current_subscription_id;
      result_subscription_id := current_subscription_id;
    end if;
    return result_subscription_id;
  end if;

  if current_subscription_id is null then
    insert into public.agency_subscriptions (
      agency_id, plan_id, status, starts_at, renews_at, ends_at,
      provider, billing_cycle, updated_at
    ) values (
      p_agency_id, p_plan_id, p_subscription_status, now(), p_renews_at, p_ends_at,
      'platform-admin', p_billing_cycle, now()
    ) returning id into result_subscription_id;
  else
    update public.agency_subscriptions
    set plan_id = p_plan_id,
        status = p_subscription_status,
        renews_at = p_renews_at,
        ends_at = p_ends_at,
        billing_cycle = p_billing_cycle,
        updated_at = now()
    where id = current_subscription_id
    returning id into result_subscription_id;
  end if;

  return result_subscription_id;
end;
$$;

revoke all on function public.platform_update_agency_commercial(uuid,text,timestamptz,text,uuid,text,text,text,timestamptz,timestamptz) from public;
grant execute on function public.platform_update_agency_commercial(uuid,text,timestamptz,text,uuid,text,text,text,timestamptz,timestamptz) to authenticated;
