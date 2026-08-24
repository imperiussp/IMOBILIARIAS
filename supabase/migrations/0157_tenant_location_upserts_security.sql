-- Impede execução anônima dos RPCs de escrita de localidades.
revoke execute on function public.agency_upsert_city(uuid,text,text) from anon;
revoke execute on function public.agency_upsert_neighborhood(uuid,uuid,text) from anon;
grant execute on function public.agency_upsert_city(uuid,text,text) to authenticated;
grant execute on function public.agency_upsert_neighborhood(uuid,uuid,text) to authenticated;
