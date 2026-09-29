create table if not exists public.auth_mail_bridge_requests (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  subject text not null,
  html_body text not null,
  text_body text not null,
  kind text not null check (kind in ('admin_access','password_recovery','paid_onboarding')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  last_error text
);

alter table public.auth_mail_bridge_requests enable row level security;

revoke all on table public.auth_mail_bridge_requests from anon, authenticated;
grant select, insert, update, delete on table public.auth_mail_bridge_requests to service_role;

create index if not exists auth_mail_bridge_requests_email_created_idx
  on public.auth_mail_bridge_requests (lower(email), created_at desc);

create index if not exists auth_mail_bridge_requests_expiry_idx
  on public.auth_mail_bridge_requests (expires_at)
  where consumed_at is null;
