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

A migration `0114_production_promotion_guard_and_push_gate.sql` acrescenta:

- notificações push: desligadas por padrão;
- registro de data e usuário da primeira promoção para produção;
- validação obrigatória antes da promoção para `production`.

Esse estado permite testar painel, tenants, catálogo, imóveis, corretores, CRM, documentos e navegação sem gerar cobrança, mensagens automáticas, push ou consumo de IA externa.

## Freios implementados

### Regra central e modo manutenção

A migration `0116_runtime_action_gate.sql` cria `platform_runtime_action_allowed(action)`.

Ela é a autoridade central para ações sensíveis. `maintenance_mode=true` prevalece sobre todas as flags individuais e bloqueia:

- catálogo;
- novos cadastros;
- cobrança;
- WhatsApp/e-mail externo;
- IA;
- push.

Assim, o modo manutenção funciona como um kill switch operacional real.

### Cadastro

As RPCs públicas expõem somente o estado mínimo necessário. O formulário consulta esse status ao abrir e novamente antes de `signUp`.

A migration `0113_registration_gate_database_enforcement.sql` também protege o trigger de onboarding no banco. Portanto, um `agency_owner` não cria tenant por chamada direta ao Auth quando novos cadastros estão bloqueados. Convites para membros de imobiliárias existentes continuam separados.

### Catálogo público

O status público de catálogo permite pausar todas as vitrines de tenants sem apagar imóveis ou bloquear o painel administrativo. A partir da `0116`, o modo manutenção também força o catálogo para OFF em runtime.

### Cobrança

`create-infinitepay-checkout` usa a regra central de ação `billing`. A função não cria checkout real se a cobrança estiver bloqueada ou se o sistema estiver em manutenção.

### Mensageria

`process-buyer-opportunities` e `deliver-buyer-outreach` possuem proteção de release. O adaptador final mantém proteção própria para impedir que uma chamada direta contorne o orquestrador.

### Inteligência artificial

`process-buyer-opportunities`, `generate-property-description` e `generate-buyer-opportunity-message` recusam chamadas reais a provedores quando IA não está liberada. Em manutenção, ações externas permanecem bloqueadas.

### Push do aplicativo

`push-broker-notifications` exige obrigatoriamente `PUSH_DISPATCH_SECRET`. Não existe modo fail-open sem segredo.

Além disso:

- consulta a ação central `push`;
- não envia quando o push está bloqueado;
- não envia em modo manutenção;
- desativa tokens inválidos quando o provedor os rejeita;
- diferencia entregas completas e parciais.

A migration `0117_push_operational_health.sql` cria métricas globais de dispositivos ativos, fila pendente, atrasos, tentativas esgotadas e último envio.

## Segurança multi-imobiliária

A migration `0118_platform_tenant_security_audit.sql` cria `platform_tenant_security_audit()`.

Ela verifica estruturalmente tabelas críticas do SaaS e identifica:

- tabela esperada ausente;
- ausência de `agency_id` em tabela tenant;
- RLS desligado;
- RLS ligado sem nenhuma policy;
- quantidade de policies encontradas.

A auditoria é restrita ao super-admin e aparece na administração global em **Auditoria de isolamento entre clientes**.

Ela não substitui o teste funcional. O arquivo `supabase/tests/tenant-isolation-regression.sql` documenta o cenário obrigatório com duas imobiliárias e duas contas independentes para provar que leitura, INSERT, UPDATE e DELETE não atravessam tenants.

## Evidências persistentes de homologação

A migration `0120_release_validation_evidence.sql` cria `platform_release_validations`.

A administração global passa a guardar, com data e usuário, se testes importantes foram realmente executados. Entre os itens obrigatórios para produção estão:

- login, sessão e recuperação de acesso;
- teste funcional entre duas imobiliárias;
- CRUD de imóvel;
- upload, capa, ordem e isolamento de fotos;
- fluxo de lead e CRM;
- permissões de corretor/admin;
- DNS e HTTPS;
- cron de manutenção;
- backup e procedimento de recuperação.

Outros itens, como sincronização offline, cobrança controlada e mensageria controlada, também ficam registrados e podem ser exigidos conforme o escopo do lançamento.

Marcar uma validação como concluída significa que o teste foi realmente executado no ambiente correto; a checklist não deve ser preenchida apenas para liberar produção.

## Promoção protegida para produção

As migrations `0114`, `0119` e `0121` endurecem progressivamente `guard_platform_production_promotion()`.

A mudança para `production` é recusada se faltar qualquer requisito obrigatório:

- modo manutenção desligado;
- catálogo público ligado;
- identificação da release com pelo menos 4 caracteres;
- observações da release com pelo menos 20 caracteres;
- **uma manutenção bem-sucedida** nas últimas 24 horas;
- nenhuma ocorrência de provedor não correlacionada e atrasada há mais de 30 minutos;
- nenhuma falha crítica na auditoria estrutural multi-imobiliária;
- nenhum teste marcado como obrigatório em `platform_release_validations` pendente de validação.

A promoção registra `production_activated_at` e `production_activated_by`.

O painel mostra os requisitos antes da tentativa, mas a proteção real está no banco e não depende da interface.

## Diagnóstico pré-voo

A migration `0115_release_readiness_v2.sql` cria/substitui:

- `platform_homologation_readiness`;
- `platform_release_readiness_summary`.

