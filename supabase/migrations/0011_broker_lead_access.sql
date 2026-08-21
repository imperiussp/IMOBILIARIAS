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

create index if not exists leads_broker_status_idx
on public.leads (broker_id, status, created_at desc);
