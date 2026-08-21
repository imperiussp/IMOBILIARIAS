-- Registro central de arquivos por imobiliária.
-- Mantém o Storage organizado e auditável sem misturar arquivos entre tenants.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.agency_assets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  broker_id uuid references public.brokers(id) on delete cascade,
  document_id uuid references public.agency_documents(id) on delete cascade,
  kind text not null check (kind in ('branding','property_photo','property_document','agency_document','broker_media','other')),
  bucket_id text not null,
  storage_path text not null,
  original_name text,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(bucket_id, storage_path)
);

create index if not exists agency_assets_tenant_kind_idx
on public.agency_assets(agency_id, kind, created_at desc);
create index if not exists agency_assets_property_idx
on public.agency_assets(agency_id, property_id) where property_id is not null;
create index if not exists agency_assets_document_idx
on public.agency_assets(agency_id, document_id) where document_id is not null;

alter table public.agency_assets enable row level security;

drop policy if exists "tenant members read asset registry" on public.agency_assets;
create policy "tenant members read asset registry" on public.agency_assets
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());

drop policy if exists "tenant managers manage asset registry" on public.agency_assets;
create policy "tenant managers manage asset registry" on public.agency_assets
for all to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin())
with check (public.can_manage_agency(agency_id) or public.is_platform_admin());

create or replace function public.register_agency_asset(
  p_agency_id uuid,
  p_kind text,
  p_bucket_id text,
  p_storage_path text,
  p_property_id uuid default null,
  p_broker_id uuid default null,
  p_document_id uuid default null,
  p_original_name text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
begin
  if not public.can_manage_agency(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  if nullif(trim(p_storage_path),'') is null then
    raise exception 'Caminho do arquivo é obrigatório.';
  end if;

  if split_part(p_storage_path, '/', 1) <> p_agency_id::text then
    raise exception 'Arquivo fora da pasta da imobiliária.';
  end if;

  if p_property_id is not null and not exists(
    select 1 from public.properties p where p.id=p_property_id and p.agency_id=p_agency_id
  ) then raise exception 'Imóvel fora da imobiliária.'; end if;

  if p_broker_id is not null and not exists(
    select 1 from public.brokers b where b.id=p_broker_id and b.agency_id=p_agency_id
  ) then raise exception 'Corretor fora da imobiliária.'; end if;

  if p_document_id is not null and not exists(
    select 1 from public.agency_documents d where d.id=p_document_id and d.agency_id=p_agency_id
  ) then raise exception 'Documento fora da imobiliária.'; end if;

  insert into public.agency_assets(
    agency_id,property_id,broker_id,document_id,kind,bucket_id,storage_path,
    original_name,mime_type,size_bytes,created_by
  ) values (
    p_agency_id,p_property_id,p_broker_id,p_document_id,p_kind,p_bucket_id,p_storage_path,
    nullif(trim(coalesce(p_original_name,'')),''),nullif(trim(coalesce(p_mime_type,'')),''),p_size_bytes,auth.uid()
  )
  on conflict(bucket_id,storage_path) do update set
    property_id=excluded.property_id,
    broker_id=excluded.broker_id,
    document_id=excluded.document_id,
    kind=excluded.kind,
    original_name=coalesce(excluded.original_name,public.agency_assets.original_name),
    mime_type=coalesce(excluded.mime_type,public.agency_assets.mime_type),
    size_bytes=coalesce(excluded.size_bytes,public.agency_assets.size_bytes)
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.register_agency_asset(uuid,text,text,text,uuid,uuid,uuid,text,text,bigint) from public;
grant execute on function public.register_agency_asset(uuid,text,text,text,uuid,uuid,uuid,text,text,bigint) to authenticated;
