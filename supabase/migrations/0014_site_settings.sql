create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  agency_name text not null default 'IMOBILIARIAS',
  tagline text not null default 'Seu imóvel, sua escolha, seu próximo passo.',
  phone text,
  whatsapp text,
  email text,
  address text,
  company_creci text,
  logo_url text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

create policy "public read site settings" on public.site_settings
for select to anon, authenticated
using (id = 1);

create policy "admins manage site settings" on public.site_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin() and id = 1);

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();