O painel global mostra percentual de prontidão, bloqueios obrigatórios, recomendações, documentação da release, estado dos freios, manutenção, fila de provedores, falhas financeiras, domínios e auditoria da promoção.

As migrations posteriores adicionam controles complementares que também devem ser consultados no mesmo painel global:

- `0118`: segurança estrutural entre tenants;
- `0120`: evidências persistentes de homologação;
- `0121`: obrigatoriedade das evidências na promoção para produção.

O diagnóstico não executa deploy, não aplica migrations e não ativa serviços.

## Manutenção automática

`platform-maintenance` é consciente do estado de release e falha fechada:

- exige `SUPABASE_SERVICE_ROLE_KEY`;
- exige `PLATFORM_MAINTENANCE_SECRET`;
- ausência de secret necessário para uma tarefa que realmente precisa rodar conta como falha de configuração;
- push não é chamado quando o gate de push está desligado;
- oportunidades não são processadas quando mensageria e IA estão bloqueadas;
- uma execução incompleta por configuração ausente não é registrada como sucesso.

Para promover a produção, não basta ter uma execução recente: pelo menos uma execução com `success=true` deve existir nas últimas 24 horas.

## Validações estáticas no CI

O workflow de CI executa proteções adicionais antes do build:

- numeração duplicada de migrations;
- `migration:safety`, que procura `SECURITY DEFINER` sem `SET search_path`, operações destrutivas de alto risco e novas tabelas tenant sem RLS encontrado;
- `edge:guards`, que verifica os 13 endpoints privilegiados com `verify_jwt=false` e rejeita padrões de segredo opcional/fail-open;
- typecheck e build web;
- typecheck mobile.

Essas verificações reduzem regressões, mas não substituem o teste no Supabase real de homologação.

## Histórico de alterações

`platform_release_control_history` guarda alterações dos controles globais. O painel **Histórico do ambiente** mostra ambiente, manutenção, catálogo, novos cadastros, cobrança, WhatsApp/e-mail, push, IA, identificação e observações da release.

## Ordem recomendada para primeira homologação online

1. Criar e confirmar um Supabase exclusivo para IMOBILIARIAS.
2. Aplicar todas as migrations em ordem, **até `0121` inclusive**.
3. Confirmar que o ambiente continua como `homologation`.
4. Confirmar no painel global que cobrança, mensageria externa, IA, push e novos cadastros estão bloqueados.
5. Configurar URL e anon key do Supabase no web e app.
6. Configurar `SUPABASE_SERVICE_ROLE_KEY` somente no backend/Edge Functions.
7. Configurar `PLATFORM_MAINTENANCE_SECRET` e os secrets das tarefas que realmente serão testadas.
8. Não configurar Meta, Resend, InfinitePay ou IA até chegar ao teste específico desses recursos, se não forem necessários antes.
9. Fazer deploy das Edge Functions.
10. Publicar o web no domínio escolhido.
11. Manter `NEXT_PUBLIC_ALLOW_INDEXING=false` durante homologação.
12. Configurar DNS/TLS.
13. Criar duas imobiliárias de teste controladas e usuários separados.
14. Executar o teste funcional de isolamento entre tenants.
15. Testar login, recuperação de senha, corretor/admin, imóvel, fotos, catálogo, lead, CRM, documentos e fluxo offline.
16. Ativar manutenção automática/cron e exigir uma execução com `success=true`.
17. Validar backup e procedimento de recuperação.
18. Registrar as evidências concluídas no painel **Checklist real de homologação**.
19. Rever **Pré-voo**, **Auditoria de isolamento**, **Checklist real de homologação** e **Saúde da plataforma**.
20. Somente depois, testar individualmente IA, mensageria, push e cobrança, ligando um controle global por vez.
21. Após cada teste externo, voltar o respectivo gate para OFF se o lançamento ainda não ocorrer.

## Antes do lançamento comercial

Não mudar diretamente de homologação para tudo ligado. A sequência recomendada é:

1. manter `environment_mode=homologation`;
2. registrar identificação e notas completas da release;
3. executar novamente o teste entre duas imobiliárias;
4. confirmar zero falhas críticas na auditoria estrutural;
5. confirmar todos os itens `required_for_production` validados;
6. validar IA com dados de teste, se fizer parte do lançamento inicial;
7. validar mensageria somente com números/e-mails autorizados de teste, se fizer parte do lançamento inicial;
8. validar push somente em dispositivos controlados de teste, se fizer parte do lançamento inicial;
9. validar checkout com uma operação controlada, se fizer parte do lançamento inicial;
10. validar webhooks e retornos;
11. voltar recursos externos para OFF se ainda estiver em homologação;
12. executar a manutenção e confirmar `success=true`;
13. verificar que não há eventos de provedores atrasados;
14. conferir Pré-voo, auditoria multi-tenant e evidências;
15. tentar a promoção para `production` — o próprio banco recusará se algum requisito obrigatório estiver faltando;
16. em produção, liberar cada recurso comercial deliberadamente conforme necessidade;
17. habilitar `NEXT_PUBLIC_ALLOW_INDEXING=true` somente quando o lançamento público realmente ocorrer.

## O que este repositório não faz sozinho

Ter o código pronto não significa que o ambiente esteja implantado. Ainda são ações externas deliberadas: criar Supabase, aplicar migrations, configurar secrets, fazer deploy das funções/web, apontar DNS, configurar provedores, validar backup e executar testes reais.
