-- Resolução automática de tenants para subdomínios da plataforma.
-- Ex.: joao.imoveis.lenoy.com.br -> agency.slug = 'joao'.
-- Domínios próprios continuam sendo resolvidos por agency_domains.

create or replace function public.resolve_agency_by_slug(p_slug text)
returns table (
  agency_id uuid,
  slug text,
  name text,
  tagline text,
  phone text,
  whatsapp text,
  email text,
  address text,
  company_creci text,
  logo_url text,
  primary_color text,
  secondary_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.slug, a.name, a.tagline, a.phone, a.whatsapp, a.email, a.address,
         a.company_creci, a.logo_url, a.primary_color, a.secondary_color
  from public.agencies a
  where lower(a.slug) = lower(trim(p_slug))
    and a.status in ('trial','active','past_due')
  limit 1
$$;

grant execute on function public.resolve_agency_by_slug(text) to anon, authenticated;

-- Reserva nomes que pertencem à própria plataforma e não devem virar tenant.
create or replace function public.valid_agency_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    p_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    and lower(p_slug) not in (
      'www','admin','app','api','mail','smtp','ftp','cdn','static','assets',
      'login','cadastro','conta','suporte','ajuda','status','imoveis','lenoy'
    )
$$;

alter table public.agencies
  drop constraint if exists agencies_slug_platform_check;

alter table public.agencies
  add constraint agencies_slug_platform_check
  check (public.valid_agency_slug(slug));
