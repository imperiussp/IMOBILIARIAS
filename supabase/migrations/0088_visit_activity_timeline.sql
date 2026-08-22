-- Integra visitas ao histórico comercial dos contatos.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

alter table public.lead_activity_events
  drop constraint if exists lead_activity_events_event_type_check;

alter table public.lead_activity_events
  add constraint lead_activity_events_event_type_check
  check (event_type in (
    'created','status_changed','qualification_changed','note_added',
    'followup_created','followup_completed','visit_scheduled',
    'visit_completed','visit_cancelled','visit_no_show'
  ));

create or replace function public.log_property_visit_activity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  event_name text;
  event_title text;
begin
  if tg_op='INSERT' then
    event_name := 'visit_scheduled';
    event_title := 'Visita agendada';
  elsif old.status is distinct from new.status then
    event_name := case new.status
      when 'completed' then 'visit_completed'
      when 'cancelled' then 'visit_cancelled'
      when 'no_show' then 'visit_no_show'
      else 'visit_scheduled'
    end;
    event_title := case new.status
      when 'completed' then 'Visita concluída'
      when 'cancelled' then 'Visita cancelada'
      when 'no_show' then 'Cliente não compareceu à visita'
      else 'Visita reagendada'
    end;
  else
    return new;
  end if;

  insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
  values(
    new.agency_id,new.lead_id,event_name,event_title,
    jsonb_build_object(
      'visit_id',new.id,
      'property_id',new.property_id,
      'broker_id',new.broker_id,
      'scheduled_at',new.scheduled_at,
      'status',new.status
    ),
    auth.uid()
  );
  return new;
end;
$$;
revoke all on function public.log_property_visit_activity() from public,anon,authenticated;

drop trigger if exists property_visits_log_activity on public.property_visit_appointments;
create trigger property_visits_log_activity
after insert or update of status,scheduled_at on public.property_visit_appointments
for each row execute function public.log_property_visit_activity();
