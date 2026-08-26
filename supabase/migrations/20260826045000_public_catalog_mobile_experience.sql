alter table public.agencies add column if not exists instagram_url text;
alter table public.agencies add column if not exists facebook_url text;
alter table public.agencies add column if not exists youtube_url text;
alter table public.site_settings add column if not exists instagram_url text;
alter table public.site_settings add column if not exists facebook_url text;
alter table public.site_settings add column if not exists youtube_url text;
alter table public.properties add column if not exists display_code text;
alter table public.properties add column if not exists marketing_label text;

create unique index if not exists properties_agency_display_code_uidx
  on public.properties (agency_id, display_code)
  where display_code is not null;

create or replace function public.property_display_prefix(p_property_type_id uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_name text;
begin
  select lower(coalesce(name,'')) into v_name from public.property_types where id = p_property_type_id;
  return case
    when v_name like '%apartamento%' then 'AP'
    when v_name like '%casa%condom%' then 'CC'
    when v_name = 'casa' or v_name like 'casa %' then 'CA'
    when v_name like '%fazenda%' then 'FA'
    when v_name like '%chácara%' or v_name like '%chacara%' then 'CH'
    when v_name like '%sítio%' or v_name like '%sitio%' then 'SI'
    when v_name like '%terreno%' then 'TE'
    when v_name like '%prédio comercial%' or v_name like '%predio comercial%' then 'PR'
    when v_name like '%ponto comercial%' then 'PC'
    when v_name like '%salão comercial%' or v_name like '%salao comercial%' then 'SC'
    when v_name like '%sala comercial%' then 'SC'
    when v_name like '%galpão%' or v_name like '%galpao%' then 'GA'
    when v_name like '%loja%' then 'LO'
    else 'IM'
  end;
end;
$$;

create or replace function public.assign_property_display_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  if new.display_code is not null and btrim(new.display_code) <> '' then
    new.display_code := upper(regexp_replace(btrim(new.display_code), '[^A-Za-z0-9-]', '', 'g'));
    return new;
  end if;
  v_prefix := public.property_display_prefix(new.property_type_id);
  perform pg_advisory_xact_lock(hashtext(new.agency_id::text || ':' || v_prefix));
  select coalesce(max((substring(display_code from '([0-9]+)$'))::integer), 9) + 1 into v_next
  from public.properties
  where agency_id = new.agency_id and display_code ~ ('^' || v_prefix || '[0-9]+$');
  new.display_code := v_prefix || v_next::text;
  return new;
end;
$$;

drop trigger if exists trg_assign_property_display_code on public.properties;
create trigger trg_assign_property_display_code
before insert or update of property_type_id, agency_id, display_code on public.properties
for each row execute function public.assign_property_display_code();

with ranked as (
  select p.id, public.property_display_prefix(p.property_type_id) as prefix,
         row_number() over (partition by p.agency_id, public.property_display_prefix(p.property_type_id) order by p.created_at nulls last, p.id) + 9 as seq
  from public.properties p where p.display_code is null or btrim(p.display_code) = ''
)
update public.properties p set display_code = r.prefix || r.seq::text from ranked r where p.id = r.id;

insert into public.property_types (name, slug, active, agency_id)
select v.name, v.slug, true, null
from (values
  ('Apartamento','apartamento'),('Casa','casa'),('Casa de condomínio','casa-de-condominio'),('Terreno','terreno'),
  ('Chácara','chacara'),('Sítio','sitio'),('Ponto comercial','ponto-comercial'),('Prédio comercial','predio-comercial'),
  ('Galpão','galpao'),('Salão comercial','salao-comercial'),('Fazenda','fazenda')
) as v(name,slug)
where not exists (select 1 from public.property_types pt where pt.agency_id is null and lower(pt.slug)=lower(v.slug));

create or replace view public.property_catalog as
select p.id,p.agency_id,coalesce(nullif(p.display_code,''),p.code) as code,p.slug,p.title,p.description,p.purpose,p.zone,p.segment,p.status,p.publication_state,p.price,
 p.bedrooms,p.suites,p.bathrooms,p.parking_spaces,p.built_area_m2,p.land_area_m2,
 case when p.address_public then p.address else null::text end as address,p.address_public,p.featured,p.published_at,
 c.name as city,c.state_code,n.name as neighborhood,pt.name as property_type,b.name as broker_name,b.whatsapp as broker_whatsapp,b.creci as broker_creci,b.area_of_operation as broker_area_of_operation,
 (select pp.storage_path from public.property_photos pp where pp.property_id=p.id order by pp.is_cover desc,pp.position,pp.created_at limit 1) as cover_path,
 (select coalesce(pp.thumbnail_path,pp.storage_path) from public.property_photos pp where pp.property_id=p.id order by pp.is_cover desc,pp.position,pp.created_at limit 1) as cover_thumbnail_path,
 p.marketing_label,p.latitude,p.longitude
from public.properties p join public.cities c on c.id=p.city_id left join public.neighborhoods n on n.id=p.neighborhood_id left join public.property_types pt on pt.id=p.property_type_id left join public.brokers b on b.id=p.broker_id
where p.publication_state='published'::publication_state and p.status=any(array['available'::property_status,'reserved'::property_status,'rented'::property_status,'sold'::property_status]);

create or replace function public.public_agency_socials_for_host(p_hostname text)
returns table(instagram_url text, facebook_url text, youtube_url text, phone text, whatsapp text)
language sql stable security definer set search_path=public
as $$
 select a.instagram_url,a.facebook_url,a.youtube_url,a.phone,a.whatsapp from public.agency_domains d join public.agencies a on a.id=d.agency_id
 where lower(d.hostname)=lower(trim(p_hostname)) and d.verified=true and a.status in ('trial','active','past_due') limit 1
$$;

revoke all on function public.public_agency_socials_for_host(text) from public;
grant execute on function public.public_agency_socials_for_host(text) to anon, authenticated;
revoke all on function public.property_display_prefix(uuid) from public;
revoke all on function public.assign_property_display_code() from public;
