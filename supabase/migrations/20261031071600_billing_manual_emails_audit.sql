-- Auditoria isolada dos e-mails de cobrança enviados manualmente pelos administradores da plataforma.
create table if not exists public.billing_manual_email_deliveries (
 request_id uuid primary key,
 agency_id uuid not null references public.agencies(id) on delete restrict,
 subscription_id uuid not null references public.agency_subscriptions(id) on delete restrict,
 requested_by uuid not null references auth.users(id) on delete restrict,
 destination text not null,
 due_date date not null,
 amount numeric(12,2) not null check(amount > 0),
 status text not null check(status in ('sending','sent','failed')),
 checkout_url text,
 provider_message_id text,
 error_message text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.billing_manual_email_deliveries enable row level security;
revoke all on public.billing_manual_email_deliveries from anon, authenticated;
create index if not exists billing_manual_email_deliveries_agency_date_idx on public.billing_manual_email_deliveries(agency_id,created_at desc);