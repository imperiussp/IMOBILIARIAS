# Homologação e colocação na rede — LENOY IMOBILIÁRIAS

Este documento descreve como colocar o IMOBILIÁRIAS online para testes sem transformar homologação em lançamento comercial por acidente.

## Regra principal

Use somente um projeto Supabase exclusivo do IMOBILIÁRIAS. Não reutilize URL, chaves, banco, storage, usuários administrativos ou secrets de Moto Connect, Lê+, LENOY Match, RM Agenda ou qualquer outro sistema.

## Estado seguro padrão

O ambiente deve iniciar em `homologation` com:

- catálogo público conforme a necessidade do teste;
- novos cadastros de imobiliárias desligados;
- cobrança real desligada;
- mensageria externa desligada;
- IA real desligada;
- push desligado;
- modo manutenção desligado;
- indexação pública desligada.

`maintenance_mode=true` funciona como kill switch e deve prevalecer sobre recursos externos.

## Proteções atuais de release

As migrations de hardening incluem:

- `0109` — controles globais de release;
- `0113` — bloqueio de onboarding direto no banco;
- `0114` — gate de push e proteção inicial de promoção;
- `0116` — autoridade central de runtime;
- `0118` — auditoria estrutural multi-tenant;
- `0119` — requisitos de segurança para produção;
- `0120` — evidências persistentes de homologação;
- `0121` — produção exige evidências obrigatórias;
- `0122` — readiness v3;
- `0123` — auditoria de escopo tenant herdado;
- `0124` — checkpoints de implantação;
- `0125` — deployment readiness integrado ao release gate;
- `0126` — histórico de checkpoints;
- `0127` — rollback e smoke checks;
- `0128` — registro auditável de releases implantadas;
- `0129` — produção exige release ativa com smoke aprovado.

## Validação estática antes de homologar

Execute `pnpm release:validate`.

O comando reúne contrato de ambiente, kit de homologação, migration safety, Edge guards, typecheck web, build web e typecheck mobile. O CI do `main` executa o mesmo caminho.

## Ordem recomendada para primeira homologação online

1. Criar e confirmar um Supabase exclusivo para IMOBILIÁRIAS.
2. Configurar os project refs e executar `pnpm supabase:guard`.
3. Aplicar todas as migrations em ordem até `0129`.
4. Confirmar `project_identity() = IMOBILIARIAS`.
5. Confirmar `environment_mode=homologation` e gates externos OFF.
6. Configurar URL/chave pública no web e app; service role somente no backend.
7. Implantar somente Edge Functions necessárias ao escopo inicial.
8. Publicar o Next.js com `NEXT_PUBLIC_ALLOW_INDEXING=false`.
9. Definir `NEXT_PUBLIC_COMMIT_SHA` e `NEXT_PUBLIC_BUILD_LABEL` no deploy.
10. Configurar DNS/TLS.
11. Executar smoke pós-deploy exigindo o commit correto.
12. Registrar a release no painel sem marcá-la ativa prematuramente.
13. Criar duas imobiliárias e contas independentes.
14. Executar regressão multi-tenant e testes funcionais.
15. Configurar cron/manutenção e confirmar `success=true` recente.
16. Validar backup e recuperação.
17. Registrar todas as evidências obrigatórias.
18. Revisar readiness, tenant audit, checkpoints, health e release registry.
19. Testar integrações externas uma por vez, com dados controlados.

## Identidade do build e smoke

O `/api/health` deve mostrar o commit e o label do build realmente implantado. Use:

`DEPLOYMENT_URL=https://SEU-HOST EXPECTED_COMMIT_SHA=<sha> pnpm smoke:deploy`

Se o host estiver servindo outro commit, a homologação deve falhar.

## Teste multi-imobiliária obrigatório

Usar duas imobiliárias e contas independentes. Confirmar que dados privados, imóveis, leads, documentos, fotos, notificações, oportunidades e operações de escrita não atravessam tenants.

O arquivo `supabase/tests/tenant-isolation-regression.sql` é a base do teste automatizável em ambiente controlado.

## Release registry e rollback

Toda publicação real deve ser registrada em `platform_deployment_releases` com commit, label, URL e status do smoke.

Uma release só pode ser marcada ativa depois de smoke aprovado. Um candidato a rollback só deve ser marcado depois de ter sido validado anteriormente. O histórico não deve ser apagado.

## Promoção protegida para produção

A mudança para `production` deve ser recusada se faltar qualquer requisito obrigatório, incluindo manutenção saudável, auditoria multi-tenant, evidências, checkpoints de deployment e, desde `0129`, uma release ativa com smoke aprovado.

Não existe necessidade de confiar somente na interface: a proteção deve permanecer no banco.

## Antes do lançamento comercial

1. executar novamente `pnpm release:validate`;
2. confirmar CI/build observável ou validação equivalente;
3. confirmar smoke do commit exato;
4. confirmar release ativa e validada;
5. repetir teste entre duas imobiliárias;
6. confirmar zero falhas críticas de isolamento;
7. confirmar todas as evidências obrigatórias;
8. confirmar manutenção bem-sucedida recente;
9. confirmar checkpoints e backup/rollback;
10. promover para produção;
11. ativar integrações comerciais uma por vez;
12. habilitar `NEXT_PUBLIC_ALLOW_INDEXING=true` somente no lançamento público deliberado;
13. executar `docs/POST-DEPLOY-CHECKLIST.md`.

## O que este repositório não faz sozinho

Ter o código pronto não significa que o ambiente esteja implantado. Criar Supabase, aplicar migrations, configurar secrets, fazer deploy web/Edge, apontar DNS, configurar provedores, validar backup e executar testes reais continuam sendo ações deliberadas de infraestrutura.
