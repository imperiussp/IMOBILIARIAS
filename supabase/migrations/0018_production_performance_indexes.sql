create index if not exists properties_public_catalog_idx
  on public.properties (publication_state, status, featured desc, published_at desc);

create index if not exists properties_city_purpose_idx
  on public.properties (city_id, purpose, status, published_at desc);

create index if not exists properties_broker_updated_idx
  on public.properties (broker_id, updated_at desc);

create index if not exists neighborhoods_city_name_idx
  on public.neighborhoods (city_id, lower(name));

create index if not exists property_photos_property_position_idx
  on public.property_photos (property_id, is_cover desc, position asc, created_at asc);

create index if not exists leads_broker_status_created_idx
  on public.leads (broker_id, status, created_at desc);

create index if not exists leads_property_created_idx
  on public.leads (property_id, created_at desc);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);
