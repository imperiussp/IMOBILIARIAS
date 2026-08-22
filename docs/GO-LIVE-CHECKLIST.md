# Checklist de ativação do IMOBILIARIAS

Este documento existe para impedir mistura com qualquer outro sistema e reduzir o risco de transformar homologação em lançamento por acidente.

## Regra principal

Use exclusivamente um projeto Supabase criado para o **IMOBILIARIAS**. Nunca reutilize URL, chave, banco, bucket, usuário administrativo ou secret de Moto Connect, LENOY, Lê+ ou outro projeto.

## Quando chegar a hora de ativar

1. Criar um novo projeto Supabase identificável como `IMOBILIARIAS`.
2. Conferir nome e project ref antes de copiar qualquer chave.
3. Aplicar **todas** as migrations deste repositório em ordem, atualmente até `0122`.
4. Confirmar que `platform_release_controls` permanece em `homologation`.
5. Confirmar OFF: novos cadastros, cobrança real, mensageria externa, IA real e push.
6. Manter `NEXT_PUBLIC_ALLOW_INDEXING=false` durante homologação.
7. Configurar somente chaves/secrets pertencentes ao Supabase exclusivo do IMOBILIARIAS.
8. Fazer deploy das Edge Functions somente depois das migrations das quais dependem.
9. Criar duas imobiliárias de teste e duas contas independentes.
10. Executar os testes funcionais antes de qualquer promoção para produção.

## Controles globais e segurança de lançamento

O estado seguro de homologação é:

- `environment_mode = homologation`;
- `maintenance_mode = false`;
- `public_catalog_enabled = true` ou false conforme a vitrine desejada;
- `new_registrations_enabled = false`;
- `real_billing_enabled = false`;
- `external_messaging_enabled = false`;
- `ai_generation_enabled = false`;
- `push_notifications_enabled = false`.

Proteções implementadas:

- [x] `0109` — freios globais de release.
- [x] `0110` — pré-voo inicial.
- [x] `0111` — gates públicos estreitos para cadastro e catálogo.
- [x] `0112` — índices do histórico de release.
- [x] `0113` — bloqueio no banco contra criação direta de novo tenant durante homologação.
- [x] `0114` — gate de push e primeira trava de promoção para produção.
- [x] `0115` — pré-voo v2.
- [x] `0116` — autoridade central de runtime; modo manutenção prevalece sobre todos os recursos externos.
- [x] `0117` — saúde operacional do push.
- [x] `0118` — auditoria estrutural de isolamento multi-imobiliária.
- [x] `0119` — produção exige manutenção bem-sucedida recente e zero falhas críticas de isolamento.
- [x] `0120` — checklist persistente de evidências de homologação.
- [x] `0121` — produção exige todas as evidências obrigatórias validadas.
- [x] `0122` — pré-voo v3 incorpora isolamento multi-tenant e evidências obrigatórias.

## Antes de colocar na rede em homologação

- [ ] Confirmar no painel **Controle de homologação e lançamento** que recursos sensíveis estão OFF.
- [ ] Confirmar que o **Pré-voo v3** não mostra bloqueio estrutural obrigatório.
- [ ] Confirmar que **Auditoria de isolamento entre clientes** não mostra falha crítica.
- [ ] Abrir `/cadastro/` e confirmar que nova imobiliária continua bloqueada.
- [ ] Confirmar que convite de equipe continua funcionando sem criar tenant novo indevido.
- [ ] Confirmar que chamada direta de `agency_owner` é recusada pelo trigger quando cadastro está OFF.
- [ ] Confirmar `robots.txt` bloqueando indexação e sitemap vazio durante homologação.
- [ ] Confirmar que checkout não cria cobrança com billing OFF.
- [ ] Confirmar IA sem chamada externa com IA OFF.
- [ ] Confirmar Meta/Resend sem envio com mensageria OFF.
- [ ] Confirmar push sem envio com push OFF.

## Testes obrigatórios registrados no painel

A migration `0120` cria a checklist persistente **Checklist real de homologação**. Antes da produção, validar de verdade:

- [ ] Login, sessão e recuperação de acesso.
- [ ] Teste funcional entre duas imobiliárias.
- [ ] Cadastro/edição/publicação de imóvel.
- [ ] Upload, capa, ordem e isolamento de fotos.
- [ ] Entrada de lead e fluxo no CRM.
- [ ] Permissões de corretor e administração.
- [ ] DNS e HTTPS.
- [ ] Cron/manutenção automática.
- [ ] Backup e procedimento de recuperação.

Recomendados conforme o escopo inicial:

- [ ] Sincronização offline do aplicativo.
- [ ] Checkout/webhook financeiro controlado.
- [ ] WhatsApp/e-mail somente com destinatários autorizados de teste.

## Teste multi-imobiliária obrigatório

Usar duas imobiliárias e contas independentes. Confirmar:

- [ ] Usuário A não lê imóveis, leads, documentos, visitas, notificações ou oportunidades da imobiliária B.
- [ ] Usuário B não lê dados da imobiliária A.
- [ ] INSERT com `agency_id` de outro tenant é recusado.
- [ ] UPDATE de registro de outro tenant é recusado.
- [ ] DELETE de registro de outro tenant é recusado.
- [ ] Corretor que participa de duas imobiliárias troca de contexto sem misturar dados.
- [ ] Storage/fotos/documentos permanecem isolados por tenant.
- [ ] Super-admin vê dados globais apenas nas áreas explicitamente administrativas.

