alter table public.app_notifications
  add column if not exists event_key text;

create unique index if not exists app_notifications_user_event_unique
  on public.app_notifications(user_id,event_key)
  where event_key is not null;

create or replace function public.notify_followup_assignee()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_broker_id uuid;
  v_lead_name text;
  target record;
begin
  if tg_op <> 'INSERT' then return new; end if;

  select l.name,l.broker_id into v_lead_name,v_broker_id
  from public.leads l
  where l.id=new.lead_id and l.agency_id=new.agency_id;

  v_user_id := new.assigned_user_id;

  if v_user_id is null and v_broker_id is not null then
    select b.user_id into v_user_id
    from public.brokers b
    where b.id=v_broker_id and b.agency_id=new.agency_id and b.active=true;
  end if;

  if v_user_id is not null and exists(
    select 1 from public.agency_memberships am
    where am.agency_id=new.agency_id and am.user_id=v_user_id and am.active=true
  ) then
    if v_broker_id is null then
      select b.id into v_broker_id from public.brokers b
      where b.agency_id=new.agency_id and b.user_id=v_user_id and b.active=true
      limit 1;
    end if;

    insert into public.app_notifications(
      agency_id,user_id,broker_id,lead_id,kind,title,body,source,event_key
    ) values (
      new.agency_id,v_user_id,v_broker_id,new.lead_id,'system','Novo acompanhamento',
      concat(coalesce(v_lead_name,'Cliente'),' — ',new.title,'. Abra o app para ver o prazo e os detalhes.'),
      'system',concat('followup:',new.id,':created')
    ) on conflict (user_id,event_key) where event_key is not null do nothing;
    return new;
  end if;

  for target in
    select am.user_id
    from public.agency_memberships am
    where am.agency_id=new.agency_id and am.active=true and am.role::text='owner'
  loop
    insert into public.app_notifications(
      agency_id,user_id,lead_id,kind,title,body,source,event_key
    ) values (
      new.agency_id,target.user_id,new.lead_id,'system','Acompanhamento sem responsável',
      concat(coalesce(v_lead_name,'Cliente'),' — ',new.title,'. Abra o CRM para atribuir um responsável.'),
      'system',concat('followup:',new.id,':owner')
    ) on conflict (user_id,event_key) where event_key is not null do nothing;
  end loop;

  return new;
end;
$function$;

create or replace function public.notify_visit_participant()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_broker_id uuid;
  v_lead_name text;
  v_property_code text;
  v_title text;
  v_body text;
  v_event_key text;
  target record;
begin
  select l.name,coalesce(new.broker_id,l.broker_id)
    into v_lead_name,v_broker_id
  from public.leads l
  where l.id=new.lead_id and l.agency_id=new.agency_id;

  if new.property_id is not null then
    select p.code into v_property_code
    from public.properties p
    where p.id=new.property_id and p.agency_id=new.agency_id;
  end if;

  if tg_op='INSERT' then
    v_title := 'Visita agendada';
    v_event_key := concat('visit:',new.id,':created');
  elsif old.status is distinct from new.status then
    v_title := case new.status
      when 'completed' then 'Visita concluída'
      when 'cancelled' then 'Visita cancelada'
      when 'no_show' then 'Cliente não compareceu à visita'
      else 'Visita atualizada'
    end;
    v_event_key := concat('visit:',new.id,':status:',new.status);
  elsif old.scheduled_at is distinct from new.scheduled_at then
    v_title := 'Visita reagendada';
    v_event_key := concat('visit:',new.id,':schedule:',extract(epoch from new.scheduled_at)::bigint);
  else
    return new;
  end if;

  v_body := concat(
    coalesce(v_lead_name,'Cliente'),
    case when v_property_code is not null then concat(' — imóvel ',v_property_code) else '' end,
    '. Abra o app para ver horário e detalhes.'
  );

  if v_broker_id is not null then
    select b.user_id into v_user_id
    from public.brokers b
    where b.id=v_broker_id and b.agency_id=new.agency_id and b.active=true;
  end if;

  if v_user_id is not null then
    insert into public.app_notifications(
      agency_id,user_id,broker_id,lead_id,kind,title,body,source,event_key
    ) values (
      new.agency_id,v_user_id,v_broker_id,new.lead_id,'system',v_title,v_body,'system',v_event_key
    ) on conflict (user_id,event_key) where event_key is not null do nothing;
    return new;
  end if;

  for target in
    select am.user_id
    from public.agency_memberships am
    where am.agency_id=new.agency_id and am.active=true and am.role::text='owner'
  loop
    insert into public.app_notifications(
      agency_id,user_id,lead_id,kind,title,body,source,event_key
    ) values (
      new.agency_id,target.user_id,new.lead_id,'system',v_title,v_body,'system',v_event_key
    ) on conflict (user_id,event_key) where event_key is not null do nothing;
  end loop;

  return new;
