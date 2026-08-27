-- Permite que a política pública do bucket property-photos valide os dois primeiros segmentos do caminho.
-- Sem estes EXECUTEs, o RLS do usuário anon falha com permission denied e o site cai na imagem padrão.
grant execute on function public.storage_agency_id(text) to anon;
grant execute on function public.storage_tenant_property_id(text) to anon;
