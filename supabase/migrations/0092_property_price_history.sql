-- Histórico de preço dos imóveis por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.property_price_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  previous_price numeric(14,2) not null,
  price numeric(14,2) not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists property_price_history_property_idx on public.property_price_history(agency_id,property_id,changed_at desc);
alter table public.property_price_history enable row level security;

drop policy if exists "tenant members read property price history" on public.property_price_history;
create policy "tenant members read property price history" on public.property_price_history
for select to authenticated using (public.is_agency_member(agency_id) or public.is_platform_admin());
revoke insert,update,delete on public.property_price_history from anon,authenticated;

create or replace function public.capture_property_price_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.price is distinct from new.price then
    insert into public.property_price_history(agency_id,property_id,previous_price,price,changed_by)
    values(new.agency_id,new.id,old.price,new.price,auth.uid());
  end if;
  return new;
end; $$;
revoke all on function public.capture_property_price_change() from public,anon,authenticated;

drop trigger if exists properties_capture_price_change on public.properties;
create trigger properties_capture_price_change after update of price on public.properties
for each row execute function public.capture_property_price_change();

create or replace view public.agency_recent_price_changes as
select h.agency_id,h.property_id,p.code,p.title,h.previous_price,h.price,h.changed_at,
  round(case when h.previous_price>0 then 100.0*(h.price-h.previous_price)/h.previous_price else 0 end,2) as change_percent
from public.property_price_history h
join public.properties p on p.id=h.property_id and p.agency_id=h.agency_id;
revoke all on public.agency_recent_price_changes from public,anon;
grant select on public.agency_recent_price_changes to authenticated;
