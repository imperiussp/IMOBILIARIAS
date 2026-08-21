-- Mantém no máximo uma foto de capa por imóvel.
create unique index if not exists property_photos_single_cover_idx
on public.property_photos (property_id)
where is_cover = true;
