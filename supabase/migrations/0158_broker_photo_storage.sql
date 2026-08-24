insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('broker-photos','broker-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "tenant broker photos insert" on storage.objects;
drop policy if exists "tenant broker photos update" on storage.objects;
drop policy if exists "tenant broker photos delete" on storage.objects;

create policy "tenant broker photos insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='broker-photos'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
);

create policy "tenant broker photos update" on storage.objects
for update to authenticated
using (
  bucket_id='broker-photos'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
)
with check (
  bucket_id='broker-photos'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
);

create policy "tenant broker photos delete" on storage.objects
for delete to authenticated
using (
  bucket_id='broker-photos'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
);
