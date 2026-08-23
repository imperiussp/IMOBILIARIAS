drop policy if exists "tenant upload managed property storage" on storage.objects;

create policy "tenant upload managed property storage"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-photos'
  and public.storage_matches_tenant_property(name)
  and exists (
    select 1
    from public.properties p
    left join public.brokers b
      on b.id = p.broker_id
     and b.agency_id = p.agency_id
    where p.id = public.storage_tenant_property_id(objects.name)
      and p.agency_id = public.storage_agency_id(objects.name)
      and (
        public.can_manage_agency(p.agency_id)
        or (b.user_id = (select auth.uid()) and b.active = true)
      )
  )
);
