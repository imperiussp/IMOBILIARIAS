-- Isolamento de arquivos do Storage por imobiliária.
-- Novo padrão obrigatório: agency_id/property_id/origem/arquivo.jpg

create or replace function public.storage_agency_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  folder text;
begin
  folder := (storage.foldername(object_name))[1];
  if folder is null then return null; end if;
  return folder::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.storage_tenant_property_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  folder text;
begin
  folder := (storage.foldername(object_name))[2];
  if folder is null then return null; end if;
  return folder::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.storage_matches_tenant_property(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    where p.id = public.storage_tenant_property_id(object_name)
      and p.agency_id = public.storage_agency_id(object_name)
  )
$$;

grant execute on function public.storage_agency_id(text) to anon, authenticated;
grant execute on function public.storage_tenant_property_id(text) to anon, authenticated;
grant execute on function public.storage_matches_tenant_property(text) to anon, authenticated;

drop policy if exists "public read published property storage" on storage.objects;
drop policy if exists "authorized read own property storage" on storage.objects;
drop policy if exists "authorized upload own property storage" on storage.objects;
drop policy if exists "authorized update own property storage" on storage.objects;
drop policy if exists "authorized delete own property storage" on storage.objects;

-- Fotos públicas continuam acessíveis somente quando pertencem a um imóvel publicado.
create policy "public read published tenant property storage" on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
  and exists (
    select 1
    from public.properties p
    where p.id = public.storage_tenant_property_id(name)
      and p.agency_id = public.storage_agency_id(name)
      and p.publication_state = 'published'
      and p.status in ('available','reserved','rented','sold')
  )
);

-- Proprietário/admin da imobiliária e o corretor responsável podem ler os arquivos privados.
create policy "tenant members read managed property storage" on storage.objects
for select to authenticated
using (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
  and exists (
    select 1
    from public.properties p
    left join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
    where p.id = public.storage_tenant_property_id(name)
      and p.agency_id = public.storage_agency_id(name)
      and (
        public.can_manage_agency(p.agency_id)
        or (b.user_id = auth.uid() and b.active = true)
      )
  )
);

create policy "tenant upload managed property storage" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
  and exists (
    select 1
    from public.properties p
    left join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
    where p.id = public.storage_tenant_property_id(name)
      and p.agency_id = public.storage_agency_id(name)
      and (
        public.can_manage_agency(p.agency_id)
        or (b.user_id = auth.uid() and b.active = true)
      )
  )
);

create policy "tenant update managed property storage" on storage.objects
for update to authenticated
using (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
  and exists (
    select 1
    from public.properties p
    left join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
    where p.id = public.storage_tenant_property_id(name)
      and p.agency_id = public.storage_agency_id(name)
      and (
        public.can_manage_agency(p.agency_id)
        or (b.user_id = auth.uid() and b.active = true)
      )
  )
)
with check (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
);

create policy "tenant delete managed property storage" on storage.objects
for delete to authenticated
using (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
  and exists (
    select 1
    from public.properties p
    left join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
    where p.id = public.storage_tenant_property_id(name)
      and p.agency_id = public.storage_agency_id(name)
      and (
        public.can_manage_agency(p.agency_id)
        or (b.user_id = auth.uid() and b.active = true)
      )
  )
);
