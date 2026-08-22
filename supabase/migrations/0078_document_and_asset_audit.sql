-- Auditoria das novas áreas de documentos e arquivos.
-- EXCLUSIVO do Supabase IMOBILIARIAS.
-- O conteúdo integral dos documentos NÃO deve ser copiado para o audit_log.

create or replace function public.log_agency_document_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  old_safe jsonb;
  new_safe jsonb;
begin
  if tg_op in ('UPDATE','DELETE') then
    old_safe := to_jsonb(old) - 'content';
  end if;
  if tg_op in ('INSERT','UPDATE') then
    new_safe := to_jsonb(new) - 'content';
  end if;

  if tg_op='INSERT' then
    insert into public.audit_log(agency_id,user_id,entity_type,entity_id,action,new_data)
    values(new.agency_id,auth.uid(),'agency_document',new.id,'insert',new_safe);
    return new;
  elsif tg_op='UPDATE' then
    insert into public.audit_log(agency_id,user_id,entity_type,entity_id,action,old_data,new_data)
    values(new.agency_id,auth.uid(),'agency_document',new.id,'update',old_safe,new_safe);
    return new;
  elsif tg_op='DELETE' then
    insert into public.audit_log(agency_id,user_id,entity_type,entity_id,action,old_data)
    values(old.agency_id,auth.uid(),'agency_document',old.id,'delete',old_safe);
    return old;
  end if;
  return null;
end;
$$;
revoke all on function public.log_agency_document_changes() from public,anon,authenticated;

drop trigger if exists agency_documents_audit on public.agency_documents;
create trigger agency_documents_audit
after insert or update or delete on public.agency_documents
for each row execute function public.log_agency_document_changes();

create or replace function public.log_agency_asset_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    insert into public.audit_log(agency_id,user_id,entity_type,entity_id,action,new_data)
    values(new.agency_id,auth.uid(),'agency_asset',new.id,'insert',to_jsonb(new));
    return new;
  elsif tg_op='UPDATE' then
    insert into public.audit_log(agency_id,user_id,entity_type,entity_id,action,old_data,new_data)
    values(new.agency_id,auth.uid(),'agency_asset',new.id,'update',to_jsonb(old),to_jsonb(new));
    return new;
  elsif tg_op='DELETE' then
    insert into public.audit_log(agency_id,user_id,entity_type,entity_id,action,old_data)
    values(old.agency_id,auth.uid(),'agency_asset',old.id,'delete',to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;
revoke all on function public.log_agency_asset_changes() from public,anon,authenticated;

drop trigger if exists agency_assets_audit on public.agency_assets;
create trigger agency_assets_audit
after insert or update or delete on public.agency_assets
for each row execute function public.log_agency_asset_changes();
