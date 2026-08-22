-- Agenda de visitas por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.property_visit_appointments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_visit_appointments_agency_schedule_idx
on public.property_visit_appointments(agency_id,scheduled_at);
create index if not exists property_visit_appointments_broker_schedule_idx
on public.property_visit_appointments(agency_id,broker_id,scheduled_at);
create index if not exists property_visit_appointments_lead_idx
on public.property_visit_appointments(agency_id,lead_id,scheduled_at desc);

alter table public.property_visit_appointments enable row level security;

-- A agenda segue a mesma autorização do CRM: corretor só acessa visita ligada
-- a contato atribuído a ele; gestores/equipe interna mantêm acesso da imobiliária.
drop policy if exists "tenant members read property visits" on public.property_visit_appointments;
create policy "tenant members read property visits" on public.property_visit_appointments
for select to authenticated
using (public.can_access_lead_crm(agency_id,lead_id));

drop policy if exists "tenant members manage property visits" on public.property_visit_appointments;
create policy "tenant members manage property visits" on public.property_visit_appointments
for all to authenticated
using (public.can_access_lead_crm(agency_id,lead_id))
with check (public.can_access_lead_crm(agency_id,lead_id));

create or replace function public.validate_property_visit_tenant()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if not exists(select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id) then
    raise exception 'Contato fora da imobiliária atual.';
  end if;
  if not public.can_access_lead_crm(new.agency_id,new.lead_id) then
    raise exception 'Sem permissão para agendar visita para este contato.';
  end if;
  if new.property_id is not null and not exists(select 1 from public.properties p where p.id=new.property_id and p.agency_id=new.agency_id) then
    raise exception 'Imóvel fora da imobiliária atual.';
  end if;
  if new.broker_id is not null and not exists(select 1 from public.brokers b where b.id=new.broker_id and b.agency_id=new.agency_id) then
    raise exception 'Corretor fora da imobiliária atual.';
  end if;
  -- Um corretor comum não pode agendar a visita em nome de outro corretor.
  if exists(
    select 1 from public.agency_memberships am
    where am.agency_id=new.agency_id and am.user_id=auth.uid() and am.active=true and am.role='broker'
  ) and new.broker_id is distinct from (
    select b.id from public.brokers b
    where b.agency_id=new.agency_id and b.user_id=auth.uid() and b.active=true
    limit 1
  ) then
    raise exception 'Corretor não pode atribuir visita a outro corretor.';
  end if;
  new.updated_at := now();
  new.created_by := coalesce(new.created_by,auth.uid());
  return new;
end;
$$;
revoke all on function public.validate_property_visit_tenant() from public,anon,authenticated;

drop trigger if exists property_visit_appointments_validate on public.property_visit_appointments;
create trigger property_visit_appointments_validate
before insert or update on public.property_visit_appointments
for each row execute function public.validate_property_visit_tenant();

drop view if exists public.agency_visit_schedule_summary;
create view public.agency_visit_schedule_summary
with (security_invoker = true)
as
select
  agency_id,
  count(*) filter (where status='scheduled' and scheduled_at >= now())::bigint as upcoming,
  count(*) filter (where status='scheduled' and scheduled_at >= now() and scheduled_at < now()+interval '24 hours')::bigint as next_24h,
  count(*) filter (where status='completed' and scheduled_at >= date_trunc('month',now()))::bigint as completed_this_month,
  count(*) filter (where status='no_show' and scheduled_at >= date_trunc('month',now()))::bigint as no_show_this_month
from public.property_visit_appointments
group by agency_id;

revoke all on public.agency_visit_schedule_summary from public,anon;
grant select on public.agency_visit_schedule_summary to authenticated;
