-- Histórico imutável das transições técnicas de mensageria.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.buyer_outreach_delivery_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  attempt_id uuid not null references public.buyer_outreach_delivery_attempts(id) on delete cascade,
  opportunity_id uuid not null references public.buyer_property_opportunities(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  channel text not null,
  provider text,
  provider_message_id text,
  event_type text not null,
  previous_status text,
  current_status text not null,
  occurred_at timestamptz not null default now(),
  provider_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists buyer_outreach_delivery_events_attempt_idx
  on public.buyer_outreach_delivery_events(attempt_id,occurred_at desc);
create index if not exists buyer_outreach_delivery_events_agency_idx
  on public.buyer_outreach_delivery_events(agency_id,occurred_at desc);
create index if not exists buyer_outreach_delivery_events_lead_idx
  on public.buyer_outreach_delivery_events(agency_id,lead_id,occurred_at desc);
create index if not exists buyer_outreach_delivery_events_provider_message_idx
  on public.buyer_outreach_delivery_events(provider_message_id,occurred_at desc)
  where provider_message_id is not null;

alter table public.buyer_outreach_delivery_events enable row level security;

drop policy if exists "tenant crm reads outreach delivery events" on public.buyer_outreach_delivery_events;
create policy "tenant crm reads outreach delivery events"
on public.buyer_outreach_delivery_events
for select to authenticated
using (public.can_access_lead_crm(agency_id,lead_id));

revoke insert,update,delete on public.buyer_outreach_delivery_events from anon,authenticated;
grant select on public.buyer_outreach_delivery_events to authenticated;

create or replace function public.capture_buyer_outreach_delivery_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_event_type text;
  v_occurred_at timestamptz;
begin
  if tg_op='INSERT' then
    v_event_type:='attempt_created';
    v_occurred_at:=coalesce(new.attempted_at,now());
  elsif old.status is distinct from new.status then
    v_event_type:='status_' || new.status;
    v_occurred_at:=case new.status
      when 'sent' then coalesce(new.sent_at,now())
      when 'delivered' then coalesce(new.delivered_at,now())
      when 'read' then coalesce(new.read_at,new.delivered_at,now())
      else now()
    end;
  elsif old.provider_message_id is distinct from new.provider_message_id and new.provider_message_id is not null then
    v_event_type:='provider_message_linked';
    v_occurred_at:=now();
  else
    return new;
  end if;

  insert into public.buyer_outreach_delivery_events(
    agency_id,attempt_id,opportunity_id,lead_id,property_id,channel,provider,
    provider_message_id,event_type,previous_status,current_status,occurred_at,
    provider_payload,error_message
  ) values (
    new.agency_id,new.id,new.opportunity_id,new.lead_id,new.property_id,new.channel,new.provider,
    new.provider_message_id,v_event_type,case when tg_op='UPDATE' then old.status else null end,
    new.status,v_occurred_at,coalesce(new.provider_payload,'{}'::jsonb),new.error_message
  );
  return new;
end;
$$;

revoke all on function public.capture_buyer_outreach_delivery_event() from public,anon,authenticated;

drop trigger if exists buyer_outreach_delivery_attempt_event_history on public.buyer_outreach_delivery_attempts;
create trigger buyer_outreach_delivery_attempt_event_history
after insert or update on public.buyer_outreach_delivery_attempts
for each row execute function public.capture_buyer_outreach_delivery_event();

comment on table public.buyer_outreach_delivery_events is
'Histórico append-only das transições técnicas de cada tentativa de oportunidade; escrita apenas pelo backend/trigger.';
