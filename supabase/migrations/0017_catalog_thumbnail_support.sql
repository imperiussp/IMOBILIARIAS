create or replace view public.property_catalog as
select
  p.id,
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
  cover.storage_path as cover_path,
  cover.thumbnail_path as cover_thumbnail_path
from public.properties p
join public.cities c on c.id = p.city_id
left join public.neighborhoods n on n.id = p.neighborhood_id
left join public.property_types pt on pt.id = p.property_type_id
left join public.brokers b on b.id = p.broker_id
left join lateral (
  select pp.storage_path, pp.thumbnail_path
  from public.property_photos pp
  where pp.property_id = p.id
  order by pp.is_cover desc, pp.position asc, pp.created_at asc
  limit 1
) cover on true
where p.publication_state = 'published'
  and p.status in ('available', 'reserved', 'rented', 'sold');

grant select on public.property_catalog to anon, authenticated;
