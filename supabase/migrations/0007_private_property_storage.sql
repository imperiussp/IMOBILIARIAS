-- Fotos ficam privadas no Storage; o site público recebe URLs assinadas temporárias.
update storage.buckets
set public = false
where id = 'property-photos';

create or replace function public.storage_property_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  first_folder text;
begin
  first_folder := (storage.foldername(object_name))[1];
  if first_folder is null then return null; end if;
  return first_folder::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists "public read property storage" on storage.objects;
drop policy if exists "authorized upload property storage" on storage.objects;
drop policy if exists "authorized update property storage" on storage.objects;
drop policy if exists "authorized delete property storage" on storage.objects;

after_drop_placeholder: do $$ begin end $$;

create policy "public read published property storage" on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1 from public.properties p
    where p.id = public.storage_property_id(name)
      and p.publication_state = 'published'
      and p.status in ('available', 'reserved', 'rented', 'sold')
  )
);

create policy "authorized upload own property storage" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'property-photos'
  and exists (
    select 1 from public.properties p
    left join public.brokers b on b.id = p.broker_id
    where p.id = public.storage_property_id(name)
      and (public.is_admin() or (b.user_id = auth.uid() and b.active = true))
  )
);

create policy "authorized update own property storage" on storage.objects
for update to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1 from public.properties p
    left join public.brokers b on b.id = p.broker_id
    where p.id = public.storage_property_id(name)
      and (public.is_admin() or (b.user_id = auth.uid() and b.active = true))
  )
)
with check (
  bucket_id = 'property-photos'
  and exists (
    select 1 from public.properties p
    left join public.brokers b on b.id = p.broker_id
    where p.id = public.storage_property_id(name)
      and (public.is_admin() or (b.user_id = auth.uid() and b.active = true))
  )
);

create policy "authorized delete own property storage" on storage.objects
for delete to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1 from public.properties p
    left join public.brokers b on b.id = p.broker_id
    where p.id = public.storage_property_id(name)
      and (public.is_admin() or (b.user_id = auth.uid() and b.active = true))
  )
);
