# Checklist de ativação do IMOBILIÁRIAS

Este documento impede mistura com outros sistemas e reduz o risco de transformar homologação em lançamento por acidente.

## Regra principal

Use exclusivamente um projeto Supabase criado para o **IMOBILIÁRIAS**. Nunca reutilize URL, chave, banco, bucket, usuário administrativo ou secret de Moto Connect, LENOY, Lê+ ou outro projeto.

## Preparação do ambiente

- [x] Supabase exclusivo criado e identificado como `IMOBILIÁRIAS`.
- [x] Project ref real confirmado como `rvjsonspplqelktzwusu` e coerente com a URL do projeto.
- [x] Identidade do backend validada em homologação.
- [x] Todas as migrations aplicadas/alinhadas até `0155_fix_property_storage_insert_policy_alias.sql`.
- [x] `project_identity()` retorna `IMOBILIARIAS`.
- [x] `environment_mode=homologation`.
- [x] Novos cadastros comerciais, cobrança real, mensageria externa, IA e push permanecem desligados pelos gates de homologação.
- [ ] Confirmar `NEXT_PUBLIC_ALLOW_INDEXING=false` no build final servido.

## Validação do código

- [ ] `pnpm release:validate` aprovado no commit final candidato à homologação.
- [ ] Typecheck web aprovado no commit final candidato.
- [ ] Build web aprovado no commit final candidato.
- [ ] Typecheck mobile aprovado no commit final candidato.
- [x] Migration safety incorporada ao projeto.
- [x] Edge guards incorporados ao projeto.
- [x] Kit de homologação e migrations de hardening preservados no repositório até `0155`.

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
- [x] `0130–0133` — hardening final de RPC/permissões/storage.
- [x] `0134` — remoção conservadora de índice duplicado.
- [x] `0139` — isolamento de leitura de imóveis publicados por tenant.
- [x] `0140` — isolamento de leitura de assets/fotos de imóveis por tenant.
- [x] `0141–0149` — otimizações/consolidação de RLS e índices, encerrando `auth_rls_initplan` e policies permissivas duplicadas.
- [x] `0150` — hardening do RPC de capa e índices selecionados.
- [x] `0151` — complementação conservadora de índices operacionais.
- [x] `0152` — consistência de verificação de domínio da plataforma.
- [x] `0153` — entitlements fail-closed quando plano não é válido.
- [x] `0154` — seed dos tipos globais padrão de imóvel.
- [x] `0155` — correção da policy de INSERT no Storage de fotos de imóveis.
- [x] Agendador nativo seguro de manutenção configurado sem secret exposto em código aberto.

### Estado de segurança conhecido

- [x] Nenhum aviso `auth_rls_initplan` remanescente no estado auditado.
- [x] Nenhum aviso `multiple_permissive_policies` remanescente no estado auditado.
- [ ] Avisos restantes de FK/`SECURITY DEFINER` devem continuar sendo tratados por risco e uso real, nunca por remoção indiscriminada.
- [ ] **Leaked Password Protection** do Supabase Auth precisa ser habilitado antes do go-live comercial.

## Deploy web

- [ ] Build final identifica inequivocamente o SHA implantado e o build label.
- [x] Web publicada em host real de aplicação.
- [x] `imoveis.lenoy.com.br` apontado para o host de homologação.
- [x] HTTPS/TLS válido e certificado emitido.
- [x] Acesso ao domínio confirmado em navegador normal, anônimo e outro navegador.
- [ ] `/api/health` precisa ser validado no smoke final contra o commit/build candidato.

## Smoke pós-deploy

Executar no candidato final:

`DEPLOYMENT_URL=https://imoveis.lenoy.com.br EXPECTED_COMMIT_SHA=<sha> pnpm smoke:deploy`

- [ ] Home reconhecida.
- [ ] Login reconhecido.
- [ ] Cadastro/gate coerente com homologação.
- [ ] Imóvel reconhecido.
- [ ] Admin reconhecido.
- [ ] Health saudável.
- [ ] Project identity correta.
- [ ] Commit servido é exatamente o esperado.
- [ ] Robots/indexação coerentes com homologação.

