-- Notificações por imobiliária para corretores.
-- O primeiro produtor é o próprio portal: um novo lead atribuído ao corretor gera uma notificação.
-- A mesma caixa de entrada poderá receber integrações futuras (ex.: e-mail) sem misturar tenants.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_id uuid references public.brokers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  kind text not null default 'lead',
  title text not null,
  body text,
  source text not null default 'portal',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind in ('lead','message','system')),
  check (source in ('portal','email','system'))
);

create index if not exists app_notifications_user_unread_idx
on public.app_notifications (user_id, agency_id, read_at, created_at desc);

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  token text not null,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token),
  check (platform in ('android','ios'))
);

create index if not exists device_push_tokens_agency_user_idx
on public.device_push_tokens (agency_id, user_id, enabled);

alter table public.app_notifications enable row level security;
alter table public.device_push_tokens enable row level security;

drop policy if exists "users read own app notifications" on public.app_notifications;
create policy "users read own app notifications" on public.app_notifications
for select to authenticated
using (
  user_id = auth.uid()
  and public.is_agency_member(agency_id)
);

drop policy if exists "users update own app notifications" on public.app_notifications;
create policy "users update own app notifications" on public.app_notifications
for update to authenticated
using (
  user_id = auth.uid()
  and public.is_agency_member(agency_id)
)
with check (
  user_id = auth.uid()
  and public.is_agency_member(agency_id)
);

-- Notificações são produzidas internamente; clientes não criam nem apagam registros diretamente.
revoke insert, delete on public.app_notifications from anon, authenticated;
grant select, update on public.app_notifications to authenticated;

drop policy if exists "users manage own device tokens" on public.device_push_tokens;
create policy "users manage own device tokens" on public.device_push_tokens
for all to authenticated
using (
  user_id = auth.uid()
  and public.is_agency_member(agency_id)
)
with check (
  user_id = auth.uid()
  and public.is_agency_member(agency_id)
);

grant select, insert, update, delete on public.device_push_tokens to authenticated;

create or replace function public.notify_broker_about_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  property_code text;
begin
  if new.broker_id is null then
    return new;
  end if;

  select b.user_id into target_user
  from public.brokers b
  where b.id = new.broker_id
    and b.agency_id = new.agency_id
    and b.active = true
  limit 1;

  if target_user is null then
    return new;
  end if;

  if new.property_id is not null then
    select p.code into property_code
    from public.properties p
    where p.id = new.property_id and p.agency_id = new.agency_id;
  end if;

  insert into public.app_notifications (
    agency_id, user_id, broker_id, lead_id, kind, title, body, source
  ) values (
    new.agency_id,
    target_user,
    new.broker_id,
    new.id,
    'lead',
    'Novo contato de cliente',
    case
      when property_code is not null then coalesce(new.name, 'Um cliente') || ' pediu informações sobre o imóvel ' || property_code || '.'
      else coalesce(new.name, 'Um cliente') || ' enviou um novo contato.'
    end,
    case when coalesce(new.source, '') = 'email' then 'email' else 'portal' end
  );

  return new;
end;
$$;

revoke all on function public.notify_broker_about_new_lead() from public;

drop trigger if exists leads_notify_broker on public.leads;
create trigger leads_notify_broker
after insert on public.leads
for each row execute function public.notify_broker_about_new_lead();
