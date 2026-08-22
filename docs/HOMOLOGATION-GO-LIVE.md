# Homologação e colocação na rede — LENOY IMOBILIÁRIAS

Este documento descreve como colocar o IMOBILIARIAS na rede para testes sem transformar o ambiente em lançamento comercial por acidente.

## Regra principal

Use somente um projeto Supabase exclusivo do IMOBILIARIAS. Não reutilize URL, chaves, banco, storage, usuários administrativos ou secrets de Moto Connect, Lê+, LENOY Match, RM Agenda ou qualquer outro sistema.

## Estado seguro padrão

A migration `0109_platform_release_controls.sql` cria o ambiente inicialmente em `homologation` com:

- catálogo público: ligado;
- novos cadastros de imobiliárias: desligados;
- cobrança real: desligada;
- mensageria externa: desligada;
- IA real: desligada;
- modo manutenção: desligado.

A migration `0114_production_promotion_guard_and_push_gate.sql` acrescenta notificações push desligadas por padrão, registro da promoção e trava inicial para produção.

Esse estado permite testar painel, tenants, catálogo, imóveis, corretores, CRM, documentos e navegação sem gerar cobrança, mensagens automáticas, push ou consumo de IA externa.

## Freios implementados

### Regra central e modo manutenção

A migration `0116_runtime_action_gate.sql` cria `platform_runtime_action_allowed(action)`. `maintenance_mode=true` prevalece sobre todas as flags individuais e bloqueia catálogo, novos cadastros, cobrança, WhatsApp/e-mail externo, IA e push. Assim, modo manutenção funciona como kill switch operacional real.

### Cadastro

As RPCs públicas expõem somente o estado mínimo necessário. O formulário consulta esse status ao abrir e novamente antes de `signUp`. A migration `0113_registration_gate_database_enforcement.sql` também protege o trigger de onboarding no banco. Um `agency_owner` não cria tenant por chamada direta ao Auth quando novos cadastros estão bloqueados. Convites de equipe permanecem separados.

### Catálogo público

O status público de catálogo permite pausar vitrines de tenants sem apagar imóveis ou bloquear o painel administrativo. A partir da `0116`, modo manutenção também força catálogo OFF em runtime.

### Cobrança

`create-infinitepay-checkout` usa a regra central `billing` e não cria checkout real quando cobrança está bloqueada ou sistema está em manutenção.

### Mensageria

`process-buyer-opportunities` e `deliver-buyer-outreach` possuem proteção de release. O adaptador final mantém proteção própria para impedir chamada direta de contornar o orquestrador.

### Inteligência artificial

`process-buyer-opportunities`, `generate-property-description` e `generate-buyer-opportunity-message` recusam chamadas reais a provedores quando IA não está liberada. Em manutenção, ações externas permanecem bloqueadas.

### Push do aplicativo

`push-broker-notifications` exige `PUSH_DISPATCH_SECRET`, consulta a ação central `push`, não envia quando bloqueado/manutenção, desativa tokens inválidos e diferencia entregas completas e parciais. A migration `0117_push_operational_health.sql` cria métricas globais de dispositivos ativos, fila pendente, atrasos, tentativas esgotadas e último envio.

## Segurança multi-imobiliária

A migration `0118_platform_tenant_security_audit.sql` cria `platform_tenant_security_audit()`. A migration `0123_tenant_security_audit_inherited_scope.sql` refina essa auditoria para entender dois modelos válidos de escopo:

- **escopo direto:** tabela possui `agency_id` e policies/RLS próprias;
- **escopo herdado:** tabela herda o tenant por relacionamento explicitamente protegido, como `property_photos → properties.agency_id`.

No caso herdado, a auditoria continua exigindo RLS e identifica policy que passe por `properties`; portanto, a ausência de `agency_id` redundante não vira falso positivo, mas também não deixa a tabela sem validação de tenant.

A auditoria é restrita ao super-admin e aparece em **Auditoria de isolamento entre clientes**. Ela não substitui o teste funcional. `supabase/tests/tenant-isolation-regression.sql` documenta o cenário obrigatório com duas imobiliárias e duas contas para provar que leitura, INSERT, UPDATE e DELETE não atravessam tenants.

## Evidências persistentes de homologação

A migration `0120_release_validation_evidence.sql` cria `platform_release_validations`. A administração global guarda, com data e usuário, se testes importantes foram realmente executados. Entre os obrigatórios para produção estão login/sessão/recuperação, teste funcional entre tenants, CRUD de imóvel, fotos, CRM, permissões, DNS/HTTPS, cron e backup/recuperação.

Sincronização offline, cobrança controlada e mensageria controlada também ficam registradas e podem ser exigidas conforme o escopo do lançamento. Marcar uma validação concluída significa que o teste foi realmente executado no ambiente correto.

