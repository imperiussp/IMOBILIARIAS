create policy "authorized read own property storage" on storage.objects
for select to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1 from public.properties p
    left join public.brokers b on b.id = p.broker_id
    where p.id = public.storage_property_id(name)
      and (public.is_admin() or (b.user_id = auth.uid() and b.active = true))
  )
);