end;
$function$;

create or replace function public.notify_broker_about_buyer_opportunity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_broker_id uuid;
  v_lead_name text;
  v_property_code text;
  target record;
begin
  if new.status not in ('queued','review') then return new; end if;

  select l.name,l.broker_id into v_lead_name,v_broker_id
  from public.leads l
  where l.id=new.lead_id and l.agency_id=new.agency_id;

  select p.code into v_property_code
  from public.properties p
  where p.id=new.property_id and p.agency_id=new.agency_id;

  if v_broker_id is not null then
    select b.user_id into v_user_id
    from public.brokers b
    where b.id=v_broker_id and b.agency_id=new.agency_id and b.active=true;
  end if;

  if v_user_id is not null then
    insert into public.app_notifications(
      agency_id,user_id,broker_id,lead_id,kind,title,body,source,event_key
    ) values (
      new.agency_id,v_user_id,v_broker_id,new.lead_id,'system','Nova oportunidade de imóvel',
      concat(coalesce(v_lead_name,'Cliente'),' tem ',new.match_score,'% de compatibilidade',
        case when v_property_code is not null then concat(' com o imóvel ',v_property_code) else ' com um imóvel' end,
        '. Abra o app para revisar.'),
      'system',concat('opportunity:',new.id,':created')
    ) on conflict (user_id,event_key) where event_key is not null do nothing;
    return new;
  end if;

  for target in
    select am.user_id
    from public.agency_memberships am
    where am.agency_id=new.agency_id and am.active=true and am.role::text='owner'
  loop
    insert into public.app_notifications(
      agency_id,user_id,lead_id,kind,title,body,source,event_key
    ) values (
      new.agency_id,target.user_id,new.lead_id,'system','Nova oportunidade sem corretor',
      concat(coalesce(v_lead_name,'Cliente'),' tem ',new.match_score,'% de compatibilidade',
        case when v_property_code is not null then concat(' com o imóvel ',v_property_code) else ' com um imóvel' end,
        '. Abra o CRM para atribuir um corretor.'),
      'system',concat('opportunity:',new.id,':owner')
    ) on conflict (user_id,event_key) where event_key is not null do nothing;
  end loop;

  return new;
end;
$function$;

create or replace function public.notify_owner_about_unassigned_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target record;
begin
  if new.broker_id is not null then return new; end if;

  for target in
    select am.user_id
    from public.agency_memberships am
    where am.agency_id=new.agency_id and am.active=true and am.role::text='owner'
  loop
    if not exists(
      select 1 from public.app_notifications n
      where n.agency_id=new.agency_id and n.user_id=target.user_id and n.lead_id=new.id
    ) then
      insert into public.app_notifications(
        agency_id,user_id,lead_id,kind,title,body,source,event_key
      ) values (
        new.agency_id,target.user_id,new.id,'system','Novo lead sem corretor',
        concat(coalesce(new.name,'Um cliente'),' entrou em contato e ainda não tem corretor responsável.'),
        'system',concat('lead:',new.id,':unassigned-owner')
      ) on conflict (user_id,event_key) where event_key is not null do nothing;
    end if;
  end loop;

  return new;
end;
$function$;

drop trigger if exists lead_followups_notify_assignee on public.lead_followups;
create trigger lead_followups_notify_assignee
after insert on public.lead_followups
for each row execute function public.notify_followup_assignee();

drop trigger if exists property_visits_notify_participant on public.property_visit_appointments;
create trigger property_visits_notify_participant
after insert or update of status,scheduled_at on public.property_visit_appointments
for each row execute function public.notify_visit_participant();

drop trigger if exists buyer_opportunities_notify_broker on public.buyer_property_opportunities;
create trigger buyer_opportunities_notify_broker
after insert on public.buyer_property_opportunities
for each row execute function public.notify_broker_about_buyer_opportunity();

drop trigger if exists leads_notify_owner_unassigned on public.leads;
create trigger leads_notify_owner_unassigned
after insert on public.leads
for each row execute function public.notify_owner_about_unassigned_lead();

revoke all on function public.notify_followup_assignee() from public, anon, authenticated;
revoke all on function public.notify_visit_participant() from public, anon, authenticated;
revoke all on function public.notify_broker_about_buyer_opportunity() from public, anon, authenticated;
revoke all on function public.notify_owner_about_unassigned_lead() from public, anon, authenticated;
