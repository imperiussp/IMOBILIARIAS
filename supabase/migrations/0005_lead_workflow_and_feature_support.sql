create type public.lead_status as enum ('new', 'contacted', 'visit_scheduled', 'won', 'lost');

alter table public.leads
  add column if not exists status public.lead_status not null default 'new',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create index if not exists leads_status_created_idx
on public.leads (status, created_at desc);

create index if not exists feature_links_feature_idx
on public.property_feature_links (feature_id, property_id);
