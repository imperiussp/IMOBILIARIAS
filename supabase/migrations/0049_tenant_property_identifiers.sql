-- Códigos e slugs de imóveis pertencem ao namespace de cada imobiliária.
-- Duas imobiliárias podem usar o mesmo código sem colisão entre tenants.

alter table public.properties drop constraint if exists properties_code_key;
alter table public.properties drop constraint if exists properties_slug_key;

drop index if exists public.properties_code_key;
drop index if exists public.properties_slug_key;

create unique index if not exists properties_agency_code_unique_idx
on public.properties (agency_id, code);

create unique index if not exists properties_agency_slug_unique_idx
on public.properties (agency_id, slug);

create index if not exists properties_agency_published_recent_idx
on public.properties (agency_id, publication_state, published_at desc nulls last, created_at desc);
