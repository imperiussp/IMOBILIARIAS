-- Auditoria final de EXECUTE para funções SECURITY DEFINER usadas pelo SaaS.
-- Remove o privilégio implícito de PUBLIC e concede somente aos papéis necessários.

revoke all on function public.agency_usage_snapshot(uuid) from public;
revoke all on function public.agency_usage_snapshot(uuid) from anon;
grant execute on function public.agency_usage_snapshot(uuid) to authenticated;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_platform_admin() from anon;
grant execute on function public.is_platform_admin() to authenticated;

revoke all on function public.is_agency_member(uuid) from public;
revoke all on function public.is_agency_member(uuid) from anon;
grant execute on function public.is_agency_member(uuid) to authenticated;

revoke all on function public.can_manage_agency(uuid) from public;
revoke all on function public.can_manage_agency(uuid) from anon;
grant execute on function public.can_manage_agency(uuid) to authenticated;

revoke all on function public.current_agency_ids() from public;
revoke all on function public.current_agency_ids() from anon;
grant execute on function public.current_agency_ids() to authenticated;

-- Funções internas de trigger/helper permanecem sem acesso direto de clientes.
revoke all on function public.notify_broker_about_new_lead() from public, anon, authenticated;
revoke all on function public.protect_notification_delivery_fields() from public, anon, authenticated;
revoke all on function public.protect_domain_verification_fields() from public, anon, authenticated;
revoke all on function public.validate_broker_agency_membership() from public, anon, authenticated;
revoke all on function public.validate_subscription_plan_features() from public, anon, authenticated;
revoke all on function public.attach_default_trial_plan_to_agency() from public, anon, authenticated;
revoke all on function public.attach_default_trial_plan_to_agency_from_id(uuid) from public, anon, authenticated;
revoke all on function public.ensure_agency_inbound_email(uuid) from public, anon, authenticated;
revoke all on function public.ensure_agency_inbound_email_trigger() from public, anon, authenticated;
