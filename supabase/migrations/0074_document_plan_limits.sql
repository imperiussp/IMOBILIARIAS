-- Limites comerciais opcionais da Central de documentos.
-- Configurados dentro de subscription_plans.features para não alterar contratos de planos existentes.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.agency_document_usage_snapshot(p_agency_id uuid)
returns table(
  documents_enabled boolean,
  max_documents integer,
  used_documents bigint,
  max_uploads integer,
  used_uploads bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f jsonb;
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select sp.features into f
  from public.agency_subscriptions s
  join public.subscription_plans sp on sp.id=s.plan_id
  where s.agency_id=p_agency_id
    and s.status in ('trial','active','past_due')
    and (s.ends_at is null or s.ends_at>now())
    and sp.active=true
  order by s.starts_at desc limit 1;

  return query select
    lower(coalesce(f->>'documents','false')) in ('true','1','yes','on'),
    case when nullif(f->>'max_documents','') is null then null else greatest(0,(f->>'max_documents')::integer) end,
    (select count(*) from public.agency_documents d where d.agency_id=p_agency_id and d.status<>'archived'),
    case when nullif(f->>'max_document_uploads','') is null then null else greatest(0,(f->>'max_document_uploads')::integer) end,
    (select count(*) from public.agency_assets a where a.agency_id=p_agency_id and a.kind='agency_document');
end;
$$;
revoke all on function public.agency_document_usage_snapshot(uuid) from public;
grant execute on function public.agency_document_usage_snapshot(uuid) to authenticated;

create or replace function public.agency_can_create_document(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select s.documents_enabled and (s.max_documents is null or s.used_documents < s.max_documents)
    from public.agency_document_usage_snapshot(p_agency_id) s
  ),false)
$$;
revoke all on function public.agency_can_create_document(uuid) from public;
grant execute on function public.agency_can_create_document(uuid) to authenticated;

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
  if not public.is_platform_admin() and not public.agency_can_create_document(p_agency_id) then
    raise exception 'Central de documentos indisponível ou limite do plano atingido.';
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