## Testes funcionais

- [ ] Login, sessão e recuperação de acesso — **código revisado; falta teste real por e-mail no domínio**.
- [x] Criação de imóvel exercitada no painel real.
- [x] Upload de foto/Storage exercitado no painel real após `0155`.
- [x] Tipos globais de imóvel carregando no formulário após `0154`.
- [x] Catálogo/site público acessível no domínio de homologação.
- [ ] Edição/exclusão e ciclo completo de CRUD em uma rodada consolidada.
- [ ] Lead/CRM em uma rodada consolidada.
- [ ] Permissões de corretor/admin em uma rodada consolidada.
- [ ] Documentos em uma rodada consolidada.
- [ ] App/fila offline em uma rodada consolidada, se incluídos neste lançamento.
- [x] DNS e HTTPS.
- [x] Cron/manutenção automática com execução de sucesso observada.
- [x] Backup operacional executado com sucesso e evidência em `docs/BACKUP-STATUS.md`.
- [ ] Procedimento de restauração precisa ser exercitado em ambiente controlado antes de produção comercial.

## Teste multi-imobiliária obrigatório

Executar em ambiente controlado com duas imobiliárias e duas contas independentes.

- [ ] Usuário A não lê dados privados da imobiliária B.
- [ ] Usuário B não lê dados privados da imobiliária A.
- [ ] INSERT com tenant indevido é recusado.
- [ ] UPDATE com tenant indevido é recusado.
- [ ] DELETE com tenant indevido é recusado.
- [ ] Fotos/Storage respeitam o tenant.
- [ ] Corretor com múltiplas imobiliárias não mistura contexto.
- [ ] `supabase/tests/tenant-isolation-regression.sql` somente em ambiente descartável/controlado, nunca sobre dados reais de homologação.

## Backup e recuperação

- [x] Workflow de backup operacional existe no GitHub Actions.
- [x] Exportação lógica de dados concluída com sucesso.
- [x] Objetos do Storage incluídos no backup.
- [x] Migrations/schema preservados no artefato.
- [x] Artefato de retenção gerado pelo GitHub Actions.
- [x] Evidência automática registrada em `docs/BACKUP-STATUS.md`.
- [ ] Restore testado em ambiente controlado antes da produção comercial.

## Registro da release

- [ ] Commit, label, ambiente e URL registrados em **Versões implantadas**.
- [ ] Smoke registrado como `passed` somente depois do teste real.
- [ ] Release ativa somente depois de smoke aprovado e demais evidências críticas.
- [ ] Candidato a rollback somente se já validado anteriormente.
- [ ] Histórico preservado, sem exclusão.

## Integrações externas

Ativar uma por vez, somente depois da homologação principal:

- [ ] InfinitePay.
- [ ] Meta/WhatsApp.
- [ ] Resend.
- [ ] IA.
- [ ] Push.

Enquanto não houver lançamento comercial, manter os gates OFF.

## Promoção para produção

A mudança para `production` deve continuar sendo recusada pelos gates se faltar requisito obrigatório.

- [ ] Autenticação ponta a ponta aprovada.
- [ ] Isolamento multi-tenant funcional aprovado.
- [ ] Smoke final aprovado contra o SHA implantado.
- [ ] Leaked Password Protection habilitado.
- [ ] Restore testado em ambiente controlado.
- [ ] Release de homologação registrada e validada.
- [ ] Promoção executada sem burlar gates.
- [ ] Integrações comerciais liberadas deliberadamente, uma por vez.
- [ ] Indexação pública habilitada somente no lançamento público intencional.

## Preview visual

`https://imperiussp.github.io/IMOBILIARIAS/`

O GitHub Pages é apenas referência/preview e não substitui a aplicação real servida em `imoveis.lenoy.com.br`.
