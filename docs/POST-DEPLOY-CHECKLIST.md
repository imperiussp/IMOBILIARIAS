# Pós-deploy — verificação do LENOY IMOBILIÁRIAS

Execute após cada publicação em homologação e antes de marcar qualquer checkpoint como concluído.

## 1. Identidade e domínio

- abrir `https://imoveis.lenoy.com.br`;
- confirmar HTTPS válido;
- confirmar marca LENOY IMOBILIÁRIAS;
- confirmar ausência de redirecionamento para outro projeto/domínio.
- confirmar que existe apenas **um projeto Vercel ativo** ligado ao repositório `imperiussp/IMOBILIARIAS`; checks duplicados como `Vercel – imobiliarias` e `Vercel – lenoy-imobiliarias` indicam integração antiga consumindo builds em paralelo.

## 2. Health check

Abrir `/api/health` e exigir:

- HTTP 200;
- `service = LENOY IMOBILIÁRIAS`;
- `status = ok`;
- `identity = IMOBILIARIAS`;
- `environment = homologation` durante homologação;
- `supabase_configured = true`;
- `project_identity = true`;
- `project_ref_matches = true`;
- `release_controls_available = true`;
- `commit_sha` igual ao commit implantado;
- `build_label` igual ao rótulo configurado para a release;
- em homologação, `public_registration_enabled = false`;
- em homologação, `indexing_enabled = false`.

Nunca considerar o ambiente saudável se o health responder `503`, se o commit não corresponder ao esperado ou se os controles de release não puderem ser lidos.

## 3. Smoke automatizado

No repositório configurado para homologação:

```bash
DEPLOYMENT_URL=https://imoveis.lenoy.com.br \
EXPECTED_COMMIT_SHA=<sha-implantado> \
EXPECT_APP_ENVIRONMENT=homologation \
EXPECT_REGISTRATION_ENABLED=false \
EXPECT_INDEXING=false \
pnpm smoke:deploy
```

O comando valida home, login, health, identidade do Supabase, ambiente real do SaaS, gates de cadastro, commit servido e robots.

Para produção, alterar explicitamente as expectativas. Nunca reaproveitar o comando de homologação com `EXPECT_INDEXING=true` sem promoção deliberada e gates concluídos.

## 4. Testes funcionais críticos

- login e logout;
- recuperação de senha;
- painel global;
- painel de imobiliária;
- duas imobiliárias sem vazamento de dados;
- criar/editar imóvel;
- enviar/reordenar foto e definir capa;
- catálogo público;
- criação de lead;
- movimentação no CRM;
- permissões de corretor/admin;
- sincronização offline quando fizer parte do escopo testado.

## 5. Freios de homologação

Confirmar no Controle Global:

- `environment_mode = homologation`;
- cobrança real OFF;
- mensageria externa OFF;
- IA real OFF;
- push OFF;
- novos cadastros OFF, salvo teste deliberado;
- SEO/indexação OFF.

## 6. Operação

- executar `platform-maintenance`;
- confirmar `success=true`;
- revisar fila de provedores;
- revisar Saúde da plataforma;
- revisar Saúde técnica do deploy;
- confirmar backup/recovery antes de qualquer mudança para produção.

## 7. Disciplina de builds Vercel

- manter `apps/web/vercel.json` com `ignoreCommand` para não compilar mudanças que não afetam a web;
- agrupar alterações relacionadas em pacotes maiores antes de enviar ao `main`;
- evitar commits de marcador/rebuild enquanto houver limite de build ativo;
- remover projetos Vercel antigos ou duplicados conectados ao mesmo repositório;
- depois de cada pacote, aguardar um único deploy válido antes do próximo pacote de produção.

## 8. Registro da release

Em **Versões implantadas**, registrar:

- commit SHA implantado;
- build label;
- ambiente;
- URL implantada;
- resultado do smoke;
- observações relevantes.

Uma versão só pode ser marcada ativa depois de smoke `passed`. Não excluir histórico. Marcar candidato a rollback apenas se a versão já tiver sido validada.

## 9. Checkpoints

Confirmar os checkpoints de implantação e o histórico correspondente. Não marcar um item concluído antes da evidência real.

## 10. Rollback

Antes da produção, confirmar que existe uma versão anterior conhecida, com smoke aprovado e procedimento documentado em `docs/ROLLBACK-PLAN.md`.

## 11. Produção

A promoção só deve ser tentada quando:

- Pré-voo V4 sem bloqueios obrigatórios;
- auditoria multi-tenant sem falhas críticas;
- checklist funcional obrigatório concluído;
- checkpoints de produção concluídos;
- manutenção recente com sucesso;
- release ativa com smoke `passed`;
- commit do health igual ao commit esperado;
- rollback documentado;
- nenhuma fila técnica crítica atrasada;
- apenas um projeto Vercel oficial ligado ao repositório.

O banco deve continuar recusando a promoção se os requisitos programáticos não estiverem satisfeitos.
