-- Transforma respostas positivas das oportunidades em tarefas reais do CRM.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar em outro projeto.

alter table public.lead_followups
  add column if not exists source_response_id uuid references public.buyer_outreach_responses(id) on delete set null;

create unique index if not exists lead_followups_source_response_unique
  on public.lead_followups(source_response_id)
  where source_response_id is not null;

-- Mantém a validação normal para usuários e permite apenas ao service_role,
-- usado pelas Edge Functions internas, criar tarefas automáticas.
create or replace function public.validate_lead_followup_tenant()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if not exists(select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id) then
    raise exception 'Contato fora da imobiliária atual.';
  end if;

  if coalesce(auth.role(),'') <> 'service_role'
     and not public.can_access_lead_crm(new.agency_id,new.lead_id) then
    raise exception 'Sem permissão para este contato.';
  end if;

  new.updated_at := now();
  new.created_by := coalesce(new.created_by,auth.uid());
  return new;
end;
$$;
revoke all on function public.validate_lead_followup_tenant() from public,anon,authenticated;

create or replace function public.create_followup_from_buyer_response()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_assigned_user uuid;
  v_title text;
  v_notes text;
  v_due timestamptz;
begin
  if new.response_kind not in ('interested','request_details','request_visit') then
    return new;
  end if;

  select b.user_id
    into v_assigned_user
  from public.leads l
  left join public.brokers b
    on b.id=l.broker_id
   and b.agency_id=l.agency_id
   and b.active=true
  where l.id=new.lead_id and l.agency_id=new.agency_id;

  v_title := case new.response_kind
    when 'request_visit' then 'Agendar visita solicitada pelo comprador'
    when 'request_details' then 'Enviar detalhes solicitados pelo comprador'
    else 'Retornar interesse em oportunidade de imóvel'
  end;

  v_due := case new.response_kind
    when 'request_visit' then now()+interval '30 minutes'
    else now()+interval '1 hour'
  end;

  v_notes := concat(
    'Gerado automaticamente a partir da resposta recebida por ',
    upper(new.channel),
    case when new.property_id is not null then concat('. Imóvel: ',new.property_id::text) else '' end,
    case when nullif(trim(coalesce(new.response_text,'')),'') is not null
      then concat('. Resposta: ',left(trim(new.response_text),500)) else '' end
  );

  insert into public.lead_followups(
    agency_id,lead_id,assigned_user_id,title,notes,due_at,source_response_id
  ) values (
    new.agency_id,new.lead_id,v_assigned_user,v_title,v_notes,v_due,new.id
  ) on conflict (source_response_id) where source_response_id is not null do nothing;

  return new;
end;
$$;
revoke all on function public.create_followup_from_buyer_response() from public,anon,authenticated;

drop trigger if exists buyer_outreach_positive_response_followup on public.buyer_outreach_responses;
create trigger buyer_outreach_positive_response_followup
after insert on public.buyer_outreach_responses
for each row execute function public.create_followup_from_buyer_response();
