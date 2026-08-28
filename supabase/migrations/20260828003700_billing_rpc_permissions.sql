-- Billing RPCs are authenticated-only. Explicit grants keep them off the anon API surface.
revoke all on function public.agency_billing_status(uuid) from public, anon;
grant execute on function public.agency_billing_status(uuid) to authenticated;

revoke all on function public.agency_billing_discount_snapshot(uuid) from public, anon;
grant execute on function public.agency_billing_discount_snapshot(uuid) to authenticated;

revoke all on function public.platform_set_agency_billing_discount(uuid,uuid,text,numeric) from public, anon;
grant execute on function public.platform_set_agency_billing_discount(uuid,uuid,text,numeric) to authenticated;

revoke all on function public.platform_clear_agency_billing_discount(uuid,uuid,text) from public, anon;
grant execute on function public.platform_clear_agency_billing_discount(uuid,uuid,text) to authenticated;

revoke all on function public.activate_subscription_from_paid_checkout(uuid) from public, anon, authenticated;
