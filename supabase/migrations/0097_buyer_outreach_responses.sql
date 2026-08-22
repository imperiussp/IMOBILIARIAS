-- Respostas do comprador, eventos de entrega e ligação com o CRM.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.buyer_outreach_responses (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id uuid references public.buyer_property_opportunities(id) on delete set null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email','sms')),
  provider text,
  provider_event_id text,
  provider_message_id text,
  response_text text,
  response_kind text not null default 'reply' check (response_kind in ('reply','opt_out','interested','not_interested','request_details','request_visit','other')),
  received_at timestamptz not null default now(),
  provider_payload jsonb not null default '{}'::jsonb,
  unique(provider,provider_event_id)
);
create index if not exists buyer_outreach_responses_lead_idx on public.buyer_outreach_responses(agency_id,lead_id,received_at desc);
create index if not exists buyer_outreach_responses_opportunity_idx on public.buyer_outreach_responses(opportunity_id,received_at desc);
alter table public.buyer_outreach_responses enable row level security;

drop policy if exists "tenant members read buyer outreach responses" on public.buyer_outreach_responses;
create policy "tenant members read buyer outreach responses" on public.buyer_outreach_responses
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());
revoke insert,update,delete on public.buyer_outreach_responses from anon,authenticated;

create or replace function public.validate_buyer_outreach_response_tenant()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id) then
    raise exception 'Contato fora da imobiliária.';
  end if;
  if new.property_id is not null and not exists(select 1 from public.properties p where p.id=new.property_id and p.agency_id=new.agency_id) then
    raise exception 'Imóvel fora da imobiliária.';
  end if;
  if new.opportunity_id is not null and not exists(
    select 1 from public.buyer_property_opportunities o
    where o.id=new.opportunity_id and o.agency_id=new.agency_id and o.lead_id=new.lead_id
  ) then raise exception 'Oportunidade fora da imobiliária.'; end if;
  return new;
end; $$;
revoke all on function public.validate_buyer_outreach_response_tenant() from public,anon,authenticated;

drop trigger if exists buyer_outreach_responses_validate on public.buyer_outreach_responses;
create trigger buyer_outreach_responses_validate before insert or update on public.buyer_outreach_responses
for each row execute function public.validate_buyer_outreach_response_tenant();

create or replace function public.log_buyer_outreach_response_to_crm()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
  values(
    new.agency_id,
    new.lead_id,
    'note_added',
    case new.response_kind
      when 'opt_out' then 'Cliente pediu para não receber novos alertas'
      when 'interested' then 'Cliente demonstrou interesse em oportunidade'
      when 'not_interested' then 'Cliente não demonstrou interesse na oportunidade'
      when 'request_details' then 'Cliente pediu mais informações do imóvel'
      when 'request_visit' then 'Cliente pediu visita ao imóvel'
      else 'Cliente respondeu a uma oportunidade de imóvel'
    end,
    jsonb_build_object(
      'source','buyer_outreach',
      'opportunity_id',new.opportunity_id,
      'property_id',new.property_id,
      'channel',new.channel,
      'response_kind',new.response_kind,
      'response_text',left(coalesce(new.response_text,''),1200),
      'received_at',new.received_at
    ),
    null
  );

  if new.response_kind='opt_out' then
    update public.lead_contact_permissions
      set automated_property_alerts_allowed=false,
          revoked_at=coalesce(revoked_at,now()),
          updated_at=now()
    where agency_id=new.agency_id and lead_id=new.lead_id;
  end if;

  return new;
end; $$;
revoke all on function public.log_buyer_outreach_response_to_crm() from public,anon,authenticated;

drop trigger if exists buyer_outreach_responses_log_crm on public.buyer_outreach_responses;
create trigger buyer_outreach_responses_log_crm
after insert on public.buyer_outreach_responses
for each row execute function public.log_buyer_outreach_response_to_crm();

create or replace view public.agency_buyer_outreach_response_summary as
select agency_id,
  count(*)::bigint as responses,
  count(*) filter(where response_kind='interested')::bigint as interested,
  count(*) filter(where response_kind='request_details')::bigint as requested_details,
  count(*) filter(where response_kind='request_visit')::bigint as requested_visit,
  count(*) filter(where response_kind='not_interested')::bigint as not_interested,
  count(*) filter(where response_kind='opt_out')::bigint as opt_out,
  count(*) filter(where received_at>=date_trunc('month',now()))::bigint as responses_this_month
from public.buyer_outreach_responses
group by agency_id;
revoke all on public.agency_buyer_outreach_response_summary from public,anon;
grant select on public.agency_buyer_outreach_response_summary to authenticated;
