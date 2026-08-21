-- Gestão operacional de assinaturas pela administração global da LENOY.
-- Nenhuma imobiliária pode trocar o próprio plano/status diretamente.

create or replace function public.platform_set_agency_subscription(
  p_agency_id uuid,
  p_plan_id uuid,
  p_status text default 'active',
  p_renews_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_id uuid;
  result_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  if p_status not in ('trial','active','past_due','cancelled','expired') then
    raise exception 'Status de assinatura inválido.';
  end if;

  if not exists (select 1 from public.agencies a where a.id = p_agency_id) then
    raise exception 'Imobiliária não encontrada.';
  end if;

  if not exists (select 1 from public.subscription_plans sp where sp.id = p_plan_id) then
    raise exception 'Plano não encontrado.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_agency_id::text || ':subscription'));

  select s.id into current_id
  from public.agency_subscriptions s
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
  order by s.starts_at desc
  limit 1;

  if p_status in ('trial','active','past_due') then
    if current_id is not null then
      update public.agency_subscriptions
      set status = 'expired', ends_at = coalesce(ends_at, now()), updated_at = now()
      where id = current_id;
    end if;

    insert into public.agency_subscriptions (
      agency_id, plan_id, status, starts_at, renews_at, ends_at
    ) values (
      p_agency_id, p_plan_id, p_status, now(), p_renews_at, p_ends_at
    ) returning id into result_id;
  else
    if current_id is null then
      insert into public.agency_subscriptions (
        agency_id, plan_id, status, starts_at, renews_at, ends_at
      ) values (
        p_agency_id, p_plan_id, p_status, now(), null, coalesce(p_ends_at, now())
      ) returning id into result_id;
    else
      update public.agency_subscriptions
      set status = p_status,
          renews_at = null,
          ends_at = coalesce(p_ends_at, now()),
          updated_at = now()
      where id = current_id
      returning id into result_id;
    end if;
  end if;

  return result_id;
end;
$$;

revoke all on function public.platform_set_agency_subscription(uuid, uuid, text, timestamptz, timestamptz) from public;
grant execute on function public.platform_set_agency_subscription(uuid, uuid, text, timestamptz, timestamptz) to authenticated;

create or replace function public.platform_set_agency_status(
  p_agency_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  if p_status not in ('trial','active','past_due','suspended','cancelled') then
    raise exception 'Status de imobiliária inválido.';
  end if;

  update public.agencies
  set status = p_status, updated_at = now()
  where id = p_agency_id;

  if not found then
    raise exception 'Imobiliária não encontrada.';
  end if;
end;
$$;

revoke all on function public.platform_set_agency_status(uuid, text) from public;
grant execute on function public.platform_set_agency_status(uuid, text) to authenticated;

-- Mantém a tabela de assinaturas sob controle da plataforma, inclusive para clientes autenticados.
revoke insert, update, delete on public.agency_subscriptions from authenticated;
grant select on public.agency_subscriptions to authenticated;
