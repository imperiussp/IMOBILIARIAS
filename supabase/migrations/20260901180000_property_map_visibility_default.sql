alter table public.properties
  add column if not exists map_public boolean not null default true;

create or replace view public.property_catalog as
select
  p.id,
  p.agency_id,
  coalesce(nullif(p.display_code, ''::text), p.code) as code,
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
  case when p.address_public then p.address else null::text end as address,
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
    order by pp.is_cover desc, pp."position", pp.created_at
    limit 1
  ) as cover_path,
  (
    select coalesce(pp.thumbnail_path, pp.storage_path)
    from public.property_photos pp
    where pp.property_id = p.id
    order by pp.is_cover desc, pp."position", pp.created_at
    limit 1
  ) as cover_thumbnail_path,
  p.marketing_label,
  p.latitude,
  p.longitude,
  b.photo_url as broker_photo_url,
  p.map_public
from public.properties p
join public.cities c on c.id = p.city_id
left join public.neighborhoods n on n.id = p.neighborhood_id
left join public.property_types pt on pt.id = p.property_type_id
left join public.brokers b on b.id = p.broker_id
where p.publication_state = 'published'::publication_state
  and p.status = any (array['available'::property_status, 'reserved'::property_status, 'rented'::property_status, 'sold'::property_status]);

grant select on public.property_catalog to anon, authenticated;
