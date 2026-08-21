-- Segurança adicional do SaaS:
-- 1) dados completos da tabela agencies deixam de ser legíveis diretamente por anônimos;
-- 2) a resolução pública continua exclusivamente pelas funções de hostname/slug;
-- 3) administradores globais recebem visão completa para o painel da plataforma.

-- A tabela agencies contém e-mail, endereço, telefone e outros campos internos.
-- O site público deve obter somente o tenant resolvido pelas funções dedicadas.
drop policy if exists "public read active agencies" on public.agencies;

-- Mantém o acesso dos membros ao próprio tenant (policy criada em 0031)
-- e acrescenta a visão global exclusiva da plataforma.
drop policy if exists "platform admins read all agencies" on public.agencies;
create policy "platform admins read all agencies" on public.agencies
for select to authenticated
using (public.is_platform_admin());

drop policy if exists "platform admins read all domains" on public.agency_domains;
create policy "platform admins read all domains" on public.agency_domains
for select to authenticated
using (public.is_platform_admin());

drop policy if exists "platform admins read all memberships" on public.agency_memberships;
create policy "platform admins read all memberships" on public.agency_memberships
for select to authenticated
using (public.is_platform_admin());

-- Funções públicas de resolução não devem herdar EXECUTE de PUBLIC.
-- Somente os papéis explicitamente necessários recebem acesso.
revoke all on function public.resolve_agency_by_host(text) from public;
revoke all on function public.resolve_agency_by_slug(text) from public;
revoke all on function public.agency_slug_available(text) from public;
grant execute on function public.resolve_agency_by_host(text) to anon, authenticated;
grant execute on function public.resolve_agency_by_slug(text) to anon, authenticated;
grant execute on function public.agency_slug_available(text) to anon, authenticated;

-- As funções internas de normalização/validação não precisam ser chamadas
-- diretamente pelo navegador.
revoke all on function public.normalize_agency_slug(text) from public;
revoke all on function public.is_reserved_agency_slug(text) from public;
revoke all on function public.valid_agency_slug(text) from public;
