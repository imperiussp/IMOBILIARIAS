-- Evita leitura cruzada de imóveis publicados entre usuários autenticados de tenants distintos.
-- O catálogo público continua disponível para anon e pelos RPCs públicos por hostname.

drop policy if exists "public read published properties" on public.properties;

create policy "anonymous read published properties"
on public.properties
for select
to anon
using (
  publication_state = 'published'::publication_state
  and status = any(array[
    'available'::property_status,
    'reserved'::property_status,
    'rented'::property_status,
    'sold'::property_status
  ])
);
