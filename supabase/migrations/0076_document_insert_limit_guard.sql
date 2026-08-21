-- Garante o limite de documentos mesmo quando um cliente tenta inserir diretamente na tabela.
-- Fecha o bypass de duplicação/insert fora do RPC oficial.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.enforce_agency_document_plan_limit()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.is_platform_admin() then return new; end if;

  if not public.can_manage_agency(new.agency_id) then
    raise exception 'Acesso negado';
  end if;

  if not public.agency_can_create_document(new.agency_id) then
    raise exception 'Central de documentos indisponível ou limite do plano atingido.';
  end if;

  if new.property_id is not null and not exists(
    select 1 from public.properties p where p.id=new.property_id and p.agency_id=new.agency_id
  ) then raise exception 'Imóvel fora da imobiliária.'; end if;

  if new.lead_id is not null and not exists(
    select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id
  ) then raise exception 'Contato fora da imobiliária.'; end if;

  new.created_by := coalesce(new.created_by,auth.uid());
  return new;
end;
$$;

revoke all on function public.enforce_agency_document_plan_limit() from public,anon,authenticated;

drop trigger if exists agency_documents_plan_limit_guard on public.agency_documents;
create trigger agency_documents_plan_limit_guard
before insert on public.agency_documents
for each row execute function public.enforce_agency_document_plan_limit();
