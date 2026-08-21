create type public.user_role as enum ('admin', 'broker');

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "users read own role" on public.user_roles
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "admins manage roles" on public.user_roles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage cities" on public.cities
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage neighborhoods" on public.neighborhoods
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage property types" on public.property_types
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage features" on public.property_features
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage feature links" on public.property_feature_links
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage brokers" on public.brokers
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage properties" on public.properties
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage property photos" on public.property_photos
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read leads" on public.leads
for select to authenticated using (public.is_admin());
create policy "admins manage leads" on public.leads
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "brokers manage own properties" on public.properties
for all to authenticated
using (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id and b.user_id = auth.uid() and b.active = true
  )
)
with check (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id and b.user_id = auth.uid() and b.active = true
  )
);

create policy "brokers manage photos of own properties" on public.property_photos
for all to authenticated
using (
  exists (
    select 1
    from public.properties p
    join public.brokers b on b.id = p.broker_id
    where p.id = property_id and b.user_id = auth.uid() and b.active = true
  )
)
with check (
  exists (
    select 1
    from public.properties p
    join public.brokers b on b.id = p.broker_id
    where p.id = property_id and b.user_id = auth.uid() and b.active = true
  )
);

create policy "public create leads" on public.leads
for insert to anon, authenticated
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-photos',
  'property-photos',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create policy "public read property storage" on storage.objects
for select using (bucket_id = 'property-photos');

create policy "authenticated upload property storage" on storage.objects
for insert to authenticated
with check (bucket_id = 'property-photos');

create policy "authenticated update property storage" on storage.objects
for update to authenticated
using (bucket_id = 'property-photos')
with check (bucket_id = 'property-photos');

create policy "authenticated delete property storage" on storage.objects
for delete to authenticated
using (bucket_id = 'property-photos');
