alter table public.agency_billing_discounts
  drop constraint if exists agency_billing_discounts_discount_percent_check;

alter table public.agency_billing_discounts
  add constraint agency_billing_discounts_discount_percent_check
  check (discount_percent >= 0 and discount_percent <= 100);

alter table public.agency_billing_discounts
  drop constraint if exists agency_billing_discounts_final_amount_check;

alter table public.agency_billing_discounts
  add constraint agency_billing_discounts_final_amount_check
  check (final_amount >= 0);

create or replace function public.carry_prepaid_coupon_to_first_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.platform_coupons%rowtype;
  p public.subscription_plans%rowtype;
  base numeric(12,2);
  reduction numeric(12,2);
  final numeric(12,2);
  pct numeric(12,4);
begin
  if new.agency_id is null or new.coupon_id is null then return new; end if;
  if old.agency_id is not null then return new; end if;
  if new.charge_type <> 'implementation' then return new; end if;

  select * into c
  from public.platform_coupons
  where id = new.coupon_id and active = true and target = 'subscription';
  if not found then return new; end if;

  select * into p from public.subscription_plans where id = new.plan_id;
  if not found then return new; end if;
  if not (p.code = any(c.plan_codes)) then return new; end if;

  base := round(case when new.billing_cycle = 'annual'
    then coalesce(p.annual_price,0)
    else coalesce(p.monthly_price,0) end, 2);
  if base <= 0 then return new; end if;

  reduction := round(case when c.discount_type = 'percent'
    then base * c.discount_value / 100
    else c.discount_value end, 2);
  final := greatest(0, round(base - reduction, 2));
  if final >= base then return new; end if;
  pct := round(((base-final)/base)*100,4);

  insert into public.agency_billing_discounts(
    agency_id,plan_id,billing_cycle,base_amount,final_amount,
    discount_percent,status,source_coupon_id
  ) values(
    new.agency_id,new.plan_id,new.billing_cycle,base,final,
    pct,'active',c.id
  ) on conflict do nothing;

  return new;
end;
$function$;
