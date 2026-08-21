-- Endurecimento da organização de arquivos da Central de Documentos.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar em Moto Connect ou outros projetos.

-- Reaproveita o helper tolerante a caminhos inválidos criado para property-photos.
-- storage_agency_id() captura UUID inválido e devolve null, evitando cast direto em policy.

drop policy if exists "tenant document storage read" on storage.objects;
create policy "tenant document storage read" on storage.objects
for select to authenticated
using (
  bucket_id = 'agency-documents'
  and public.storage_agency_id(name) is not null
  and (
    public.is_agency_member(public.storage_agency_id(name))
    or public.is_platform_admin()
  )
);

drop policy if exists "tenant document storage write" on storage.objects;
create policy "tenant document storage write" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'agency-documents'
  and public.storage_agency_id(name) is not null
  and array_length(storage.foldername(name), 1) >= 3
  and (storage.foldername(name))[2] = 'documents'
  and (
    public.can_manage_agency(public.storage_agency_id(name))
    or public.is_platform_admin()
  )
);

drop policy if exists "tenant document storage update" on storage.objects;
create policy "tenant document storage update" on storage.objects
for update to authenticated
using (
  bucket_id = 'agency-documents'
  and public.storage_agency_id(name) is not null
  and (storage.foldername(name))[2] = 'documents'
  and (
    public.can_manage_agency(public.storage_agency_id(name))
    or public.is_platform_admin()
  )
)
with check (
  bucket_id = 'agency-documents'
  and public.storage_agency_id(name) is not null
  and (storage.foldername(name))[2] = 'documents'
  and (
    public.can_manage_agency(public.storage_agency_id(name))
    or public.is_platform_admin()
  )
);

drop policy if exists "tenant document storage delete" on storage.objects;
create policy "tenant document storage delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'agency-documents'
  and public.storage_agency_id(name) is not null
  and (storage.foldername(name))[2] = 'documents'
  and (
    public.can_manage_agency(public.storage_agency_id(name))
    or public.is_platform_admin()
  )
);

-- Convenção oficial para novos arquivos. Pastas no Supabase Storage são virtuais:
-- elas aparecem automaticamente no primeiro upload dentro de cada caminho.
comment on table public.agency_documents is
'Central de documentos por tenant. Arquivos: agency_id/documents/{generated|uploads}/...';
