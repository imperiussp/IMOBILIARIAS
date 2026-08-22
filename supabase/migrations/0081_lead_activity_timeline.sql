-- Linha do tempo comercial e notas internas por contato.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_activity_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null check (event_type in ('created','status_changed','qualification_changed','note_added','followup_created','followup_completed')),
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_notes_agency_lead_created_idx on public.lead_notes(agency_id,lead_id,created_at desc);
create index if not exists lead_activity_agency_lead_created_idx on public.lead_activity_events(agency_id,lead_id,created_at desc);

alter table public.lead_notes enable row level security;
alter table public.lead_activity_events enable row level security;

-- A mesma regra de acesso do CRM é aplicada às notas e à linha do tempo.
-- Owner/admin/staff podem trabalhar os contatos da imobiliária; corretor só recebe
-- dados dos contatos atribuídos ao seu próprio cadastro de corretor.
drop policy if exists "tenant members read lead notes" on public.lead_notes;
create policy "tenant members read lead notes" on public.lead_notes for select to authenticated
using (public.can_access_lead_crm(agency_id,lead_id));

drop policy if exists "tenant members add lead notes" on public.lead_notes;
create policy "tenant members add lead notes" on public.lead_notes for insert to authenticated
with check (public.can_access_lead_crm(agency_id,lead_id));

drop policy if exists "tenant members read lead activity" on public.lead_activity_events;
create policy "tenant members read lead activity" on public.lead_activity_events for select to authenticated
using (public.can_access_lead_crm(agency_id,lead_id));

create or replace function public.validate_lead_note_tenant()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id) then
    raise exception 'Contato fora da imobiliária atual.';
  end if;
  if not public.can_access_lead_crm(new.agency_id,new.lead_id) then
    raise exception 'Sem permissão para este contato.';
  end if;
  new.body := trim(new.body);
  new.created_by := coalesce(new.created_by,auth.uid());
  return new;
end;
$$;
revoke all on function public.validate_lead_note_tenant() from public,anon,authenticated;

drop trigger if exists lead_notes_validate_tenant on public.lead_notes;
create trigger lead_notes_validate_tenant before insert or update on public.lead_notes
for each row execute function public.validate_lead_note_tenant();

create or replace function public.log_lead_note_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- O texto completo permanece somente em lead_notes. A timeline guarda apenas a
  -- referência da nota, evitando duplicação desnecessária de conteúdo interno.
  insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
  values(new.agency_id,new.lead_id,'note_added','Nota interna adicionada',jsonb_build_object('note_id',new.id),coalesce(new.created_by,auth.uid()));
  return new;
end;
$$;
revoke all on function public.log_lead_note_activity() from public,anon,authenticated;

drop trigger if exists lead_notes_log_activity on public.lead_notes;
create trigger lead_notes_log_activity after insert on public.lead_notes
for each row execute function public.log_lead_note_activity();

create or replace function public.log_lead_commercial_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
    values(new.agency_id,new.id,'created','Contato recebido',jsonb_build_object('source',new.source,'status',new.status),auth.uid());
  else
    if old.status is distinct from new.status then
      insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
      values(new.agency_id,new.id,'status_changed','Etapa do atendimento alterada',jsonb_build_object('from',old.status,'to',new.status),auth.uid());
    end if;
    if old.qualification is distinct from new.qualification then
      insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
      values(new.agency_id,new.id,'qualification_changed','Classificação comercial alterada',jsonb_build_object('from',old.qualification,'to',new.qualification),auth.uid());
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.log_lead_commercial_activity() from public,anon,authenticated;

drop trigger if exists leads_log_commercial_activity on public.leads;
create trigger leads_log_commercial_activity after insert or update of status,qualification on public.leads
for each row execute function public.log_lead_commercial_activity();

create or replace function public.log_followup_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
    values(new.agency_id,new.lead_id,'followup_created','Acompanhamento agendado',jsonb_build_object('followup_id',new.id,'title',new.title,'due_at',new.due_at),coalesce(new.created_by,auth.uid()));
  elsif old.completed_at is null and new.completed_at is not null then
    insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
    values(new.agency_id,new.lead_id,'followup_completed','Acompanhamento concluído',jsonb_build_object('followup_id',new.id,'title',new.title),auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.log_followup_activity() from public,anon,authenticated;

drop trigger if exists lead_followups_log_activity on public.lead_followups;
create trigger lead_followups_log_activity after insert or update of completed_at on public.lead_followups
for each row execute function public.log_followup_activity();

revoke all on public.lead_notes from anon;
revoke all on public.lead_activity_events from public,anon,authenticated;
grant select on public.lead_activity_events to authenticated;
grant select,insert on public.lead_notes to authenticated;
