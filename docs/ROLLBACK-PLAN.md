# Plano de rollback — LENOY IMOBILIÁRIAS

Este plano deve estar validado antes de promover homologação para produção.

## Princípio

Rollback não significa apagar migrations. Mudanças de banco já aplicadas devem ser tratadas por migration corretiva/aditiva. O rollback de aplicação deve priorizar voltar o web/Edge Functions para o último commit estável e colocar o sistema em modo manutenção quando houver dúvida sobre consistência.

## Gatilhos para rollback

Executar rollback se, após deploy, ocorrer qualquer um destes cenários:

- `/api/health` retorna `503` ou identidade diferente de `IMOBILIARIAS`;
- login/admin deixam de funcionar;
- isolamento entre imobiliárias falha;
- criação/edição de imóveis ou fotos apresenta perda/corrupção de dados;
- webhooks geram duplicidade de cobrança/mensageria;
- manutenção automática passa a falhar de forma recorrente;
- erro crítico novo impede operação normal.

## Sequência segura

1. Ativar `maintenance_mode=true` no Controle Global, se o banco estiver acessível.
2. Desligar cobrança, mensageria externa, IA e push.
3. Registrar o motivo e horário da reversão.
4. Voltar web e Edge Functions ao último commit/deploy estável conhecido.
5. Não executar `DROP`, truncamentos ou reversões destrutivas no banco.
6. Se a origem for migration, preparar migration corretiva aditiva.
7. Validar `/api/health`.
8. Executar `pnpm smoke:deploy` contra o domínio.
9. Testar login, tenant, imóvel, fotos, lead/CRM e isolamento entre duas imobiliárias.
10. Só retirar modo manutenção após os testes críticos passarem.

## Banco de dados

Antes de qualquer migration de produção:

- confirmar backup disponível;
- confirmar project ref exclusivo do IMOBILIARIAS;
- executar `pnpm supabase:guard`;
- manter cópia do SHA/versão anterior da aplicação;
- nunca reutilizar backup de outro projeto Supabase.

Se uma migration causar problema, preferir:

- nova migration que restaure constraint/policy/função correta;
- desabilitar funcionalidade por gate enquanto a correção é preparada;
- preservar dados e histórico.

## Aplicação web

Registrar sempre o commit implantado. Para rollback, republicar o último commit estável e manter `NEXT_PUBLIC_ALLOW_INDEXING=false` se o ambiente voltar a homologação.

## Edge Functions

Reimplantar a versão anterior somente a partir do mesmo repositório/commit conhecido. Secrets não devem ser alterados como tentativa de corrigir bug de código sem diagnóstico.

## Confirmação pós-rollback

Considerar rollback concluído somente quando:

- health endpoint retorna HTTP 200;
- smoke test externo passa;
- Supabase retorna `project_identity() = IMOBILIARIAS`;
- não existe falha crítica na auditoria multi-tenant;
- uma manutenção controlada termina com `success=true`;
- não há envio/cobrança externa inesperada;
- o incidente e a correção ficaram documentados.
