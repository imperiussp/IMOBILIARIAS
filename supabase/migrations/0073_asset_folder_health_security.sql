-- Corrige a view de integridade de pastas para respeitar o RLS do usuário que consulta.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

drop view if exists public.agency_asset_folder_health;
create view public.agency_asset_folder_health
with (security_invoker = true)
as
select
  a.agency_id,
  a.kind,
  count(*)::bigint as total_files,
  count(*) filter (where split_part(a.storage_path,'/',1)=a.agency_id::text)::bigint as tenant_scoped_files,
  count(*) filter (
    where a.kind <> 'property_photo'
       or a.property_id is null
       or a.storage_path like a.agency_id::text || '/' || a.property_id::text || '/photos/%'
  )::bigint as organized_files
from public.agency_assets a
group by a.agency_id,a.kind;

revoke all on public.agency_asset_folder_health from public, anon;
grant select on public.agency_asset_folder_health to authenticated;
