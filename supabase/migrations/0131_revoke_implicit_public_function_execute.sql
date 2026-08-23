-- Corrige instalações que já haviam aplicado a 0130 antes do ajuste de PUBLIC.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Superfície deliberadamente pública do site/onboarding.
grant execute on function public.create_public_lead_for_host(text,uuid,text,text,text,text,text) to anon;
grant execute on function public.public_catalog_for_host(text) to anon;
grant execute on function public.public_property_for_host(text,uuid) to anon;
grant execute on function public.public_property_photos_for_host(text,uuid) to anon;
grant execute on function public.resolve_agency_by_host(text) to anon;
grant execute on function public.resolve_agency_by_slug(text) to anon;
grant execute on function public.agency_slug_available(text) to anon;
grant execute on function public.platform_registration_status() to anon;
grant execute on function public.platform_public_catalog_status() to anon;
grant execute on function public.public_catalog_runtime_enabled() to anon;
grant execute on function public.public_registration_runtime_enabled() to anon;
grant execute on function public.initial_admin_available() to anon;
grant execute on function public.project_identity() to anon;
