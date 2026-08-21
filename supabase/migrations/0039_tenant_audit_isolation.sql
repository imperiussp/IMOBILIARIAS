-- Histórico de auditoria separado por imobiliária.

alter table public.audit_log
add column if not exists agency_id uuid references public.agencies(id) on delete set null;

update public.audit_log a
set agency_id = coalesce(
  nullif(a.new_data ->> 'agency_id', '')::uuid,
  nullif(a.old_data ->> 'agency_id', '')::uuid,
  case
    when a.entity_type = 'property' then (select p.agency_id from public.properties p where p.id = a.entity_id)
    when a.entity_type = 'broker' then (select b.agency_id from public.brokers b where b.id = a.entity_id)
    else null
  end
)
where a.agency_id is null;

create index if not exists audit_log_agency_created_idx
on public.audit_log (agency_id, created_at desc);

drop policy if exists "admins read audit log" on public.audit_log;

create policy "platform admins read audit log" on public.audit_log
for select to authenticated
using (public.is_admin());

create policy "tenant managers read own audit log" on public.audit_log
for select to authenticated
using (agency_id is not null and public.can_manage_agency(agency_id));

create or replace function public.log_property_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (agency_id, user_id, entity_type, entity_id, action, new_data)
    values (new.agency_id, auth.uid(), 'property', new.id, 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (agency_id, user_id, entity_type, entity_id, action, old_data, new_data)
    values (new.agency_id, auth.uid(), 'property', new.id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (agency_id, user_id, entity_type, entity_id, action, old_data)
    values (old.agency_id, auth.uid(), 'property', old.id, 'delete', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.log_broker_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (agency_id, user_id, entity_type, entity_id, action, new_data)
    values (new.agency_id, auth.uid(), 'broker', new.id, 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (agency_id, user_id, entity_type, entity_id, action, old_data, new_data)
    values (new.agency_id, auth.uid(), 'broker', new.id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (agency_id, user_id, entity_type, entity_id, action, old_data)
    values (old.agency_id, auth.uid(), 'broker', old.id, 'delete', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;
