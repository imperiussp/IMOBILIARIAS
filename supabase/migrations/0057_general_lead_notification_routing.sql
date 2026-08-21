-- Contatos sem corretor específico também precisam chegar ao aplicativo.
-- Se houver corretor responsável, notifica somente ele; caso contrário, notifica os corretores ativos da imobiliária.

create or replace function public.notify_broker_about_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  property_code text;
  notification_body text;
begin
  if new.property_id is not null then
    select p.code into property_code
    from public.properties p
    where p.id = new.property_id and p.agency_id = new.agency_id;
  end if;

  notification_body := case
    when property_code is not null then coalesce(new.name, 'Um cliente') || ' pediu informações sobre o imóvel ' || property_code || '.'
    when coalesce(new.source, '') = 'email' then coalesce(new.name, 'Um cliente') || ' enviou um contato por e-mail.'
    else coalesce(new.name, 'Um cliente') || ' enviou um novo contato pelo portal.'
  end;

  if new.broker_id is not null then
    for target in
      select b.id as broker_id, b.user_id
      from public.brokers b
      join public.agency_memberships am
        on am.agency_id = b.agency_id
       and am.user_id = b.user_id
       and am.active = true
      where b.id = new.broker_id
        and b.agency_id = new.agency_id
        and b.active = true
        and b.user_id is not null
    loop
      insert into public.app_notifications (agency_id,user_id,broker_id,lead_id,kind,title,body,source)
      values (
        new.agency_id,target.user_id,target.broker_id,new.id,'lead','Novo contato de cliente',notification_body,
        case when coalesce(new.source,'') = 'email' then 'email' else 'portal' end
      );
    end loop;
    return new;
  end if;

  -- Contato geral: todos os corretores ativos recebem aviso; o lead continua sem responsável até alguém assumir.
  for target in
    select b.id as broker_id, b.user_id
    from public.brokers b
    join public.agency_memberships am
      on am.agency_id = b.agency_id
     and am.user_id = b.user_id
     and am.active = true
    where b.agency_id = new.agency_id
      and b.active = true
      and b.user_id is not null
  loop
    insert into public.app_notifications (agency_id,user_id,broker_id,lead_id,kind,title,body,source)
    values (
      new.agency_id,target.user_id,target.broker_id,new.id,'lead','Novo contato da imobiliária',notification_body,
      case when coalesce(new.source,'') = 'email' then 'email' else 'portal' end
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_broker_about_new_lead() from public;
revoke all on function public.notify_broker_about_new_lead() from anon, authenticated;
