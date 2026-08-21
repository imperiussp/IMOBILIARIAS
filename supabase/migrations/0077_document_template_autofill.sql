-- Preenchimento automático seguro dos marcadores mais comuns dos modelos.
-- Apenas usa dados pertencentes à própria imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

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
  agency_name text;
  property_title text;
  property_code text;
  property_price numeric;
  lead_name text;
  lead_contact text;
  rendered text;
  result_id uuid;
begin
  if not public.can_manage_agency(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;
  if not public.is_platform_admin() and not public.agency_can_create_document(p_agency_id) then
    raise exception 'Central de documentos indisponível ou limite do plano atingido.';
  end if;

  select * into t from public.document_templates where id=p_template_id and active=true;
  if t.id is null then raise exception 'Modelo de documento não encontrado.'; end if;

  select a.name into agency_name from public.agencies a where a.id=p_agency_id;

  if p_property_id is not null then
    select p.title,p.code,p.price into property_title,property_code,property_price
    from public.properties p where p.id=p_property_id and p.agency_id=p_agency_id;
    if property_title is null then raise exception 'Imóvel fora da imobiliária atual.'; end if;
  end if;

  if p_lead_id is not null then
    select l.name,coalesce(nullif(l.phone,''),nullif(l.email,''),'') into lead_name,lead_contact
    from public.leads l where l.id=p_lead_id and l.agency_id=p_agency_id;
    if lead_name is null then raise exception 'Contato fora da imobiliária atual.'; end if;
  end if;

  rendered := t.body_template;
  rendered := replace(rendered,'{{IMOBILIARIA}}',coalesce(agency_name,''));
  rendered := replace(rendered,'{{DATA}}',to_char(current_date,'DD/MM/YYYY'));
  rendered := replace(rendered,'{{IMOVEL}}',coalesce(property_title,''));
  rendered := replace(rendered,'{{CODIGO_IMOVEL}}',coalesce(property_code,''));
  rendered := replace(rendered,'{{VALOR}}',case when property_price is null then '' else 'R$ ' || trim(to_char(property_price,'FM999G999G999G990D00')) end);
  rendered := replace(rendered,'{{CLIENTE}}',coalesce(lead_name,''));
  rendered := replace(rendered,'{{CONTATO}}',coalesce(lead_contact,''));

  insert into public.agency_documents(agency_id,template_id,property_id,lead_id,title,category,content,created_by)
  values(p_agency_id,t.id,p_property_id,p_lead_id,coalesce(nullif(trim(p_title),''),t.name),t.category,rendered,auth.uid())
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.create_agency_document_from_template(uuid,uuid,text,uuid,uuid) from public;
grant execute on function public.create_agency_document_from_template(uuid,uuid,text,uuid,uuid) to authenticated;