O arquivo `supabase/tests/tenant-isolation-regression.sql` é a base do teste de regressão em ambiente descartável/homologação.

## Segurança das Edge Functions

Endpoints com `verify_jwt=false` continuam obrigatoriamente protegidos por assinatura ou secret próprio.

- [x] Push exige `PUSH_DISPATCH_SECRET` e não possui fallback sem segredo.
- [x] Meta valida assinatura HMAC e token de verificação.
- [x] Resend valida assinatura do webhook.
- [x] InfinitePay exige secret próprio e confirma o pagamento no provedor antes de ativar assinatura.
- [x] Rotinas de manutenção exigem secrets específicos.
- [x] CI executa `edge:guards` para detectar regressão fail-open em 13 endpoints privilegiados.

## Segurança das migrations

CI executa `migration:safety` e verifica:

- [x] `SECURITY DEFINER` com `SET search_path`.
- [x] ausência de `DROP DATABASE`/`DROP SCHEMA` destrutivo.
- [x] alerta para `TRUNCATE TABLE`.
- [x] novas tabelas tenant com `agency_id` acompanhadas de RLS no histórico das migrations.
- [x] numeração duplicada de migration.

A checagem estática reduz regressão, mas não substitui aplicação em banco limpo de homologação e teste real de RLS.

## IA de oportunidades / mensageria

A arquitetura continua preparada para:

- consentimento e opt-out por canal;
- quiet hours;
- limites por plano;
- geração de mensagem sem inventar características;
- Meta WhatsApp Cloud API;
- Resend;
- provider message IDs;
- estados enviado/entregue/lido ou aberto/falha;
- respostas positivas e opt-out;
- follow-up para corretor;
- retenção e reconciliação de webhooks precoces;
- recuperação conservadora de `sending` travado sem reenvio automático;
- histórico append-only de eventos técnicos;
- monitor de canal/provedor.

Antes de ativar em produção:

- [ ] Configurar credenciais reais apenas no Supabase IMOBILIARIAS.
- [ ] Registrar webhooks oficiais.
- [ ] Testar assinatura, duplicidade e idempotência.
- [ ] Testar consentimento e opt-out.
- [ ] Testar bounce/complaint/suppression no e-mail.
- [ ] Confirmar que resposta ambígua nunca atravessa tenant.
- [ ] Confirmar que falha não provoca reenvio automático perigoso.

## Manutenção automática

`platform-maintenance` concentra as rotinas recorrentes e agora falha fechada.

Antes da produção:

- [ ] Configurar `PLATFORM_MAINTENANCE_SECRET`.
- [ ] Configurar somente secrets das tarefas realmente habilitadas.
- [ ] Fazer deploy das funções após migrations até `0122`.
- [ ] Criar cron seguro apontando para `platform-maintenance`.
- [ ] Confirmar `platform_maintenance_runs` registrando execuções.
- [ ] Confirmar pelo menos uma execução `success=true` nas últimas 24 horas.
- [ ] Confirmar zero eventos de provedor atrasados há mais de 30 minutos.
- [ ] Confirmar que eventos abandonados continuam auditáveis e fora da fila ativa.

## Requisitos que bloqueiam produção no banco

A mudança para `environment_mode=production` é recusada se faltar:

- [ ] modo manutenção desligado;
- [ ] catálogo público ligado;
- [ ] identificação da release;
- [ ] notas suficientes da release;
- [ ] manutenção bem-sucedida nas últimas 24 horas;
- [ ] fila de provedores sem eventos atrasados críticos;
- [ ] auditoria estrutural multi-tenant sem falhas críticas;
- [ ] todos os testes marcados `required_for_production` validados.

Não existe necessidade de confiar apenas no botão/tela: a proteção está no banco.

## Últimas verificações antes do lançamento comercial

- [ ] `NEXT_PUBLIC_ALLOW_INDEXING` continua false até a decisão deliberada de lançamento.
- [ ] Backup disponível e recuperação documentada.
- [ ] Build web aprovado.
- [ ] Typecheck web aprovado.
- [ ] Typecheck mobile aprovado.
- [ ] Migration safety aprovada.
- [ ] Edge guards aprovados.
- [ ] Teste entre dois tenants aprovado.
- [ ] Checklist persistente sem pendências obrigatórias.
- [ ] Pré-voo sem bloqueios obrigatórios.
- [ ] Saúde da plataforma sem falhas críticas.

## Publicação web de homologação

O ambiente pode ser colocado na rede antes do lançamento, desde que os freios permaneçam ativos. O procedimento detalhado está em `docs/HOMOLOGATION-GO-LIVE.md`.

Preview visual/documental atual:

`https://imperiussp.github.io/IMOBILIARIAS/`

O GitHub Pages não substitui o deploy real da aplicação Next.js. Antes de considerar o sistema publicado em qualquer host, confirmar um build efetivamente concluído com sucesso.
