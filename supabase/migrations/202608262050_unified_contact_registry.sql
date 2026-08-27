-- CRM unificado: um contato por pessoa + histórico de interações.
create table if not exists public.agency_contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  phone text,
  phone_normalized text,
  email text,
  email_normalized text,
  contact_type text not null default 'buyer' check (contact_type in ('buyer','owner','mixed','other')),
  status text not null default 'new' check (status in ('new','active','negotiating','customer','inactive')),
  first_source text,
  last_source text,
  assigned_broker_id uuid references public.brokers(id) on delete set null,
  last_property_id uuid references public.properties(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists agency_contacts_email_unique on public.agency_contacts(agency_id,email_normalized) where email_normalized is not null;
create unique index if not exists agency_contacts_phone_unique on public.agency_contacts(agency_id,phone_normalized) where phone_normalized is not null;
create index if not exists agency_contacts_last_interaction_idx on public.agency_contacts(agency_id,last_interaction_at desc);

create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contact_id uuid not null references public.agency_contacts(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  interaction_type text not null,
  source text,
  title text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  external_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists contact_interactions_external_key_unique on public.contact_interactions(agency_id,external_key) where external_key is not null;
create index if not exists contact_interactions_contact_idx on public.contact_interactions(contact_id,occurred_at desc);

alter table public.leads add column if not exists contact_id uuid references public.agency_contacts(id) on delete set null;
create index if not exists leads_contact_id_idx on public.leads(contact_id);

create or replace function public.crm_normalize_phone(p_phone text) returns text language sql immutable set search_path=public as $$ select nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]+','','g'),'') $$;
create or replace function public.crm_normalize_email(p_email text) returns text language sql immutable set search_path=public as $$ select nullif(lower(trim(coalesce(p_email,''))),'') $$;

create or replace function public.can_access_agency_contact(p_agency_id uuid,p_assigned_broker_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin()
    or public.can_manage_agency(p_agency_id)
    or exists(select 1 from public.agency_memberships am where am.agency_id=p_agency_id and am.user_id=auth.uid() and am.active=true and am.role='staff')
    or exists(select 1 from public.brokers b where b.id=p_assigned_broker_id and b.agency_id=p_agency_id and b.user_id=auth.uid() and b.active=true)
$$;

create or replace function public.crm_sync_lead_contact(p_lead_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  l public.leads%rowtype; v_contact_id uuid; v_phone_norm text; v_email_norm text; v_safe_phone_norm text; v_safe_email_norm text;
  v_type text; v_existing_type text; v_interaction_type text; v_title text;
begin
  select * into l from public.leads where id=p_lead_id; if not found then return null; end if;
  v_phone_norm:=public.crm_normalize_phone(l.phone); v_email_norm:=public.crm_normalize_email(l.email);
  v_type:=case when l.source='web-owner-property' then 'owner' else 'buyer' end;
  if v_email_norm is not null then select id,contact_type into v_contact_id,v_existing_type from public.agency_contacts where agency_id=l.agency_id and email_normalized=v_email_norm order by last_interaction_at desc limit 1; end if;
  if v_contact_id is null and v_phone_norm is not null then select id,contact_type into v_contact_id,v_existing_type from public.agency_contacts where agency_id=l.agency_id and phone_normalized=v_phone_norm order by last_interaction_at desc limit 1; end if;
  if v_contact_id is null then
    begin
      insert into public.agency_contacts(agency_id,name,phone,phone_normalized,email,email_normalized,contact_type,status,first_source,last_source,assigned_broker_id,last_property_id,first_seen_at,last_interaction_at)
      values(l.agency_id,coalesce(nullif(trim(l.name),''),'Contato'),l.phone,v_phone_norm,l.email,v_email_norm,v_type,'new',l.source,l.source,l.broker_id,l.property_id,l.created_at,l.created_at)
      returning id into v_contact_id;
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
    contact_type=case when v_existing_type is null then v_type when v_existing_type=v_type then v_existing_type when v_existing_type='other' then v_type else 'mixed' end,
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

create or replace function public.trg_sync_lead_contact() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.crm_sync_lead_contact(new.id); return new; end $$;
drop trigger if exists trg_lead_contact_insert on public.leads;
create trigger trg_lead_contact_insert after insert on public.leads for each row execute function public.trg_sync_lead_contact();
drop trigger if exists trg_lead_contact_update on public.leads;
create trigger trg_lead_contact_update after update of name,phone,email,source,property_id,broker_id on public.leads for each row execute function public.trg_sync_lead_contact();

create or replace function public.trg_sync_visit_contact() returns trigger language plpgsql security definer set search_path=public as $$
declare v_contact_id uuid; v_title text;
begin
  select contact_id into v_contact_id from public.leads where id=new.lead_id;
  if v_contact_id is null then v_contact_id:=public.crm_sync_lead_contact(new.lead_id); end if;
  if v_contact_id is null then return new; end if;
  v_title:=case new.status when 'scheduled' then 'Visita agendada' when 'completed' then 'Visita realizada' when 'cancelled' then 'Visita cancelada' else 'Atualização de visita' end;
  insert into public.contact_interactions(agency_id,contact_id,lead_id,property_id,broker_id,interaction_type,source,title,message,metadata,external_key,occurred_at)
  values(new.agency_id,v_contact_id,new.lead_id,new.property_id,new.broker_id,'visit','visit',v_title,new.notes,jsonb_build_object('visit_id',new.id,'status',new.status,'scheduled_at',new.scheduled_at),'visit:'||new.id::text||':'||new.status,coalesce(new.scheduled_at,now()))
  on conflict (agency_id,external_key) where external_key is not null do nothing;
  update public.agency_contacts set last_property_id=coalesce(new.property_id,last_property_id),assigned_broker_id=coalesce(new.broker_id,assigned_broker_id),last_source='visit',last_interaction_at=greatest(last_interaction_at,coalesce(new.scheduled_at,now())),updated_at=now() where id=v_contact_id;
  return new;
end $$;
drop trigger if exists trg_visit_contact_insert on public.property_visit_appointments;
create trigger trg_visit_contact_insert after insert on public.property_visit_appointments for each row execute function public.trg_sync_visit_contact();
drop trigger if exists trg_visit_contact_update on public.property_visit_appointments;
create trigger trg_visit_contact_update after update of status,scheduled_at,notes,property_id,broker_id on public.property_visit_appointments for each row execute function public.trg_sync_visit_contact();

alter table public.agency_contacts enable row level security;
alter table public.contact_interactions enable row level security;
drop policy if exists "tenant members read contacts" on public.agency_contacts;
drop policy if exists "tenant members update contacts" on public.agency_contacts;
drop policy if exists "tenant CRM users read contacts" on public.agency_contacts;
create policy "tenant CRM users read contacts" on public.agency_contacts for select to authenticated using (public.can_access_agency_contact(agency_id,assigned_broker_id));
drop policy if exists "tenant CRM users update contacts" on public.agency_contacts;
create policy "tenant CRM users update contacts" on public.agency_contacts for update to authenticated using (public.can_access_agency_contact(agency_id,assigned_broker_id)) with check (public.can_access_agency_contact(agency_id,assigned_broker_id));
drop policy if exists "tenant managers delete contacts" on public.agency_contacts;
create policy "tenant managers delete contacts" on public.agency_contacts for delete to authenticated using (public.can_manage_agency(agency_id) or public.is_platform_admin());
drop policy if exists "tenant members read contact interactions" on public.contact_interactions;
drop policy if exists "tenant members add contact interactions" on public.contact_interactions;
drop policy if exists "tenant CRM users read contact interactions" on public.contact_interactions;
create policy "tenant CRM users read contact interactions" on public.contact_interactions for select to authenticated using (exists(select 1 from public.agency_contacts c where c.id=contact_interactions.contact_id and c.agency_id=contact_interactions.agency_id and public.can_access_agency_contact(c.agency_id,c.assigned_broker_id)));
drop policy if exists "tenant CRM users add contact interactions" on public.contact_interactions;
create policy "tenant CRM users add contact interactions" on public.contact_interactions for insert to authenticated with check (exists(select 1 from public.agency_contacts c where c.id=contact_interactions.contact_id and c.agency_id=contact_interactions.agency_id and public.can_access_agency_contact(c.agency_id,c.assigned_broker_id)));
grant select,update,delete on public.agency_contacts to authenticated;
grant select,insert on public.contact_interactions to authenticated;
revoke all on public.agency_contacts from anon;
revoke all on public.contact_interactions from anon;

DO $$ declare r record; begin for r in select id from public.leads order by created_at loop perform public.crm_sync_lead_contact(r.id); end loop; end $$;
