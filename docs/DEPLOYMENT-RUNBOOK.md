# Runbook de implantação — LENOY IMOBILIÁRIAS

Este runbook descreve a implantação segura do IMOBILIÁRIAS, primeiro em homologação e somente depois em produção.

## 1. Pré-condição obrigatória

Use um projeto Supabase exclusivo do IMOBILIÁRIAS. Nunca reutilize URL, project ref, chaves, storage, usuários administrativos ou secrets de outro projeto.

Antes de qualquer migration/deploy de banco, configure e confira:

- `IMOBILIARIAS_SUPABASE_PROJECT_REF`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`

Execute `pnpm supabase:guard`. O guard deve bloquear qualquer divergência de project ref.

## 2. Validação única de release

Antes de implantar, execute:

`pnpm release:validate`

Esse comando valida contrato de ambiente, kit de homologação, segurança das migrations, guards das Edge Functions, typecheck web, build web e typecheck mobile.

O CI do `main` executa o mesmo caminho de validação. Não considerar um commit homologável sem validação concluída com sucesso no ambiente de implantação ou em CI observável.

## 3. Identificação obrigatória do build

O deploy web deve receber:

- `NEXT_PUBLIC_COMMIT_SHA=<sha do commit implantado>` ou usar o fallback seguro `VERCEL_GIT_COMMIT_SHA` na Vercel;
- `NEXT_PUBLIC_BUILD_LABEL=<rótulo humano da release>`.

O endpoint `/api/health` expõe esses valores. O smoke pós-deploy pode receber `EXPECTED_COMMIT_SHA` e falhar se o host estiver servindo outro commit.

## 4. Banco de dados

1. Aplicar todas as migrations do repositório em ordem, atualmente até `0134_drop_duplicate_leads_broker_status_index.sql`.
2. Executar `select public.project_identity();` e confirmar retorno `IMOBILIARIAS`.
3. Confirmar `environment_mode=homologation`.
4. Manter novos cadastros, cobrança real, mensageria externa, IA e push desligados durante a primeira homologação.
5. Confirmar os painéis de pré-voo, auditoria multi-tenant, validações de release, checkpoints e versões implantadas.

## 5. Edge Functions

Implantar somente no projeto exclusivo do IMOBILIÁRIAS e apenas depois das migrations das quais dependem.

Endpoints privilegiados com `verify_jwt=false` precisam permanecer protegidos por assinatura ou secret próprio. Não publicar função privilegiada sem o secret correspondente configurado.

Meta, Resend, InfinitePay, IA e push podem permanecer sem credenciais enquanto seus gates globais estiverem OFF.

## 6. Aplicação web

Configurar pelo menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferencial) ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` para compatibilidade
- `NEXT_PUBLIC_PLATFORM_HOST=imoveis.lenoy.com.br`
- `NEXT_PUBLIC_SITE_URL=https://imoveis.lenoy.com.br`
- `NEXT_PUBLIC_ALLOW_INDEXING=false`
- `NEXT_PUBLIC_BUILD_LABEL`
- `NEXT_PUBLIC_COMMIT_SHA` quando o host não fornecer automaticamente o SHA

Publicar a aplicação Next.js com Framework Preset **Next.js** e Root Directory `apps/web`. GitHub Pages é apenas a prévia visual e não substitui o deploy real.

## 7. DNS e HTTPS

Apontar `imoveis.lenoy.com.br` para o host escolhido e confirmar resolução DNS, TLS válido e carregamento pelo hostname oficial.

## 8. Smoke pós-deploy

Executar com HTTPS:

`DEPLOYMENT_URL=https://SEU-HOST EXPECTED_COMMIT_SHA=<sha> pnpm smoke:deploy`

O smoke valida home, login, cadastro, imóvel, admin, `/api/health`, identidade do Supabase, status saudável, commit esperado, configuração do projeto e política de indexação.

Somente um deploy com smoke `passed` pode ser marcado como release ativa em produção.

## 9. Registro da release

No painel **Versões implantadas**:

1. registrar ambiente, commit SHA, label e URL;
2. registrar resultado do smoke;
3. marcar candidato a rollback somente se a versão já tiver sido validada;
4. marcar como ativa somente uma release com smoke aprovado.

Não excluir releases históricas.

## 10. Manutenção automática

Configurar `platform-maintenance` com `PLATFORM_MAINTENANCE_SECRET` e um agendador seguro. Nunca gravar o secret no repositório ou em SQL em texto aberto.

Confirmar pelo menos uma execução `success=true` nas últimas 24 horas antes da promoção para produção. Se `pg_cron`/`pg_net` não estiverem habilitados, manter o checkpoint como pendente até existir outro agendador seguro e comprovado.

## 11. Teste multi-imobiliária

Criar duas imobiliárias e duas contas independentes. Executar `supabase/tests/tenant-isolation-regression.sql` e validar que leitura, INSERT, UPDATE, DELETE, fotos e contexto do corretor não atravessam tenants.

Registrar as evidências em `platform_release_validations`.

## 12. Testes funcionais mínimos

Validar login/recuperação, CRUD de imóvel, fotos/capa/ordem, catálogo, leads/CRM, permissões, documentos, app/offline quando aplicável, DNS/HTTPS, cron, backup e recuperação.

## 13. Checkpoints e pré-voo

Antes de produção, revisar:

- Pré-voo V4 e deployment gate;
- auditoria de isolamento;
- checklist real de homologação;
- checkpoints de implantação e histórico;
- saúde da plataforma;
- release registrada e smoke aprovado;
- backup e rollback documentados.

## 14. Promoção para produção

A proteção no banco deve recusar a promoção se faltarem requisitos obrigatórios. As migrations de hardening posteriores a `0129` continuam obrigatórias e devem permanecer aplicadas.

Somente depois da promoção validada habilite integrações comerciais deliberadamente, uma por vez. `NEXT_PUBLIC_ALLOW_INDEXING=true` só deve ser ligado no lançamento público intencional.

## 15. Pós-deploy

Executar integralmente `docs/POST-DEPLOY-CHECKLIST.md` e registrar o resultado. Se saúde, smoke, tenant isolation ou provider health falharem, não avançar: usar o plano de rollback documentado em `docs/ROLLBACK-PLAN.md`.
