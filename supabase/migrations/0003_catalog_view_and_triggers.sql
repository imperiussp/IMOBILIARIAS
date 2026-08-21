create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brokers_set_updated_at
before update on public.brokers
for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create trigger sync_jobs_set_updated_at
before update on public.synchronization_jobs
for each row execute function public.set_updated_at();

create or replace view public.property_catalog as
select
  p.id,
  p.code,
  p.slug,
  p.title,
  p.description,
  p.purpose,
  p.zone,
  p.status,
  p.price,
  p.bedrooms,
  p.suites,
  p.bathrooms,
  p.parking_spaces,
  p.built_area_m2,
  p.land_area_m2,
  p.featured,
  p.published_at,
  c.name as city,
  c.state_code,
  n.name as neighborhood,
  pt.name as property_type,
  b.name as broker_name,
  b.whatsapp as broker_whatsapp,
  b.creci as broker_creci,
  (
    select pp.storage_path
    from public.property_photos pp
    where pp.property_id = p.id
    order by pp.is_cover desc, pp.position asc, pp.created_at asc
    limit 1
  ) as cover_path
from public.properties p
join public.cities c on c.id = p.city_id
left join public.neighborhoods n on n.id = p.neighborhood_id
left join public.property_types pt on pt.id = p.property_type_id
left join public.brokers b on b.id = p.broker_id
where p.status in ('available', 'reserved', 'rented', 'sold');

grant select on public.property_catalog to anon, authenticated;

create index properties_featured_published_idx
on public.properties (featured desc, published_at desc nulls last)
where status in ('available', 'reserved');
