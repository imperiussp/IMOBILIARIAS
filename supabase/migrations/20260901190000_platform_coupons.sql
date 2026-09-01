create table if not exists public.platform_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  target text not null check (target in ('subscription','implementation')),
  plan_codes text[] not null default '{}'::text[],
  active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_coupons_percent_limit check (discount_type <> 'percent' or discount_value <= 100),
  constraint platform_coupons_plan_codes_check check (cardinality(plan_codes) > 0)
);
create index if not exists platform_coupons_active_code_idx on public.platform_coupons (active, upper(code));
alter table public.platform_coupons enable row level security;
drop policy if exists platform_coupons_admin_all on public.platform_coupons;
create policy platform_coupons_admin_all on public.platform_coupons for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.platform_coupons to authenticated;
revoke all on public.platform_coupons from anon;
create or replace function public.touch_platform_coupon_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_touch_platform_coupon on public.platform_coupons;
create trigger trg_touch_platform_coupon before update on public.platform_coupons for each row execute function public.touch_platform_coupon_updated_at();
alter table public.prepaid_purchase_intents add column if not exists coupon_id uuid null references public.platform_coupons(id) on delete set null;
alter table public.billing_checkout_sessions add column if not exists platform_coupon_id uuid null references public.platform_coupons(id) on delete set null;
alter table public.agency_billing_discounts add column if not exists source_coupon_id uuid null references public.platform_coupons(id) on delete set null;
create unique index if not exists agency_billing_discounts_source_coupon_once on public.agency_billing_discounts(agency_id,source_coupon_id) where source_coupon_id is not null;
create or replace function public.carry_prepaid_coupon_to_first_subscription() returns trigger language plpgsql security definer set search_path=public as $$
declare c public.platform_coupons%rowtype; p public.subscription_plans%rowtype; base numeric(12,2); reduction numeric(12,2); final numeric(12,2); pct numeric(12,4);
begin
  if new.agency_id is null or new.coupon_id is null or old.agency_id is not null or new.charge_type <> 'implementation' then return new; end if;
  select * into c from public.platform_coupons where id=new.coupon_id and active=true and target='subscription'; if not found then return new; end if;
  select * into p from public.subscription_plans where id=new.plan_id; if not found or not (p.code=any(c.plan_codes)) then return new; end if;
  base:=round(case when new.billing_cycle='annual' then coalesce(p.annual_price,0) else coalesce(p.monthly_price,0) end,2); if base<=0 then return new; end if;
  reduction:=round(case when c.discount_type='percent' then base*c.discount_value/100 else c.discount_value end,2); final:=round(base-reduction,2); if final<=0 or final>=base then return new; end if;
  pct:=round(((base-final)/base)*100,4);
  insert into public.agency_billing_discounts(agency_id,plan_id,billing_cycle,base_amount,final_amount,discount_percent,status,source_coupon_id)
  values(new.agency_id,new.plan_id,new.billing_cycle,base,final,pct,'active',c.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists trg_carry_prepaid_coupon on public.prepaid_purchase_intents;
create trigger trg_carry_prepaid_coupon after update of agency_id on public.prepaid_purchase_intents for each row execute function public.carry_prepaid_coupon_to_first_subscription();