-- Classificação comercial dos contatos por imobiliária.
-- Mantém o status operacional (novo, contatado, visita etc.) separado da qualidade/intenção do lead.

alter table public.leads
  add column if not exists qualification text not null default 'unclassified';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_qualification_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_qualification_check
      check (qualification in ('unclassified','potential_buyer','follow_up','price_only','no_current_interest','other'));
  end if;
end $$;

create index if not exists leads_agency_broker_qualification_idx
on public.leads (agency_id, broker_id, qualification, created_at desc);

create table if not exists public.lead_qualification_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  previous_qualification text,
  qualification text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  check (qualification in ('unclassified','potential_buyer','follow_up','price_only','no_current_interest','other')),
  check (previous_qualification is null or previous_qualification in ('unclassified','potential_buyer','follow_up','price_only','no_current_interest','other'))
);

create index if not exists lead_qualification_history_lead_idx
on public.lead_qualification_history (agency_id, lead_id, changed_at desc);

alter table public.lead_qualification_history enable row level security;

drop policy if exists "tenant members read lead qualification history" on public.lead_qualification_history;
create policy "tenant members read lead qualification history" on public.lead_qualification_history
for select to authenticated
using (
  public.is_platform_admin()
  or public.is_agency_member(agency_id)
);

-- O histórico é gerado exclusivamente pelo trigger, evitando registros manuais divergentes.
revoke insert, update, delete on public.lead_qualification_history from anon, authenticated;
grant select on public.lead_qualification_history to authenticated;

create or replace function public.record_lead_qualification_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_qualification_history (
      agency_id, lead_id, previous_qualification, qualification, changed_by
    ) values (
      new.agency_id, new.id, null, new.qualification, auth.uid()
    );
  elsif new.qualification is distinct from old.qualification then
    insert into public.lead_qualification_history (
      agency_id, lead_id, previous_qualification, qualification, changed_by
    ) values (
      new.agency_id, new.id, old.qualification, new.qualification, auth.uid()
    );
  end if;
  return new;
end;
$$;

revoke all on function public.record_lead_qualification_history() from public;

drop trigger if exists leads_record_qualification_history on public.leads;
create trigger leads_record_qualification_history
after insert or update of qualification on public.leads
for each row execute function public.record_lead_qualification_history();
