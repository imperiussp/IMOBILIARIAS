-- CRM de acompanhamentos por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  notes text,
  due_at timestamptz not null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_followups_agency_due_idx on public.lead_followups(agency_id,due_at) where completed_at is null;
create index if not exists lead_followups_lead_idx on public.lead_followups(agency_id,lead_id,created_at desc);

alter table public.lead_followups enable row level security;

drop policy if exists "tenant members read lead followups" on public.lead_followups;
create policy "tenant members read lead followups" on public.lead_followups
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());

drop policy if exists "tenant members manage lead followups" on public.lead_followups;
create policy "tenant members manage lead followups" on public.lead_followups
for all to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin())
with check (public.is_agency_member(agency_id) or public.is_platform_admin());

create or replace function public.validate_lead_followup_tenant()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if not exists(select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id) then
    raise exception 'Contato fora da imobiliária atual.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.validate_lead_followup_tenant() from public,anon,authenticated;

drop trigger if exists lead_followups_validate_tenant on public.lead_followups;
create trigger lead_followups_validate_tenant
before insert or update on public.lead_followups
for each row execute function public.validate_lead_followup_tenant();

-- security_invoker faz a view respeitar o RLS de lead_followups.
drop view if exists public.agency_followup_summary;
create view public.agency_followup_summary
with (security_invoker = true)
as
select
  agency_id,
  count(*) filter (where completed_at is null)::bigint as pending,
  count(*) filter (where completed_at is null and due_at < now())::bigint as overdue,
  count(*) filter (where completed_at is null and due_at >= now() and due_at < now()+interval '24 hours')::bigint as due_next_24h,
  count(*) filter (where completed_at is not null and completed_at >= date_trunc('month',now()))::bigint as completed_this_month
from public.lead_followups
group by agency_id;

revoke all on public.agency_followup_summary from public,anon;
grant select on public.agency_followup_summary to authenticated;
