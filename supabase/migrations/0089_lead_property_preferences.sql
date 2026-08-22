-- Preferências de imóveis por contato e matching por imobiliária.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.lead_property_preferences (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  purpose public.property_purpose,
  zone public.property_zone,
  segment text check (segment is null or segment in ('residential','commercial')),
  city_id uuid references public.cities(id) on delete set null,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  property_type_id uuid references public.property_types(id) on delete set null,
  min_price numeric(14,2) check (min_price is null or min_price >= 0),
  max_price numeric(14,2) check (max_price is null or max_price >= 0),
  min_bedrooms integer check (min_bedrooms is null or min_bedrooms >= 0),
  min_parking integer check (min_parking is null or min_parking >= 0),
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, lead_id)
);

create index if not exists lead_property_preferences_agency_idx on public.lead_property_preferences(agency_id,active,updated_at desc);
alter table public.lead_property_preferences enable row level security;

drop policy if exists "tenant members manage lead preferences" on public.lead_property_preferences;
create policy "tenant members manage lead preferences" on public.lead_property_preferences
for all to authenticated
using (public.can_access_lead_crm(agency_id,lead_id))
with check (public.can_access_lead_crm(agency_id,lead_id));

create or replace function public.validate_lead_property_preference_tenant()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id) then raise exception 'Contato fora da imobiliária atual.'; end if;
  if not public.can_access_lead_crm(new.agency_id,new.lead_id) then raise exception 'Sem permissão para este contato.'; end if;
  if new.neighborhood_id is not null and not exists(select 1 from public.neighborhoods n where n.id=new.neighborhood_id and (n.agency_id is null or n.agency_id=new.agency_id)) then raise exception 'Bairro fora da imobiliária atual.'; end if;
  new.created_by := coalesce(new.created_by,auth.uid());
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.validate_lead_property_preference_tenant() from public,anon,authenticated;

drop trigger if exists lead_property_preferences_validate on public.lead_property_preferences;
create trigger lead_property_preferences_validate before insert or update on public.lead_property_preferences
for each row execute function public.validate_lead_property_preference_tenant();

drop view if exists public.lead_property_match_candidates;
create view public.lead_property_match_candidates
with (security_invoker = true)
as
select
  pref.agency_id,
  pref.lead_id,
  p.id as property_id,
  p.code,
  p.title,
  p.price,
  p.purpose,
  p.zone,
  p.segment,
  p.bedrooms,
  p.parking_spaces,
  p.published_at,
  (
    (case when pref.purpose is null or p.purpose=pref.purpose then 20 else 0 end)+
    (case when pref.zone is null or p.zone=pref.zone then 10 else 0 end)+
    (case when pref.segment is null or p.segment=pref.segment then 10 else 0 end)+
    (case when pref.city_id is null or p.city_id=pref.city_id then 15 else 0 end)+
    (case when pref.neighborhood_id is null or p.neighborhood_id=pref.neighborhood_id then 15 else 0 end)+
    (case when pref.property_type_id is null or p.property_type_id=pref.property_type_id then 10 else 0 end)+
    (case when pref.min_price is null or p.price>=pref.min_price then 5 else 0 end)+
    (case when pref.max_price is null or p.price<=pref.max_price then 5 else 0 end)+
    (case when pref.min_bedrooms is null or coalesce(p.bedrooms,0)>=pref.min_bedrooms then 5 else 0 end)+
    (case when pref.min_parking is null or coalesce(p.parking_spaces,0)>=pref.min_parking then 5 else 0 end)
  )::integer as match_score
from public.lead_property_preferences pref
join public.properties p on p.agency_id=pref.agency_id
where pref.active=true and p.publication_state='published' and p.status='available';

revoke all on public.lead_property_match_candidates from public,anon;
grant select on public.lead_property_match_candidates to authenticated;
