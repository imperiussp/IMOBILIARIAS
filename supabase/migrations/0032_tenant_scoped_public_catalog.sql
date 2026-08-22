-- Catálogo público passa a expor agency_id para que cada domínio carregue apenas sua imobiliária.
-- A view é recriada porque a inclusão de agency_id altera a ordem/estrutura das colunas.
drop view if exists public.property_catalog;

create view public.property_catalog
with (security_invoker = true)
as
select
  p.id,
  p.agency_id,
  p.code,
  p.slug,
  p.title,
  p.description,
  p.purpose,
  p.zone,
  p.segment,
  p.status,
  p.publication_state,
  p.price,
  p.bedrooms,
  p.suites,
  p.bathrooms,
  p.parking_spaces,
  p.built_area_m2,
  p.land_area_m2,
  case when p.address_public then p.address else null end as address,
  p.address_public,
  p.featured,
  p.published_at,
  c.name as city,
  c.state_code,
  n.name as neighborhood,
  pt.name as property_type,
  b.name as broker_name,
  b.whatsapp as broker_whatsapp,
  b.creci as broker_creci,
  b.area_of_operation as broker_area_of_operation,
  (
    select pp.storage_path
    from public.property_photos pp
    where pp.property_id = p.id
    order by pp.is_cover desc, pp.position asc, pp.created_at asc
    limit 1
  ) as cover_path,
  (
    select coalesce(pp.thumbnail_path, pp.storage_path)
    from public.property_photos pp
    where pp.property_id = p.id
    order by pp.is_cover desc, pp.position asc, pp.created_at asc
    limit 1
  ) as cover_thumbnail_path
from public.properties p
join public.cities c on c.id = p.city_id
left join public.neighborhoods n on n.id = p.neighborhood_id
left join public.property_types pt on pt.id = p.property_type_id
left join public.brokers b on b.id = p.broker_id
where p.publication_state = 'published'
  and p.status in ('available', 'reserved', 'rented', 'sold');

grant select on public.property_catalog to anon, authenticated;

create or replace function public.public_catalog_for_host(p_hostname text)
returns setof public.property_catalog
language sql
stable
security definer
set search_path = public
as $$
  select pc.*
  from public.property_catalog pc
  join public.agency_domains d on d.agency_id = pc.agency_id
  join public.agencies a on a.id = pc.agency_id
  where lower(d.hostname) = lower(trim(p_hostname))
    and d.verified = true
    and a.status in ('trial','active','past_due')
  order by pc.featured desc, pc.published_at desc nulls last
$$;

grant execute on function public.public_catalog_for_host(text) to anon, authenticated;
