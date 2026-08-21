-- Evolução para SaaS multi-imobiliária sem remover a estrutura existente.

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  phone text,
  whatsapp text,
  email text,
  address text,
  company_creci text,
  logo_url text,
  primary_color text,
  secondary_color text,
  status text not null default 'trial' check (status in ('trial','active','past_due','suspended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_domains (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  hostname text not null unique,
  kind text not null default 'custom' check (kind in ('platform','custom')),
  is_primary boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists public.agency_memberships (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','broker','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

insert into public.agencies (id, slug, name, tagline, status)
values ('00000000-0000-0000-0000-000000000001', 'imobiliarias-demo', 'IMOBILIARIAS', 'Seu imóvel, sua escolha, seu próximo passo.', 'active')
on conflict (id) do nothing;

alter table public.properties add column if not exists agency_id uuid references public.agencies(id) on delete restrict;
alter table public.brokers add column if not exists agency_id uuid references public.agencies(id) on delete restrict;
alter table public.leads add column if not exists agency_id uuid references public.agencies(id) on delete restrict;
alter table public.agency_subscriptions add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

update public.properties set agency_id = '00000000-0000-0000-0000-000000000001' where agency_id is null;
update public.brokers set agency_id = '00000000-0000-0000-0000-000000000001' where agency_id is null;
update public.leads l set agency_id = coalesce((select p.agency_id from public.properties p where p.id = l.property_id), '00000000-0000-0000-0000-000000000001') where l.agency_id is null;
update public.agency_subscriptions set agency_id = '00000000-0000-0000-0000-000000000001' where agency_id is null;

create index if not exists properties_agency_idx on public.properties (agency_id, publication_state, status, published_at desc);
create index if not exists brokers_agency_idx on public.brokers (agency_id, active, name);
create index if not exists leads_agency_idx on public.leads (agency_id, created_at desc);
create index if not exists domains_agency_idx on public.agency_domains (agency_id, verified, is_primary);

alter table public.agencies enable row level security;
alter table public.agency_domains enable row level security;
alter table public.agency_memberships enable row level security;

create or replace function public.current_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select am.agency_id
  from public.agency_memberships am
  where am.user_id = auth.uid() and am.active = true
$$;

create or replace function public.resolve_agency_by_host(p_hostname text)
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
  from public.agency_domains d
  join public.agencies a on a.id = d.agency_id
  where lower(d.hostname) = lower(trim(p_hostname))
    and d.verified = true
    and a.status in ('trial','active','past_due')
  limit 1
$$;

grant execute on function public.resolve_agency_by_host(text) to anon, authenticated;

drop policy if exists "public read active agencies" on public.agencies;
create policy "public read active agencies" on public.agencies
for select to anon, authenticated
using (status in ('trial','active','past_due'));

create policy "members read own agency" on public.agencies
for select to authenticated
using (id in (select public.current_agency_ids()));

create policy "members read own domains" on public.agency_domains
for select to authenticated
using (agency_id in (select public.current_agency_ids()));

create policy "agency admins manage domains" on public.agency_domains
for all to authenticated
using (
  exists (select 1 from public.agency_memberships am where am.agency_id = agency_domains.agency_id and am.user_id = auth.uid() and am.active and am.role in ('owner','admin'))
)
with check (
  exists (select 1 from public.agency_memberships am where am.agency_id = agency_domains.agency_id and am.user_id = auth.uid() and am.active and am.role in ('owner','admin'))
);

create policy "members read own memberships" on public.agency_memberships
for select to authenticated
using (user_id = auth.uid() or agency_id in (select public.current_agency_ids()));

-- A assinatura passa a ser uma por imobiliária, não uma única global.
drop index if exists agency_subscriptions_single_current_idx;
create unique index if not exists agency_subscriptions_single_current_idx
on public.agency_subscriptions (agency_id)
where status in ('trial','active','past_due');
