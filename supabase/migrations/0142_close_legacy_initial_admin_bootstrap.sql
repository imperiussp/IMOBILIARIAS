-- Fecha o bootstrap legado do primeiro administrador na API pública.
-- As funções são preservadas para compatibilidade histórica, mas não podem mais ser chamadas por clientes.
-- is_admin() já delega a is_platform_admin(), portanto esta alteração não muda o modelo administrativo atual.

revoke execute on function public.claim_initial_admin() from public, anon, authenticated;
revoke execute on function public.initial_admin_available() from public, anon, authenticated;
