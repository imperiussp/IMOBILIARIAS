create extension if not exists pgcrypto;

create type public.property_purpose as enum ('sale', 'rent');
create type public.property_zone as enum ('urban', 'rural');
create type public.property_status as enum ('available', 'reserved', 'rented', 'sold', 'inactive');

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_code char(2) not null,
  created_at timestamptz not null default now(),
  unique (name, state_code)
);

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (city_id, name)
);

create table public.brokers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  photo_url text,
  phone text,
  whatsapp text,
  email text,
  creci text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  active boolean not null default true
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  broker_id uuid references public.brokers(id) on delete set null,
  city_id uuid not null references public.cities(id),
  neighborhood_id uuid references public.neighborhoods(id),
  property_type_id uuid references public.property_types(id),
  title text not null,
  slug text not null unique,
  description text,
  purpose public.property_purpose not null,
  zone public.property_zone not null default 'urban',
  status public.property_status not null default 'available',
  price numeric(14,2) not null default 0 check (price >= 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  suites integer check (suites is null or suites >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  parking_spaces integer check (parking_spaces is null or parking_spaces >= 0),
  built_area_m2 numeric(12,2),
  land_area_m2 numeric(12,2),
  address text,
  address_public boolean not null default false,
  latitude numeric(10,7),
  longitude numeric(10,7),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  alt_text text,
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.property_features (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table public.property_feature_links (
  property_id uuid not null references public.properties(id) on delete cascade,
  feature_id uuid not null references public.property_features(id) on delete cascade,
  primary key (property_id, feature_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  name text,
  phone text,
  email text,
  message text,
  source text not null default 'web',
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table public.synchronization_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_operation_id text not null unique,
  entity_type text not null,
  entity_local_id text not null,
  state text not null default 'waiting_network',
  attempts integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_search_idx on public.properties (status, purpose, city_id, neighborhood_id, property_type_id, price);
create index property_photos_property_idx on public.property_photos (property_id, position);
create index leads_created_at_idx on public.leads (created_at desc);

alter table public.cities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.brokers enable row level security;
alter table public.property_types enable row level security;
alter table public.properties enable row level security;
alter table public.property_photos enable row level security;
alter table public.property_features enable row level security;
alter table public.property_feature_links enable row level security;
alter table public.leads enable row level security;
alter table public.favorites enable row level security;
alter table public.synchronization_jobs enable row level security;

create policy "public read active properties" on public.properties
for select using (status in ('available', 'reserved', 'rented', 'sold'));

create policy "public read property photos" on public.property_photos
for select using (exists (
  select 1 from public.properties p where p.id = property_id and p.status in ('available', 'reserved', 'rented', 'sold')
));

create policy "public read cities" on public.cities for select using (true);
create policy "public read neighborhoods" on public.neighborhoods for select using (true);
create policy "public read property types" on public.property_types for select using (active = true);
create policy "public read property features" on public.property_features for select using (true);
create policy "public read feature links" on public.property_feature_links for select using (true);
create policy "public read active brokers" on public.brokers for select using (active = true);

create policy "authenticated manage own favorites" on public.favorites
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "authenticated manage own sync jobs" on public.synchronization_jobs
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
