-- Base de cobrança independente do provedor.
-- Não ativa cobrança nem define preços; prepara checkout, eventos e conciliação com idempotência.

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  billing_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  provider text not null,
  provider_session_id text,
  status text not null default 'created',
  amount numeric(12,2),
  currency char(3) not null default 'BRL',
  checkout_url text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('created','pending','paid','expired','cancelled','failed')),
  unique (provider, provider_session_id)
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  agency_id uuid references public.agencies(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending',
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  check (processing_status in ('pending','processing','processed','ignored','failed'))
);

create index if not exists billing_sessions_agency_created_idx
on public.billing_checkout_sessions (agency_id, created_at desc);

create index if not exists billing_events_processing_idx
on public.billing_events (processing_status, created_at)
where processing_status in ('pending','failed');

alter table public.billing_customers enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists "tenant managers read billing customer" on public.billing_customers;
create policy "tenant managers read billing customer" on public.billing_customers
for select to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin());

drop policy if exists "tenant managers read checkout sessions" on public.billing_checkout_sessions;
create policy "tenant managers read checkout sessions" on public.billing_checkout_sessions
for select to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin());

drop policy if exists "platform admins manage billing customers" on public.billing_customers;
create policy "platform admins manage billing customers" on public.billing_customers
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage checkout sessions" on public.billing_checkout_sessions;
create policy "platform admins manage checkout sessions" on public.billing_checkout_sessions
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins read billing events" on public.billing_events;
create policy "platform admins read billing events" on public.billing_events
for select to authenticated
using (public.is_platform_admin());

-- Eventos de webhook devem entrar por função de servidor/service role, nunca direto do navegador.
revoke insert, update, delete on public.billing_events from anon, authenticated;
revoke insert, update, delete on public.billing_customers from anon;
revoke insert, update, delete on public.billing_checkout_sessions from anon;

grant select on public.billing_customers, public.billing_checkout_sessions to authenticated;
grant select on public.billing_events to authenticated;
