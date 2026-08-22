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

`process-buyer-opportunities`, `generate-property-description` e `generate-buyer-opportunity-message` recusam chamadas reais a provedores quando IA não está liberada. Em manutenção, ações externas devem permanecer bloqueadas.

### Push do aplicativo

`push-broker-notifications` exige obrigatoriamente `PUSH_DISPATCH_SECRET`. Não existe modo fail-open sem segredo.

Além disso:

- consulta a ação central `push`;
- não envia quando o push está bloqueado;
- não envia em modo manutenção;
- desativa tokens inválidos quando o provedor os rejeita;
- diferencia entregas completas e parciais.

A migration `0117_push_operational_health.sql` cria métricas globais de dispositivos ativos, fila pendente, atrasos, tentativas esgotadas e último envio.

## Promoção protegida para produção

A migration `0114_production_promotion_guard_and_push_gate.sql` adiciona um trigger no banco. A primeira mudança de qualquer ambiente para `production` é recusada se faltar algum dos requisitos mínimos:

- modo manutenção desligado;
- catálogo público ligado;
- identificação da release com pelo menos 4 caracteres;
- observações da release com pelo menos 20 caracteres;
- execução de manutenção registrada nas últimas 24 horas;
- nenhuma ocorrência de provedor não correlacionada e atrasada há mais de 30 minutos.

A promoção registra `production_activated_at` e `production_activated_by`.

O painel também mostra os requisitos antes da tentativa, mas a proteção real está no banco e não depende da interface.

## Diagnóstico pré-voo v2

A migration `0115_release_readiness_v2.sql` substitui o diagnóstico inicial e cria:

- `platform_homologation_readiness`;
- `platform_release_readiness_summary`.

O painel global mostra:

- percentual de prontidão;
- quantidade de verificações aprovadas;
- bloqueios obrigatórios;
- recomendações;
- itens opcionais;
- identificação/documentação da release;
- coerência dos freios com o ambiente;
- modo manutenção;
- manutenção recente;
- **sucesso real da última manutenção**;
- eventos de provedores atrasados;
- falhas financeiras;
- domínios personalizados pendentes;
- auditoria da promoção para produção.

Em produção, catálogo, manutenção recente, sucesso da manutenção, saúde da fila técnica e registro da promoção passam a ser critérios obrigatórios.

O diagnóstico não executa deploy, não aplica migrations e não ativa serviços.

## Manutenção automática

`platform-maintenance` agora é consciente do estado de release e falha fechada:

- exige `SUPABASE_SERVICE_ROLE_KEY`;
- exige `PLATFORM_MAINTENANCE_SECRET`;
- ausência de secret necessário para uma tarefa que realmente precisa rodar conta como falha de configuração;
- push não é chamado quando o gate de push está desligado;
- oportunidades não são processadas quando mensageria e IA estão bloqueadas;
- verificação de domínio é pulada sem erro quando não existe domínio personalizado pendente;
- uma execução incompleta por configuração ausente não é mais registrada como sucesso.

## Histórico de alterações

`platform_release_control_history` guarda alterações dos controles globais. O painel **Histórico do ambiente** mostra:

- ambiente;
- manutenção;
- catálogo;
- novos cadastros;
- cobrança;
- WhatsApp/e-mail;
- push;
- IA;
- identificação e observações da release.

A migration `0112_release_control_history_indexes.sql` mantém essa consulta eficiente conforme o histórico cresce.

## Ordem recomendada para primeira homologação online

1. Criar e confirmar um Supabase exclusivo para IMOBILIARIAS.
2. Aplicar todas as migrations em ordem, **até `0117` inclusive**.
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
13. Criar ou vincular uma imobiliária de teste administrativamente.
14. Testar login, tenant, isolamento, cadastro de corretor, imóvel, fotos, catálogo, lead, CRM, documentos e fluxo offline.
15. Ativar manutenção automática/cron e exigir uma execução sem falhas.
16. Rever **Pré-voo** e **Saúde da plataforma**.
17. Somente depois, testar individualmente IA, mensageria, push e cobrança, ligando um controle global por vez.
18. Após cada teste externo, voltar o respectivo gate para OFF se o lançamento ainda não ocorrer.

## Antes do lançamento comercial

Não mudar diretamente de homologação para tudo ligado. A sequência recomendada é:

1. manter `environment_mode=homologation`;
2. registrar identificação e notas completas da release;
3. validar IA com dados de teste;
4. validar mensageria somente com números/e-mails autorizados de teste;
5. validar push somente em dispositivos controlados de teste;
6. validar checkout com uma operação controlada;
7. validar webhooks e retornos;
8. voltar recursos externos para OFF se ainda estiver em homologação;
9. executar a manutenção e confirmar `success=true`;
10. verificar que não há eventos de provedores atrasados;
11. conferir o Pré-voo;
12. tentar a promoção para `production` — o próprio banco recusará se os critérios obrigatórios não estiverem satisfeitos;
13. em produção, liberar cada recurso comercial deliberadamente conforme necessidade;
14. habilitar `NEXT_PUBLIC_ALLOW_INDEXING=true` somente quando o lançamento público realmente ocorrer.

## O que este repositório não faz sozinho

Ter o código pronto não significa que o ambiente esteja implantado. Ainda são ações externas deliberadas: criar Supabase, aplicar migrations, configurar secrets, fazer deploy das funções/web, apontar DNS, configurar provedores e executar testes reais.
