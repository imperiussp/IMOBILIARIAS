-- Notifica o corretor responsável quando o comprador responde positivamente.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar em outro projeto.

alter table public.app_notifications
  add column if not exists source_response_id uuid references public.buyer_outreach_responses(id) on delete set null;

create unique index if not exists app_notifications_source_response_unique
  on public.app_notifications(source_response_id,user_id)
  where source_response_id is not null;

create or replace function public.notify_broker_about_buyer_response()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_broker_id uuid;
  v_lead_name text;
  v_property_code text;
  v_title text;
  v_body text;
begin
  if new.response_kind not in ('interested','request_details','request_visit') then
    return new;
  end if;

  select l.name,l.broker_id,b.user_id
    into v_lead_name,v_broker_id,v_user_id
  from public.leads l
  left join public.brokers b
    on b.id=l.broker_id
   and b.agency_id=l.agency_id
   and b.active=true
  where l.id=new.lead_id and l.agency_id=new.agency_id;

  if v_user_id is null then
    return new;
  end if;

  if new.property_id is not null then
    select p.code into v_property_code
    from public.properties p
    where p.id=new.property_id and p.agency_id=new.agency_id;
  end if;

  v_title := case new.response_kind
    when 'request_visit' then 'Cliente pediu uma visita'
    when 'request_details' then 'Cliente pediu mais detalhes'
    else 'Cliente interessado em imóvel'
  end;

  v_body := concat(
    coalesce(v_lead_name,'Um cliente'),
    case new.response_kind
      when 'request_visit' then ' quer agendar uma visita'
      when 'request_details' then ' quer receber mais informações'
      else ' demonstrou interesse'
    end,
    case when v_property_code is not null then concat(' no imóvel ',v_property_code) else '' end,
    '. Abra o CRM para responder.'
  );

  insert into public.app_notifications(
    agency_id,user_id,broker_id,lead_id,kind,title,body,source,source_response_id
  ) values (
    new.agency_id,v_user_id,v_broker_id,new.lead_id,'message',v_title,v_body,'system',new.id
  ) on conflict (source_response_id,user_id) where source_response_id is not null do nothing;

  return new;
end;
$$;
revoke all on function public.notify_broker_about_buyer_response() from public,anon,authenticated;

drop trigger if exists buyer_outreach_response_notify_broker on public.buyer_outreach_responses;
create trigger buyer_outreach_response_notify_broker
after insert on public.buyer_outreach_responses
for each row execute function public.notify_broker_about_buyer_response();
