-- Sincroniza property_photos com o inventário central de arquivos por imobiliária.
-- Backfill preserva arquivos legados; uploads novos seguem a convenção organizada no código.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.sync_property_photo_asset_registry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.agency_assets
    where bucket_id='property-photos' and storage_path in (old.storage_path, coalesce(old.thumbnail_path,''));
    return old;
  end if;

  select p.agency_id into tenant_id from public.properties p where p.id=new.property_id;
  if tenant_id is null then return new; end if;

  insert into public.agency_assets(agency_id,property_id,kind,bucket_id,storage_path,created_by)
  values(tenant_id,new.property_id,'property_photo','property-photos',new.storage_path,auth.uid())
  on conflict(bucket_id,storage_path) do update set agency_id=excluded.agency_id,property_id=excluded.property_id,kind='property_photo';

  if new.thumbnail_path is not null and new.thumbnail_path <> '' then
    insert into public.agency_assets(agency_id,property_id,kind,bucket_id,storage_path,created_by)
    values(tenant_id,new.property_id,'property_photo','property-photos',new.thumbnail_path,auth.uid())
    on conflict(bucket_id,storage_path) do update set agency_id=excluded.agency_id,property_id=excluded.property_id,kind='property_photo';
  end if;

  if tg_op='UPDATE' then
    if old.storage_path is distinct from new.storage_path then
      delete from public.agency_assets where bucket_id='property-photos' and storage_path=old.storage_path;
    end if;
    if old.thumbnail_path is distinct from new.thumbnail_path and old.thumbnail_path is not null then
      delete from public.agency_assets where bucket_id='property-photos' and storage_path=old.thumbnail_path;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_property_photo_asset_registry() from public, anon, authenticated;

drop trigger if exists property_photos_asset_registry on public.property_photos;
create trigger property_photos_asset_registry
after insert or update of property_id,storage_path,thumbnail_path or delete on public.property_photos
for each row execute function public.sync_property_photo_asset_registry();

insert into public.agency_assets(agency_id,property_id,kind,bucket_id,storage_path)
select p.agency_id, pp.property_id, 'property_photo', 'property-photos', pp.storage_path
from public.property_photos pp join public.properties p on p.id=pp.property_id
where pp.storage_path is not null and pp.storage_path<>''
on conflict(bucket_id,storage_path) do nothing;

insert into public.agency_assets(agency_id,property_id,kind,bucket_id,storage_path)
select p.agency_id, pp.property_id, 'property_photo', 'property-photos', pp.thumbnail_path
from public.property_photos pp join public.properties p on p.id=pp.property_id
where pp.thumbnail_path is not null and pp.thumbnail_path<>''
on conflict(bucket_id,storage_path) do nothing;

create or replace view public.agency_asset_folder_health as
select
  a.agency_id,
  a.kind,
  count(*)::bigint as total_files,
  count(*) filter (
    where split_part(a.storage_path,'/',1)=a.agency_id::text
  )::bigint as tenant_scoped_files,
  count(*) filter (
    where a.kind <> 'property_photo'
       or a.property_id is null
       or a.storage_path like a.agency_id::text || '/' || a.property_id::text || '/photos/%'
  )::bigint as organized_files
from public.agency_assets a
group by a.agency_id,a.kind;

revoke all on public.agency_asset_folder_health from public, anon;
grant select on public.agency_asset_folder_health to authenticated;
