-- Restringe leitura direta autenticada de metadados/fotos publicados ao tenant do usuário.
-- O acesso público continua disponível para anon e pelos RPCs públicos por hostname.

drop policy if exists "public read published property photos" on public.property_photos;
create policy "anonymous read published property photos"
on public.property_photos
for select
to anon
using (
  exists (
    select 1 from public.properties p
    where p.id = property_photos.property_id
      and p.publication_state = 'published'::publication_state
      and p.status = any(array[
        'available'::property_status,
        'reserved'::property_status,
        'rented'::property_status,
        'sold'::property_status
      ])
  )
);

drop policy if exists "public read published feature links" on public.property_feature_links;
create policy "anonymous read published feature links"
on public.property_feature_links
for select
to anon
using (
  exists (
    select 1 from public.properties p
    where p.id = property_feature_links.property_id
      and p.publication_state = 'published'::publication_state
      and p.status = any(array[
        'available'::property_status,
        'reserved'::property_status,
        'rented'::property_status,
        'sold'::property_status
      ])
  )
);

drop policy if exists "public read published tenant property storage" on storage.objects;
create policy "anonymous read published tenant property storage"
on storage.objects
for select
to anon
using (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
  and exists (
    select 1 from public.properties p
    where p.id = public.storage_tenant_property_id(objects.name)
      and p.agency_id = public.storage_agency_id(objects.name)
      and p.publication_state = 'published'::publication_state
      and p.status = any(array[
        'available'::property_status,
        'reserved'::property_status,
        'rented'::property_status,
        'sold'::property_status
      ])
  )
);
