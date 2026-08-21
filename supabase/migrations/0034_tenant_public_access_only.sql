-- Evita que um domínio consulte diretamente o catálogo de outra imobiliária.
-- O acesso público ao catálogo passa pelos RPCs que validam hostname + agency_id.

revoke select on public.property_catalog from anon, authenticated;

create or replace function public.public_property_for_host(p_hostname text, p_property_id uuid)
returns setof public.property_catalog
language sql
stable
security definer
set search_path = public
as $$
  select pc.*
  from public.property_catalog pc
  join public.agency_domains d on d.agency_id = pc.agency_id
  join public.agencies a on a.id = pc.agency_id
  where pc.id = p_property_id
    and lower(d.hostname) = lower(trim(p_hostname))
    and d.verified = true
    and a.status in ('trial','active','past_due')
  limit 1
$$;

grant execute on function public.public_property_for_host(text, uuid) to anon, authenticated;

-- Fotos públicas também devem pertencer ao imóvel resolvido para o hostname.
create or replace function public.public_property_photos_for_host(p_hostname text, p_property_id uuid)
returns table (
  id uuid,
  storage_path text,
  thumbnail_path text,
  position integer,
  is_cover boolean,
  alt_text text
)
language sql
stable
security definer
set search_path = public
as $$
  select pp.id, pp.storage_path, pp.thumbnail_path, pp.position, pp.is_cover, pp.alt_text
  from public.property_photos pp
  join public.properties p on p.id = pp.property_id
  join public.agency_domains d on d.agency_id = p.agency_id
  join public.agencies a on a.id = p.agency_id
  where p.id = p_property_id
    and p.publication_state = 'published'
    and p.status in ('available','reserved','rented','sold')
    and lower(d.hostname) = lower(trim(p_hostname))
    and d.verified = true
    and a.status in ('trial','active','past_due')
  order by pp.is_cover desc, pp.position asc, pp.created_at asc
$$;

grant execute on function public.public_property_photos_for_host(text, uuid) to anon, authenticated;
