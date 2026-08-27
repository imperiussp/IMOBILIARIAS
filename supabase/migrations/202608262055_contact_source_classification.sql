-- Regra final do CRM unificado: contato geral começa neutro; interesse em imóvel = comprador; anuncie seu imóvel = proprietário.
create or replace function public.crm_contact_type_for_source(p_source text)
returns text language sql immutable set search_path=public as $$
  select case when p_source='web-owner-property' then 'owner' when p_source='web-property-detail' then 'buyer' else 'other' end
$$;

create or replace function public.crm_sync_lead_contact(p_lead_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  l public.leads%rowtype; v_contact_id uuid; v_phone_norm text; v_email_norm text; v_safe_phone_norm text; v_safe_email_norm text;
  v_type text; v_existing_type text; v_interaction_type text; v_title text;
begin
  select * into l from public.leads where id=p_lead_id; if not found then return null; end if;
  v_phone_norm:=public.crm_normalize_phone(l.phone); v_email_norm:=public.crm_normalize_email(l.email); v_type:=public.crm_contact_type_for_source(l.source);
  if v_email_norm is not null then select id,contact_type into v_contact_id,v_existing_type from public.agency_contacts where agency_id=l.agency_id and email_normalized=v_email_norm order by last_interaction_at desc limit 1; end if;
  if v_contact_id is null and v_phone_norm is not null then select id,contact_type into v_contact_id,v_existing_type from public.agency_contacts where agency_id=l.agency_id and phone_normalized=v_phone_norm order by last_interaction_at desc limit 1; end if;
  if v_contact_id is null then
    begin
      insert into public.agency_contacts(agency_id,name,phone,phone_normalized,email,email_normalized,contact_type,status,first_source,last_source,assigned_broker_id,last_property_id,first_seen_at,last_interaction_at)
      values(l.agency_id,coalesce(nullif(trim(l.name),''),'Contato'),l.phone,v_phone_norm,l.email,v_email_norm,v_type,'new',l.source,l.source,l.broker_id,l.property_id,l.created_at,l.created_at) returning id into v_contact_id;
    exception when unique_violation then
      select id,contact_type into v_contact_id,v_existing_type from public.agency_contacts where agency_id=l.agency_id and ((v_email_norm is not null and email_normalized=v_email_norm) or (v_phone_norm is not null and phone_normalized=v_phone_norm)) order by last_interaction_at desc limit 1;
    end;
  end if;
  if v_contact_id is null then return null; end if;
  select contact_type into v_existing_type from public.agency_contacts where id=v_contact_id;
  v_safe_phone_norm:=case when v_phone_norm is null or not exists(select 1 from public.agency_contacts c where c.agency_id=l.agency_id and c.phone_normalized=v_phone_norm and c.id<>v_contact_id) then v_phone_norm else null end;
  v_safe_email_norm:=case when v_email_norm is null or not exists(select 1 from public.agency_contacts c where c.agency_id=l.agency_id and c.email_normalized=v_email_norm and c.id<>v_contact_id) then v_email_norm else null end;
  update public.agency_contacts set
    name=coalesce(nullif(trim(l.name),''),name),
    phone=case when v_safe_phone_norm is not null then coalesce(nullif(trim(l.phone),''),phone) else phone end,
    phone_normalized=coalesce(v_safe_phone_norm,phone_normalized),
    email=case when v_safe_email_norm is not null then coalesce(nullif(trim(l.email),''),email) else email end,
    email_normalized=coalesce(v_safe_email_norm,email_normalized),
    contact_type=case when v_existing_type is null then v_type when v_type='other' then v_existing_type when v_existing_type=v_type then v_existing_type when v_existing_type='other' then v_type else 'mixed' end,
    first_source=coalesce(first_source,l.source),last_source=l.source,assigned_broker_id=coalesce(l.broker_id,assigned_broker_id),last_property_id=coalesce(l.property_id,last_property_id),last_interaction_at=greatest(last_interaction_at,coalesce(l.created_at,now())),updated_at=now()
  where id=v_contact_id;
  update public.leads set contact_id=v_contact_id where id=l.id and contact_id is distinct from v_contact_id;
  v_interaction_type:=case l.source when 'web-general-contact' then 'general_contact' when 'web-property-detail' then 'property_interest' when 'web-owner-property' then 'owner_property' when 'email' then 'email' when 'portal' then 'portal' else 'lead' end;
  v_title:=case l.source when 'web-general-contact' then 'Mensagem pelo site' when 'web-property-detail' then 'Interesse em imóvel' when 'web-owner-property' then 'Imóvel enviado para avaliação' when 'email' then 'Contato por e-mail' when 'portal' then 'Contato pelo portal' else 'Novo contato' end;
  insert into public.contact_interactions(agency_id,contact_id,lead_id,property_id,broker_id,interaction_type,source,title,message,external_key,occurred_at)
  values(l.agency_id,v_contact_id,l.id,l.property_id,l.broker_id,v_interaction_type,l.source,v_title,l.message,'lead:'||l.id::text,coalesce(l.created_at,now()))
  on conflict (agency_id,external_key) where external_key is not null do nothing;
  return v_contact_id;
end $$;
