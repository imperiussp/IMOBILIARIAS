# Pós-deploy — verificação rápida do LENOY IMOBILIÁRIAS

Execute após cada publicação em homologação e antes de marcar qualquer checkpoint como concluído.

## 1. Identidade e domínio

- abrir `https://imoveis.lenoy.com.br`;
- confirmar HTTPS válido;
- confirmar marca LENOY IMOBILIÁRIAS;
- confirmar que não há redirecionamento para outro projeto/domínio.

## 2. Health check

Abrir `/api/health` e exigir:

- HTTP 200;
- `service = LENOY IMOBILIÁRIAS`;
- `status = ok`;
- `identity = IMOBILIARIAS`;
- `supabase_configured = true`;
- `project_identity = true`;
- `project_ref_matches = true`;
- em homologação, `indexing_enabled = false`.

Nunca considerar o ambiente saudável se o health responder `503`.

## 3. Smoke automatizado

No repositório configurado para o ambiente:

```bash
DEPLOYMENT_URL=https://imoveis.lenoy.com.br EXPECT_INDEXING=false pnpm smoke:deploy
```

O comando valida home, login, health e robots.

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
- SEO continua OFF.

## 6. Operação

- executar `platform-maintenance`;
- confirmar `success=true`;
- revisar fila de provedores;
- revisar Saúde da plataforma;
- revisar Saúde técnica do deploy;
- confirmar backup/recovery antes de qualquer mudança de produção.

## 7. Registro da release

Em **Versões implantadas**, registrar:

- commit SHA implantado;
- ambiente `homologation`;
- URL implantada;
- identificação da release;
- resultado do smoke test;
- observações relevantes.

Marcar a versão ativa somente depois de confirmar que é realmente a publicação corrente.

## 8. Rollback

Antes da produção, confirmar que existe uma versão anterior conhecida e validada. O procedimento detalhado está em `docs/ROLLBACK-PLAN.md`.

## 9. Produção

A promoção só deve ser tentada quando:

- Pré-voo sem bloqueios obrigatórios;
- auditoria multi-tenant sem falhas críticas;
- checklist funcional obrigatório concluído;
- checkpoints de produção concluídos;
- manutenção recente com sucesso;
- release ativa de homologação com smoke `passed`;
- rollback documentado;
- nenhuma fila técnica crítica atrasada.

O banco continuará recusando a promoção se os requisitos programáticos não estiverem satisfeitos.
