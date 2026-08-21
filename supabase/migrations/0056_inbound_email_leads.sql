-- Entrada de contatos recebidos por e-mail.
-- Cada imobiliária recebe um alias técnico estável; o provedor de e-mail/webhook será conectado no deploy.

create table if not exists public.agency_inbound_emails (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  address text not null unique,
  broker_id uuid references public.brokers(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_inbound_emails_agency_idx
on public.agency_inbound_emails (agency_id, active);

alter table public.agency_inbound_emails enable row level security;

drop policy if exists "tenant managers read inbound emails" on public.agency_inbound_emails;
create policy "tenant managers read inbound emails" on public.agency_inbound_emails
for select to authenticated
using (public.can_manage_agency(agency_id));

drop policy if exists "platform admins manage inbound emails" on public.agency_inbound_emails;
create policy "platform admins manage inbound emails" on public.agency_inbound_emails
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

revoke insert, update, delete on public.agency_inbound_emails from anon, authenticated;
grant select on public.agency_inbound_emails to authenticated;

create or replace function public.ensure_agency_inbound_email(p_agency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  agency_slug text;
  inbound_address text;
begin
  select a.slug into agency_slug from public.agencies a where a.id = p_agency_id;
  if agency_slug is null then return; end if;
  inbound_address := lower(agency_slug || '@entrada.imoveis.lenoy.com.br');

  insert into public.agency_inbound_emails (agency_id, address, active)
  values (p_agency_id, inbound_address, true)
  on conflict (address) do nothing;
end;
$$;

revoke all on function public.ensure_agency_inbound_email(uuid) from public;
revoke all on function public.ensure_agency_inbound_email(uuid) from anon, authenticated;

create or replace function public.ensure_agency_inbound_email_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_agency_inbound_email(new.id);
  return new;
end;
$$;

revoke all on function public.ensure_agency_inbound_email_trigger() from public;
revoke all on function public.ensure_agency_inbound_email_trigger() from anon, authenticated;

drop trigger if exists agencies_create_inbound_email on public.agencies;
create trigger agencies_create_inbound_email
after insert on public.agencies
for each row execute function public.ensure_agency_inbound_email_trigger();

-- Backfill dos tenants já existentes.
do $$
declare row_record record;
begin
  for row_record in select id from public.agencies loop
    perform public.ensure_agency_inbound_email(row_record.id);
  end loop;
end $$;

-- Evita ingestão duplicada se o provedor repetir o mesmo webhook.
create table if not exists public.inbound_email_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  received_at timestamptz not null default now()
);

alter table public.inbound_email_events enable row level security;
revoke all on public.inbound_email_events from anon, authenticated;
