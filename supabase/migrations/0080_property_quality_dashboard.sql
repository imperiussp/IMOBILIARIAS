-- Indicadores de qualidade cadastral dos imóveis por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

-- security_invoker garante que a view respeite o RLS de properties/property_photos.
drop view if exists public.agency_property_quality;
create view public.agency_property_quality
with (security_invoker = true)
as
select
  p.agency_id,
  p.id as property_id,
  p.code,
  p.title,
  p.publication_state,
  p.status,
  (
    (case when nullif(trim(coalesce(p.title,'')),'') is not null then 15 else 0 end) +
    (case when nullif(trim(coalesce(p.description,'')),'') is not null and length(trim(p.description)) >= 80 then 20 else 0 end) +
    (case when coalesce(p.price,0) > 0 then 15 else 0 end) +
    (case when p.city_id is not null then 10 else 0 end) +
    (case when p.property_type_id is not null then 10 else 0 end) +
    (case when exists(select 1 from public.property_photos ph where ph.property_id=p.id) then 20 else 0 end) +
    (case when exists(select 1 from public.property_photos ph where ph.property_id=p.id and ph.is_cover=true) then 10 else 0 end)
  )::integer as quality_score,
  not exists(select 1 from public.property_photos ph where ph.property_id=p.id) as missing_photos,
  not exists(select 1 from public.property_photos ph where ph.property_id=p.id and ph.is_cover=true) as missing_cover,
  (nullif(trim(coalesce(p.description,'')),'') is null or length(trim(coalesce(p.description,''))) < 80) as weak_description,
  coalesce(p.price,0) <= 0 as missing_price
from public.properties p;

revoke all on public.agency_property_quality from public,anon;
grant select on public.agency_property_quality to authenticated;
