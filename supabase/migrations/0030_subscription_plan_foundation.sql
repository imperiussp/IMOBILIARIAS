-- Base comercial para planos e assinaturas.
-- Nomes, preços e limites ficam configuráveis e serão definidos antes do lançamento.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price numeric(12,2),
  annual_price numeric(12,2),
  max_properties integer,
  max_users integer,
  max_ai_descriptions integer,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'trial' check (status in ('trial','active','past_due','cancelled','expired')),
  starts_at timestamptz not null default now(),
  renews_at timestamptz,
  ends_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agency_subscriptions_single_current_idx
on public.agency_subscriptions ((1))
where status in ('trial','active','past_due');

create index if not exists subscription_plans_active_order_idx
on public.subscription_plans (active, display_order);

alter table public.subscription_plans enable row level security;
alter table public.agency_subscriptions enable row level security;

create policy "public read active subscription plans" on public.subscription_plans
for select to anon, authenticated
using (active = true);

create policy "admins manage subscription plans" on public.subscription_plans
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage agency subscription" on public.agency_subscriptions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "authorized users read current subscription" on public.agency_subscriptions
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'broker'
  )
);
