# Checklist de ativação do IMOBILIÁRIAS

Este documento impede mistura com outros sistemas e reduz o risco de transformar homologação em lançamento por acidente.

## Regra principal

Use exclusivamente um projeto Supabase criado para o **IMOBILIÁRIAS**. Nunca reutilize URL, chave, banco, bucket, usuário administrativo ou secret de Moto Connect, LENOY, Lê+ ou outro projeto.

## Preparação do ambiente

- [ ] Supabase exclusivo criado e identificado como `IMOBILIÁRIAS`.
- [ ] `IMOBILIARIAS_SUPABASE_PROJECT_REF` e `SUPABASE_PROJECT_REF` configurados e iguais.
- [ ] `pnpm supabase:guard` aprovado.
- [ ] Todas as migrations aplicadas em ordem até `0129_production_requires_smoke_validated_release.sql`.
- [ ] `project_identity()` retorna `IMOBILIARIAS`.
- [ ] `environment_mode=homologation`.
- [ ] Novos cadastros, cobrança real, mensageria externa, IA e push desligados.
- [ ] `NEXT_PUBLIC_ALLOW_INDEXING=false`.

## Validação do código

- [ ] `pnpm release:validate` aprovado.
- [ ] Typecheck web aprovado.
- [ ] Build web aprovado.
- [ ] Typecheck mobile aprovado.
- [ ] Migration safety aprovada.
- [ ] Edge guards aprovados.
- [ ] Kit de homologação íntegro, incluindo `POST-DEPLOY-CHECKLIST.md` e migration `0123`.

## Proteções de release implementadas

- [x] `0109` — controles globais de release.
- [x] `0113` — bloqueio de onboarding direto no banco.
- [x] `0114` — gate de push e proteção inicial de produção.
- [x] `0116` — autoridade central de runtime/maintenance kill switch.
- [x] `0118` — auditoria estrutural multi-tenant.
- [x] `0119` — requisitos de segurança para produção.
- [x] `0120` — evidências persistentes de homologação.
- [x] `0121` — produção exige evidências obrigatórias.
- [x] `0122` — readiness v3.
- [x] `0123` — auditoria de escopo tenant herdado.
- [x] `0124` — checkpoints de implantação.
- [x] `0125` — deployment readiness integrado ao gate.
- [x] `0126` — histórico de checkpoints.
- [x] `0127` — rollback e smoke checks.
- [x] `0128` — registro auditável de releases implantadas.
- [x] `0129` — produção exige release ativa com smoke aprovado.

## Deploy web

- [ ] `NEXT_PUBLIC_COMMIT_SHA` definido com o SHA implantado.
- [ ] `NEXT_PUBLIC_BUILD_LABEL` definido com o rótulo da release.
- [ ] Web publicado em host real de Next.js, não apenas GitHub Pages.
- [ ] `imoveis.lenoy.com.br` apontado para o host correto.
- [ ] HTTPS/TLS válido.
- [ ] `/api/health` retorna identidade `IMOBILIARIAS`, status saudável, commit e build label esperados.

## Smoke pós-deploy

Executar:

`DEPLOYMENT_URL=https://SEU-HOST EXPECTED_COMMIT_SHA=<sha> pnpm smoke:deploy`

- [ ] Home reconhecida.
- [ ] Login reconhecido.
- [ ] Health saudável.
- [ ] Project identity correta.
- [ ] Commit servido é exatamente o esperado.
- [ ] Robots/indexação coerentes com o ambiente.

## Registro da release

- [ ] Commit, label, ambiente e URL registrados em **Versões implantadas**.
- [ ] Smoke registrado como `passed` somente depois do teste real.
- [ ] Release ativa somente depois de smoke aprovado.
- [ ] Candidato a rollback somente se já validado anteriormente.
- [ ] Histórico preservado, sem exclusão.

## Teste multi-imobiliária obrigatório

Criar duas imobiliárias e duas contas independentes.

- [ ] Usuário A não lê dados privados da imobiliária B.
- [ ] Usuário B não lê dados privados da imobiliária A.
- [ ] INSERT com tenant indevido é recusado.
- [ ] UPDATE com tenant indevido é recusado.
- [ ] DELETE com tenant indevido é recusado.
- [ ] Fotos/storage respeitam o tenant.
- [ ] Corretor com múltiplas imobiliárias não mistura contexto.
- [ ] `supabase/tests/tenant-isolation-regression.sql` executado em ambiente controlado.

## Testes funcionais obrigatórios

- [ ] Login, sessão e recuperação de acesso.
- [ ] CRUD de imóvel.
- [ ] Upload, capa e ordenação de fotos.
- [ ] Catálogo público.
- [ ] Lead e CRM.
- [ ] Permissões de corretor e administração.
- [ ] Documentos.
- [ ] App e fila offline, quando incluídos no escopo de lançamento.
- [ ] DNS e HTTPS.
- [ ] Cron/manutenção automática.
- [ ] Backup e recuperação.

## Manutenção e saúde

- [ ] `PLATFORM_MAINTENANCE_SECRET` configurado.
- [ ] Cron seguro apontando para `platform-maintenance`.
- [ ] Pelo menos uma execução `success=true` nas últimas 24h.
- [ ] Nenhum evento crítico de provedor atrasado.
- [ ] Saúde de push/provedores sem falha crítica.

## Integrações externas

Ativar uma por vez, sempre com dados controlados antes da produção:

- [ ] InfinitePay.
- [ ] Meta/WhatsApp.
- [ ] Resend.
- [ ] IA.
- [ ] Push.

Depois de cada teste, manter o gate OFF se o lançamento comercial ainda não ocorrer.

## Pré-voo e evidências

- [ ] Pré-voo V4 sem bloqueio obrigatório.
- [ ] Auditoria de isolamento sem falha crítica.
- [ ] Checklist real de homologação completo.
- [ ] Checkpoints de implantação completos.
- [ ] Histórico de checkpoints consistente.
- [ ] Release ativa e smoke aprovado.
- [ ] Backup e rollback disponíveis.

## Promoção para produção

A mudança para `production` deve ser recusada pelo banco se faltar requisito obrigatório. Desde `0129`, produção também exige release ativa com smoke aprovado.

- [ ] Promoção executada sem burlar gates.
- [ ] Integrações comerciais liberadas deliberadamente, uma por vez.
- [ ] `NEXT_PUBLIC_ALLOW_INDEXING=true` habilitado somente no lançamento público intencional.
- [ ] `docs/POST-DEPLOY-CHECKLIST.md` executado integralmente.

## Preview visual

`https://imperiussp.github.io/IMOBILIARIAS/`

O GitHub Pages é somente preview visual/documental e não substitui o deploy real da aplicação Next.js.
