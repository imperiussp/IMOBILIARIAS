create policy "brokers read own profile" on public.brokers
for select to authenticated
using (user_id = auth.uid());

create or replace function public.assign_lead_broker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.property_id is not null and new.broker_id is null then
    select p.broker_id into new.broker_id
    from public.properties p
    where p.id = new.property_id;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_assign_broker_trigger on public.leads;
create trigger leads_assign_broker_trigger
before insert on public.leads
for each row execute function public.assign_lead_broker();

create policy "brokers read own leads" on public.leads
for select to authenticated
using (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.user_id = auth.uid()
      and b.active = true
  )
);

create policy "brokers update own leads" on public.leads
for update to authenticated
using (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.user_id = auth.uid()
      and b.active = true
  )
)
with check (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.user_id = auth.uid()
      and b.active = true
  )
);
