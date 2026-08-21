-- Enforcement server-side dos limites de anexos da Central de documentos.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.agency_can_upload_document(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select s.documents_enabled and (s.max_uploads is null or s.used_uploads < s.max_uploads)
    from public.agency_document_usage_snapshot(p_agency_id) s
  ),false)
$$;
revoke all on function public.agency_can_upload_document(uuid) from public;
grant execute on function public.agency_can_upload_document(uuid) to authenticated;

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

  if nullif(trim(p_storage_path),'') is null then raise exception 'Caminho do arquivo é obrigatório.'; end if;
  if split_part(p_storage_path,'/',1) <> p_agency_id::text then raise exception 'Arquivo fora da pasta da imobiliária.'; end if;

  if p_kind='agency_document' and not public.is_platform_admin() and not public.agency_can_upload_document(p_agency_id) then
    raise exception 'Limite de anexos do plano atingido ou Central de documentos indisponível.';
  end if;

  if p_property_id is not null and not exists(select 1 from public.properties p where p.id=p_property_id and p.agency_id=p_agency_id) then
    raise exception 'Imóvel fora da imobiliária.';
  end if;
  if p_broker_id is not null and not exists(select 1 from public.brokers b where b.id=p_broker_id and b.agency_id=p_agency_id) then
    raise exception 'Corretor fora da imobiliária.';
  end if;
  if p_document_id is not null and not exists(select 1 from public.agency_documents d where d.id=p_document_id and d.agency_id=p_agency_id) then
    raise exception 'Documento fora da imobiliária.';
  end if;

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
