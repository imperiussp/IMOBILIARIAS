-- Garante que rascunhos e imóveis inativos não vazem por acesso direto às tabelas.
drop policy if exists "public read active properties" on public.properties;
create policy "public read published properties" on public.properties
for select to anon, authenticated
using (
  publication_state = 'published'
  and status in ('available', 'reserved', 'rented', 'sold')
);

drop policy if exists "public read property photos" on public.property_photos;
create policy "public read published property photos" on public.property_photos
for select to anon, authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
      and p.publication_state = 'published'
      and p.status in ('available', 'reserved', 'rented', 'sold')
  )
);

-- Evita expor diretamente e-mail, telefone e user_id de corretores pela tabela pública.
drop policy if exists "public read active brokers" on public.brokers;

-- Leads públicos só podem apontar para imóvel efetivamente publicado.
drop policy if exists "public create leads" on public.leads;
create policy "public create valid leads" on public.leads
for insert to anon, authenticated
with check (
  property_id is null
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and p.publication_state = 'published'
      and p.status in ('available', 'reserved', 'rented', 'sold')
  )
);

-- Histórico de alterações importantes para auditoria e recuperação operacional.
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "admins read audit log" on public.audit_log
for select to authenticated using (public.is_admin());

create or replace function public.log_property_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (user_id, entity_type, entity_id, action, new_data)
    values (auth.uid(), 'property', new.id, 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (user_id, entity_type, entity_id, action, old_data, new_data)
    values (auth.uid(), 'property', new.id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (user_id, entity_type, entity_id, action, old_data)
    values (auth.uid(), 'property', old.id, 'delete', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists properties_audit_trigger on public.properties;
create trigger properties_audit_trigger
after insert or update or delete on public.properties
for each row execute function public.log_property_changes();

create or replace function public.log_broker_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (user_id, entity_type, entity_id, action, new_data)
    values (auth.uid(), 'broker', new.id, 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (user_id, entity_type, entity_id, action, old_data, new_data)
    values (auth.uid(), 'broker', new.id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (user_id, entity_type, entity_id, action, old_data)
    values (auth.uid(), 'broker', old.id, 'delete', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists brokers_audit_trigger on public.brokers;
create trigger brokers_audit_trigger
after insert or update or delete on public.brokers
for each row execute function public.log_broker_changes();
