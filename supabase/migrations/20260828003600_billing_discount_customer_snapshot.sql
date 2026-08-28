-- Permite que o responsável da própria imobiliária veja somente o desconto comercial aplicável ao seu próximo ciclo.
create or replace function public.agency_billing_discount_snapshot(p_agency_id uuid)
returns table (
  plan_id uuid,
  billing_cycle text,
  base_amount numeric,
  final_amount numeric,
  discount_percent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_agency(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;

  return query
  select d.plan_id, d.billing_cycle, d.base_amount, d.final_amount, d.discount_percent
  from public.agency_billing_discounts d
  where d.agency_id = p_agency_id
    and d.status = 'active'
    and (d.valid_until is null or d.valid_until > now())
  order by d.created_at desc;
end;
$$;

revoke all on function public.agency_billing_discount_snapshot(uuid) from public;
grant execute on function public.agency_billing_discount_snapshot(uuid) to authenticated;
