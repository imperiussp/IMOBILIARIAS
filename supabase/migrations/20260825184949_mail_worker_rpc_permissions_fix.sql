revoke all on function public.agency_email_usage_snapshot(uuid) from public, anon;
grant execute on function public.agency_email_usage_snapshot(uuid) to authenticated, service_role;
