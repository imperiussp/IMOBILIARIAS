create type public.property_segment as enum ('residential', 'commercial');
create type public.publication_state as enum ('draft', 'published');

alter table public.properties
  add column if not exists segment public.property_segment not null default 'residential',
  add column if not exists publication_state public.publication_state not null default 'published';

alter table public.brokers
  add column if not exists area_of_operation text;

create index if not exists properties_public_catalog_idx
on public.properties (publication_state, status, purpose, segment, zone, featured, published_at desc);

create or replace function public.can_manage_property_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.brokers b on b.user_id = ur.user_id
      where ur.user_id = auth.uid()
        and ur.role = 'broker'
        and b.active = true
    );
$$;

drop policy if exists "authenticated upload property storage" on storage.objects;
drop policy if exists "authenticated update property storage" on storage.objects;
drop policy if exists "authenticated delete property storage" on storage.objects;

create policy "authorized upload property storage" on storage.objects
for insert to authenticated
with check (bucket_id = 'property-photos' and public.can_manage_property_content());

create policy "authorized update property storage" on storage.objects
for update to authenticated
using (bucket_id = 'property-photos' and public.can_manage_property_content())
with check (bucket_id = 'property-photos' and public.can_manage_property_content());

create policy "authorized delete property storage" on storage.objects
for delete to authenticated
using (bucket_id = 'property-photos' and public.can_manage_property_content());

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
  p.address,
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
  ) as cover_path
from public.properties p
join public.cities c on c.id = p.city_id
left join public.neighborhoods n on n.id = p.neighborhood_id
left join public.property_types pt on pt.id = p.property_type_id
left join public.brokers b on b.id = p.broker_id
where p.publication_state = 'published'
  and p.status in ('available', 'reserved', 'rented', 'sold');

grant select on public.property_catalog to anon, authenticated;