## Promoção protegida para produção

As migrations `0114`, `0119` e `0121` endurecem progressivamente `guard_platform_production_promotion()`.

A mudança para `production` é recusada se faltar:

- modo manutenção desligado;
- catálogo público ligado;
- identificação de release;
- observações suficientes da release;
- manutenção **bem-sucedida** nas últimas 24 horas;
- fila sem evento de provedor crítico atrasado há mais de 30 minutos;
- zero falhas críticas na auditoria multi-imobiliária;
- zero testes `required_for_production` pendentes.

A promoção registra `production_activated_at` e `production_activated_by`. A proteção real está no banco e não depende da interface.

## Diagnóstico pré-voo v3

A migration `0122_release_readiness_security_evidence.sql` substitui o Pré-voo v2 e mantém:

- `platform_homologation_readiness`;
- `platform_release_readiness_summary`.

O Pré-voo v3 agrega no mesmo semáforo:

- identificação/documentação da release;
- coerência dos freios externos;
- catálogo;
- modo manutenção;
- execução recente da manutenção;
- **manutenção bem-sucedida nas últimas 24 horas**;
- fila técnica dos provedores;
- **auditoria estrutural multi-tenant**;
- **evidências obrigatórias de homologação**;
- falhas financeiras;
- domínios pendentes;
- registro da promoção para produção.

O diagnóstico não executa deploy, não aplica migrations e não ativa serviços.

## Manutenção automática

`platform-maintenance` é consciente do estado de release e falha fechada: exige service role e secret de manutenção, trata configuração faltante de tarefa habilitada como falha, respeita gates e não registra execução incompleta como sucesso. Para produção, uma execução com `success=true` deve existir nas últimas 24 horas.

## Validações estáticas no CI

O workflow executa:

- detecção de numeração duplicada de migration;
- `migration:safety`, procurando `SECURITY DEFINER` sem `SET search_path`, comandos destrutivos de alto risco e tabelas tenant novas sem RLS encontrado;
- `edge:guards`, verificando 13 endpoints privilegiados `verify_jwt=false` e rejeitando padrões de segredo opcional/fail-open;
- typecheck e build web;
- typecheck mobile.

As verificações estáticas reduzem regressões, mas não substituem o teste em Supabase limpo de homologação.

## Ordem recomendada para primeira homologação online

1. Criar e confirmar um Supabase exclusivo para IMOBILIARIAS.
2. Aplicar todas as migrations em ordem, **até `0123` inclusive**.
3. Confirmar `environment_mode=homologation`.
4. Confirmar cobrança, mensageria, IA, push e novos cadastros bloqueados.
5. Configurar URL/anon key no web e app e service role somente no backend.
6. Configurar secrets das tarefas efetivamente testadas.
7. Fazer deploy das Edge Functions.
8. Publicar o web mantendo `NEXT_PUBLIC_ALLOW_INDEXING=false`.
9. Configurar DNS/TLS.
10. Criar duas imobiliárias e usuários de teste independentes.
11. Executar o teste funcional de isolamento entre tenants.
12. Testar login/recuperação, permissões, imóveis, fotos, catálogo, lead, CRM, documentos e fluxo offline.
13. Ativar cron e exigir manutenção com `success=true`.
14. Validar backup e recuperação.
15. Registrar evidências no painel **Checklist real de homologação**.
16. Rever **Pré-voo v3**, **Auditoria de isolamento**, **Checklist real de homologação** e **Saúde da plataforma**.
17. Testar individualmente integrações externas, uma por vez, somente com dados/destinatários controlados.
18. Voltar gates externos para OFF se o lançamento ainda não ocorrer.

## Antes do lançamento comercial

1. Manter homologação enquanto os testes são executados.
2. Registrar identificação e notas completas da release.
3. Repetir teste entre duas imobiliárias.
4. Confirmar zero falhas críticas na auditoria estrutural.
5. Confirmar todos os itens obrigatórios validados.
6. Executar manutenção e confirmar `success=true` recente.
7. Confirmar fila de provedores saudável.
8. Conferir Pré-voo v3 sem bloqueio obrigatório.
9. Tentar a promoção para `production`; o banco recusará se faltar requisito.
10. Liberar cada integração comercial deliberadamente conforme necessidade.
11. Habilitar `NEXT_PUBLIC_ALLOW_INDEXING=true` somente no lançamento público deliberado.

## O que este repositório não faz sozinho

Ter o código pronto não significa que o ambiente esteja implantado. Continuam sendo ações externas deliberadas: criar Supabase, aplicar migrations, configurar secrets, fazer deploy das funções/web, apontar DNS, configurar provedores, validar backup e executar testes reais.
