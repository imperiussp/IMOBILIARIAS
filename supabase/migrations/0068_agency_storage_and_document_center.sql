-- Organização de arquivos por imobiliária + central de documentos por plano.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar em Moto Connect ou outros projetos.

-- Convenção de pastas virtuais no Storage:
-- <agency_id>/branding/...
-- <agency_id>/properties/<property_id>/photos/...
-- <agency_id>/properties/<property_id>/documents/...
-- <agency_id>/documents/generated/...
-- <agency_id>/documents/uploads/...
-- <agency_id>/brokers/<broker_id>/...

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  description text,
  body_template text not null,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  template_id uuid references public.document_templates(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  category text not null,
  content text,
  storage_path text,
  status text not null default 'draft' check (status in ('draft','final','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_documents_agency_created_idx
on public.agency_documents (agency_id, created_at desc);
create index if not exists agency_documents_property_idx
on public.agency_documents (agency_id, property_id) where property_id is not null;

alter table public.document_templates enable row level security;
alter table public.agency_documents enable row level security;

drop policy if exists "members read active document templates" on public.document_templates;
create policy "members read active document templates" on public.document_templates
for select to authenticated using (active = true or public.is_platform_admin());

drop policy if exists "platform admins manage document templates" on public.document_templates;
create policy "platform admins manage document templates" on public.document_templates
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "tenant members read documents" on public.agency_documents;
create policy "tenant members read documents" on public.agency_documents
for select to authenticated using (public.is_agency_member(agency_id) or public.is_platform_admin());

drop policy if exists "tenant managers manage documents" on public.agency_documents;
create policy "tenant managers manage documents" on public.agency_documents
for all to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin())
with check (public.can_manage_agency(agency_id) or public.is_platform_admin());

-- Função de entitlement específica do módulo de documentos.
create or replace function public.agency_can_use_documents(p_agency_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  enabled boolean;
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select lower(coalesce(sp.features ->> 'documents','false')) in ('true','1','yes','on')
    into enabled
  from public.agency_subscriptions s
  join public.subscription_plans sp on sp.id = s.plan_id
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
    and (s.ends_at is null or s.ends_at > now())
    and sp.active = true
  order by s.starts_at desc
  limit 1;

  return coalesce(enabled, false);
end;
$$;
revoke all on function public.agency_can_use_documents(uuid) from public;
grant execute on function public.agency_can_use_documents(uuid) to authenticated;

-- Criação segura de documento a partir de um modelo padrão.
create or replace function public.create_agency_document_from_template(
  p_agency_id uuid,
  p_template_id uuid,
  p_title text default null,
  p_property_id uuid default null,
  p_lead_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.document_templates%rowtype;
  result_id uuid;
begin
  if not public.can_manage_agency(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;
  if not public.agency_can_use_documents(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Central de documentos não incluída no plano atual.';
  end if;

  select * into t from public.document_templates where id=p_template_id and active=true;
  if t.id is null then raise exception 'Modelo de documento não encontrado.'; end if;

  if p_property_id is not null and not exists(select 1 from public.properties p where p.id=p_property_id and p.agency_id=p_agency_id) then
    raise exception 'Imóvel fora da imobiliária atual.';
  end if;
  if p_lead_id is not null and not exists(select 1 from public.leads l where l.id=p_lead_id and l.agency_id=p_agency_id) then
    raise exception 'Contato fora da imobiliária atual.';
  end if;

  insert into public.agency_documents(agency_id,template_id,property_id,lead_id,title,category,content,created_by)
  values(p_agency_id,t.id,p_property_id,p_lead_id,coalesce(nullif(trim(p_title),''),t.name),t.category,t.body_template,auth.uid())
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.create_agency_document_from_template(uuid,uuid,text,uuid,uuid) from public;
grant execute on function public.create_agency_document_from_template(uuid,uuid,text,uuid,uuid) to authenticated;

-- Bucket privado de documentos. Pastas são virtuais no Supabase Storage e surgem conforme os uploads.
insert into storage.buckets (id,name,public)
values ('agency-documents','agency-documents',false)
on conflict (id) do update set public=false;

drop policy if exists "tenant document storage read" on storage.objects;
create policy "tenant document storage read" on storage.objects
for select to authenticated
using (
  bucket_id='agency-documents'
  and (public.is_agency_member((storage.foldername(name))[1]::uuid) or public.is_platform_admin())
);

drop policy if exists "tenant document storage write" on storage.objects;
create policy "tenant document storage write" on storage.objects
for insert to authenticated
with check (
  bucket_id='agency-documents'
  and array_length(storage.foldername(name),1) >= 3
  and (storage.foldername(name))[2] = 'documents'
  and (public.can_manage_agency((storage.foldername(name))[1]::uuid) or public.is_platform_admin())
);

drop policy if exists "tenant document storage update" on storage.objects;
create policy "tenant document storage update" on storage.objects
for update to authenticated
using (bucket_id='agency-documents' and (public.can_manage_agency((storage.foldername(name))[1]::uuid) or public.is_platform_admin()))
with check (bucket_id='agency-documents' and (public.can_manage_agency((storage.foldername(name))[1]::uuid) or public.is_platform_admin()));

drop policy if exists "tenant document storage delete" on storage.objects;
create policy "tenant document storage delete" on storage.objects
for delete to authenticated
using (bucket_id='agency-documents' and (public.can_manage_agency((storage.foldername(name))[1]::uuid) or public.is_platform_admin()));

-- Modelos iniciais editáveis. São base operacional; a imobiliária deve revisar adequação jurídica antes do uso.
insert into public.document_templates(code,name,category,description,body_template,display_order)
values
('ficha-captacao','Ficha de captação de imóvel','captação','Coleta padronizada dos dados do proprietário e do imóvel.', 'FICHA DE CAPTAÇÃO DE IMÓVEL\n\nImobiliária: {{IMOBILIARIA}}\nData: {{DATA}}\nProprietário: {{PROPRIETARIO}}\nContato: {{CONTATO}}\nImóvel: {{IMOVEL}}\nEndereço: {{ENDERECO}}\nFinalidade: {{FINALIDADE}}\nValor pretendido: {{VALOR}}\nCondições e observações: {{OBSERVACOES}}\n\nResponsável pela captação: {{CORRETOR}}',10),
('autorizacao-intermediacao','Autorização de intermediação','captação','Modelo base de autorização para intermediação imobiliária.', 'AUTORIZAÇÃO DE INTERMEDIAÇÃO IMOBILIÁRIA\n\nEu, {{PROPRIETARIO}}, autorizo {{IMOBILIARIA}} a promover a intermediação do imóvel {{IMOVEL}}, nas condições registradas neste documento.\n\nPrazo: {{PRAZO}}\nValor anunciado: {{VALOR}}\nCondições: {{CONDICOES}}\n\nLocal e data: {{LOCAL_DATA}}\n\nAssinatura do proprietário: ____________________\nAssinatura da imobiliária/corretor: ____________________',20),
('termo-visita','Termo de visita ao imóvel','atendimento','Registro de visita de interessado a imóvel.', 'TERMO DE VISITA AO IMÓVEL\n\nInteressado: {{CLIENTE}}\nDocumento/contato: {{DOCUMENTO_CONTATO}}\nImóvel: {{IMOVEL}}\nCódigo: {{CODIGO_IMOVEL}}\nData e hora da visita: {{DATA_HORA}}\nCorretor responsável: {{CORRETOR}}\n\nObservações: {{OBSERVACOES}}\n\nAssinatura do visitante: ____________________',30),
('proposta-compra','Proposta de compra','proposta','Modelo base para registrar proposta de aquisição.', 'PROPOSTA DE COMPRA\n\nProponente: {{CLIENTE}}\nImóvel: {{IMOVEL}}\nCódigo: {{CODIGO_IMOVEL}}\nValor proposto: {{VALOR_PROPOSTA}}\nForma de pagamento: {{FORMA_PAGAMENTO}}\nPrazo/condições: {{CONDICOES}}\nValidade da proposta: {{VALIDADE}}\n\nAssinatura do proponente: ____________________',40),
('proposta-locacao','Proposta de locação','proposta','Modelo base para registrar proposta de locação.', 'PROPOSTA DE LOCAÇÃO\n\nProponente: {{CLIENTE}}\nImóvel: {{IMOVEL}}\nCódigo: {{CODIGO_IMOVEL}}\nValor mensal proposto: {{VALOR}}\nGarantia sugerida: {{GARANTIA}}\nData pretendida para início: {{DATA_INICIO}}\nCondições: {{CONDICOES}}\n\nAssinatura do proponente: ____________________',50),
('checklist-imovel','Checklist documental do imóvel','documentação','Checklist operacional para conferência de documentos.', 'CHECKLIST DOCUMENTAL DO IMÓVEL\n\n[ ] Documento de identificação do proprietário\n[ ] Comprovante de titularidade/matrícula\n[ ] Dados do imóvel atualizados\n[ ] IPTU/tributos quando aplicável\n[ ] Condomínio quando aplicável\n[ ] Autorizações necessárias\n[ ] Fotos e informações comerciais\n[ ] Observações/restrições registradas\n\nResponsável: {{CORRETOR}}\nData: {{DATA}}',60),
('recibo-chaves','Recibo de entrega/recebimento de chaves','atendimento','Registro simples de movimentação de chaves.', 'RECIBO DE CHAVES\n\nDeclaro o recebimento de {{QUANTIDADE}} chave(s) referente(s) ao imóvel {{IMOVEL}}, código {{CODIGO_IMOVEL}}.\n\nFinalidade: {{FINALIDADE}}\nEntregue por: {{ENTREGUE_POR}}\nRecebido por: {{RECEBIDO_POR}}\nData/hora: {{DATA_HORA}}\nObservações: {{OBSERVACOES}}\n\nAssinatura: ____________________',70)
on conflict (code) do update set
  name=excluded.name, category=excluded.category, description=excluded.description,
  body_template=excluded.body_template, display_order=excluded.display_order, active=true, updated_at=now();
