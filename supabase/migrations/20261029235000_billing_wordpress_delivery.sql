-- Reuse the existing one-time WordPress email bridge for billing when Resend is unavailable.
-- Existing auth types and permissions remain unchanged.
alter table public.auth_mail_bridge_requests
  drop constraint if exists auth_mail_bridge_requests_kind_check;
alter table public.auth_mail_bridge_requests
  add constraint auth_mail_bridge_requests_kind_check
  check (kind in ('admin_access','password_recovery','paid_onboarding','billing_notice'));