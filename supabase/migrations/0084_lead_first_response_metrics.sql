-- Tempo de primeira resposta por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

alter table public.leads
  add column if not exists first_response_at timestamptz,
  add column if not exists first_response_by uuid references auth.users(id) on delete set null;

create index if not exists leads_agency_first_response_idx
on public.leads(agency_id, first_response_at, created_at desc);

update public.leads
set first_response_at = coalesce(updated_at, created_at)
where first_response_at is null and status <> 'new';

create or replace function public.capture_lead_first_response()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.first_response_at is null
     and old.status = 'new'
     and new.status <> 'new' then
    new.first_response_at := now();
    new.first_response_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.capture_lead_first_response() from public, anon, authenticated;

drop trigger if exists leads_capture_first_response on public.leads;
create trigger leads_capture_first_response
before update of status on public.leads
for each row execute function public.capture_lead_first_response();

drop view if exists public.agency_lead_response_metrics;
create view public.agency_lead_response_metrics
with (security_invoker = true)
as
select
  l.agency_id,
  count(*)::bigint as total_leads,
  count(*) filter (where l.first_response_at is not null)::bigint as responded,
  count(*) filter (where l.first_response_at is null and l.status='new')::bigint as waiting_response,
  count(*) filter (where l.first_response_at is null and l.status='new' and l.created_at < now()-interval '24 hours')::bigint as waiting_over_24h,
  round(avg(extract(epoch from (l.first_response_at-l.created_at))/60.0) filter (where l.first_response_at is not null),1) as avg_first_response_minutes,
  round(100.0 * count(*) filter (where l.first_response_at is not null and l.first_response_at <= l.created_at+interval '24 hours') / nullif(count(*),0),1) as responded_within_24h_percent
from public.leads l
group by l.agency_id;

revoke all on public.agency_lead_response_metrics from public, anon;
grant select on public.agency_lead_response_metrics to authenticated;
