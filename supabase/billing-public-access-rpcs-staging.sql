-- STAGING ONLY. Review all public data and storage policies before deployment.
-- The helper is computed per agency. No records are deleted or updated.
create or replace function public.billing_agency_public_level(p_agency_id uuid)
returns text language sql stable security definer set search_path='public'
as $$
with chosen as (
 select a.status agency_status,s.status subscription_status,
 coalesce(s.ends_at,s.renews_at) due_at
 from public.agencies a left join lateral (
   select status,ends_at,renews_at from public.agency_subscriptions s
   where s.agency_id=a.id and s.status in ('trial','active','past_due')
   order by s.created_at desc limit 1
 ) s on true where a.id=p_agency_id
)
select coalesce((select case
 when agency_status not in ('active','trial','past_due') then 'suspended'
 when subscription_status='trial' then 'full'
 when subscription_status is null or due_at is null then 'full'
 when (now() at time zone 'America/Sao_Paulo')::date-
      (due_at at time zone 'America/Sao_Paulo')::date>=5 then 'suspended'
 when (now() at time zone 'America/Sao_Paulo')::date-
      (due_at at time zone 'America/Sao_Paulo')::date>=2 then 'limited'
 else 'full' end from chosen),'suspended');
$$;
revoke all on function public.billing_agency_public_level(uuid) from public;
grant execute on function public.billing_agency_public_level(uuid) to anon,authenticated;

-- Preserve existing function signatures and result types.
create or replace function public.public_catalog_for_host(p_hostname text)
returns setof public.property_catalog language sql stable security definer set search_path='public'
as $$
select pc.* from public.property_catalog pc
join public.agency_domains d on d.agency_id=pc.agency_id
join public.agencies a on a.id=pc.agency_id
where lower(d.hostname)=lower(trim(p_hostname)) and d.verified
and a.status in ('trial','active','past_due')
and public.billing_agency_public_level(a.id)='full'
order by pc.featured desc,pc.published_at desc nulls last;
$$;
create or replace function public.public_property_for_host(p_hostname text,p_property_id uuid)
returns setof public.property_catalog language sql stable security definer set search_path='public'
as $$
select pc.* from public.property_catalog pc
join public.agency_domains d on d.agency_id=pc.agency_id
join public.agencies a on a.id=pc.agency_id
where pc.id=p_property_id and lower(d.hostname)=lower(trim(p_hostname))
and d.verified and a.status in ('trial','active','past_due')
and public.billing_agency_public_level(a.id)='full' limit 1;
$$;
create or replace function public.public_property_photos_for_host(p_hostname text,p_property_id uuid)
returns table(id uuid,storage_path text,thumbnail_path text,"position" integer,is_cover boolean,alt_text text)
language sql stable security definer set search_path='public'
as $$
select pp.id,pp.storage_path,pp.thumbnail_path,pp.position,pp.is_cover,pp.alt_text
from public.property_photos pp join public.properties p on p.id=pp.property_id
join public.agency_domains d on d.agency_id=p.agency_id
join public.agencies a on a.id=p.agency_id
where p.id=p_property_id and p.publication_state='published'
and p.status in ('available','reserved','rented','sold')
and lower(d.hostname)=lower(trim(p_hostname)) and d.verified
and a.status in ('trial','active','past_due')
and public.billing_agency_public_level(a.id)='full'
order by pp.is_cover desc,pp.position asc,pp.created_at asc;
$$;

-- Before rollout: inspect direct grants on property_catalog/properties, photo buckets,
-- leads, contact RPCs, and all alternative route/query APIs; protect all paths.
-- Add explicit internal-exemption classification before enabling on live tenants.
