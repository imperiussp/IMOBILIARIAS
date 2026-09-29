-- Valores comerciais personalizados por cliente.
-- Campo nulo = usa o preço normal do plano.

alter table public.agency_billing_profiles
  add column if not exists monthly_price_override numeric(12,2),
  add column if not exists implementation_fee_override numeric(12,2);

alter table public.agency_billing_profiles
  drop constraint if exists agency_billing_profiles_monthly_price_override_check;
alter table public.agency_billing_profiles
  add constraint agency_billing_profiles_monthly_price_override_check
  check (monthly_price_override is null or monthly_price_override > 0);

alter table public.agency_billing_profiles
  drop constraint if exists agency_billing_profiles_implementation_fee_override_check;
alter table public.agency_billing_profiles
  add constraint agency_billing_profiles_implementation_fee_override_check
  check (implementation_fee_override is null or implementation_fee_override > 0);

create or replace function public.platform_set_agency_custom_billing(
  p_agency_id uuid,
  p_monthly_price numeric default null,
  p_implementation_fee numeric default null
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

  if not exists (select 1 from public.agencies where id = p_agency_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  if p_monthly_price is not null and p_monthly_price <= 0 then
    raise exception 'A mensalidade personalizada deve ser maior que zero.';
  end if;

  if p_implementation_fee is not null and p_implementation_fee <= 0 then
    raise exception 'O valor personalizado da implantação deve ser maior que zero.';
  end if;

  insert into public.agency_billing_profiles (
    agency_id,
    monthly_price_override,
    implementation_fee_override,
    updated_at
  )
  values (
    p_agency_id,
    case when p_monthly_price is null then null else round(p_monthly_price, 2) end,
    case when p_implementation_fee is null then null else round(p_implementation_fee, 2) end,
    now()
  )
  on conflict (agency_id) do update
  set monthly_price_override = excluded.monthly_price_override,
      implementation_fee_override = excluded.implementation_fee_override,
      updated_at = now();
end;
$$;

revoke all on function public.platform_set_agency_custom_billing(uuid,numeric,numeric) from public, anon;
grant execute on function public.platform_set_agency_custom_billing(uuid,numeric,numeric) to authenticated;
