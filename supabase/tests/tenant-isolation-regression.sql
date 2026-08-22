-- TESTE MANUAL/CI PARA SUPABASE LOCAL OU HOMOLOGAÇÃO DESCARTÁVEL.
-- NÃO executar em produção com dados reais.
-- Objetivo: provar que duas imobiliárias não enxergam dados uma da outra.
-- Este arquivo NÃO é migration.

begin;

-- O teste pressupõe migrations aplicadas e dois usuários de teste existentes no Auth.
-- Substitua os UUIDs apenas em ambiente descartável/homologação.
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);

-- Cenário esperado a ser automatizado quando o Supabase exclusivo estiver disponível:
-- 1. criar Agency A e Agency B;
-- 2. vincular User A somente à Agency A;
-- 3. vincular User B somente à Agency B;
-- 4. criar imóvel, lead, documento, visita, notificação e oportunidade em cada tenant;
-- 5. autenticar como User A e confirmar contagem ZERO para registros da Agency B;
-- 6. tentar INSERT/UPDATE/DELETE usando agency_id da Agency B e exigir falha de RLS;
-- 7. repetir de forma simétrica como User B;
-- 8. confirmar que platform admin continua com visão global apenas nas áreas autorizadas.

-- Guard estrutural imediatamente executável: todas as tabelas críticas existentes devem ter RLS.
do $$
declare
  r record;
begin
  for r in
    select * from public.platform_tenant_security_audit()
  loop
    if r.status = 'critical' then
      raise exception 'Falha estrutural de isolamento em %: %', r.table_name, r.detail;
    end if;
  end loop;
end $$;

rollback;
