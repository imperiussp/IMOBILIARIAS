-- Histórico do ciclo de vida dos imóveis por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.property_status_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  previous_status text,
  status text not null,
  previous_publication_state text,
  publication_state text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists property_status_history_agency_idx on public.property_status_history(agency_id, changed_at desc);
create index if not exists property_status_history_property_idx on public.property_status_history(property_id, changed_at desc);

alter table public.property_status_history enable row level security;

drop policy if exists "tenant members read property history" on public.property_status_history;
create policy "tenant members read property history" on public.property_status_history
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());

revoke insert, update, delete on public.property_status_history from anon, authenticated;

create or replace function public.capture_property_lifecycle_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='UPDATE' and (
    old.status is distinct from new.status or
    old.publication_state is distinct from new.publication_state
  ) then
    insert into public.property_status_history(
      agency_id, property_id, previous_status, status,
      previous_publication_state, publication_state, changed_by
    ) values (
      new.agency_id, new.id, old.status, new.status,
      old.publication_state, new.publication_state, auth.uid()
    );
  end if;
  return new;
end;
$$;
revoke all on function public.capture_property_lifecycle_change() from public, anon, authenticated;

drop trigger if exists properties_capture_lifecycle on public.properties;
create trigger properties_capture_lifecycle
after update of status, publication_state on public.properties
for each row execute function public.capture_property_lifecycle_change();

create or replace view public.agency_property_lifecycle_summary as
select
  p.agency_id,
  count(*) filter (where p.status='available')::bigint as available,
  count(*) filter (where p.status='reserved')::bigint as reserved,
  count(*) filter (where p.status='rented')::bigint as rented,
  count(*) filter (where p.status='sold')::bigint as sold,
  count(*) filter (where p.status='inactive')::bigint as inactive,
  count(*) filter (where p.publication_state='draft')::bigint as drafts,
  count(*) filter (where p.publication_state='published')::bigint as published
from public.properties p
group by p.agency_id;

revoke all on public.agency_property_lifecycle_summary from public, anon;
grant select on public.agency_property_lifecycle_summary to authenticated;
