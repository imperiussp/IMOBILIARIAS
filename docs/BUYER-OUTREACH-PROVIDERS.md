# Provedores de oportunidades para compradores

A plataforma possui uma cadeia completa para oportunidades automáticas:

1. `process-buyer-opportunities` seleciona oportunidades elegíveis.
2. O processamento valida plano, consentimento, canal, intervalo mínimo, limite mensal e horário silencioso.
3. `deliver-buyer-outreach` faz a entrega pelo canal configurado.
4. `meta-whatsapp-webhook` recebe diretamente os eventos da Meta para WhatsApp.
5. `resend-outreach-webhook` recebe eventos assinados do Resend para e-mail.
6. `ingest-inbound-email` diferencia um novo lead de uma resposta a oportunidade já enviada.
7. `buyer-outreach-webhook` permanece disponível como entrada normalizada para outros provedores.
8. `reconcile-outreach-provider-events` recupera eventos que chegaram antes de a tentativa possuir o ID do provedor.
9. `platform-maintenance` recupera envios presos, trata eventos órfãos e executa as demais rotinas operacionais.
10. O painel administrativo exibe tentativas, entregas, leituras, falhas, respostas, pedidos de visita e descadastros.

## Adaptador de entrega próprio

A Edge Function `deliver-buyer-outreach` evita a necessidade de construir um microserviço intermediário apenas para enviar mensagens.

Ela suporta atualmente:

- `whatsapp`: WhatsApp Cloud API da Meta;
- `email`: Resend.

As credenciais são exclusivamente de backend e nunca devem ser colocadas em variáveis `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`.

## Variáveis internas

### Comunicação entre as Edge Functions

```text
BUYER_OUTREACH_WEBHOOK_URL=https://SEU_PROJECT_REF.supabase.co/functions/v1/deliver-buyer-outreach
BUYER_OUTREACH_WEBHOOK_TOKEN=SEGREDO_INTERNO_FORTE
```

O mesmo `BUYER_OUTREACH_WEBHOOK_TOKEN` deve existir em `process-buyer-opportunities` e `deliver-buyer-outreach`.

### WhatsApp Cloud API

```text
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_GRAPH_API_VERSION=
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
```

A versão da Graph API fica em variável de ambiente para permitir atualização sem alteração do código.

### Resend

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=Imobiliária <imoveis@seudominio.com.br>
RESEND_WEBHOOK_SIGNING_SECRET=whsec_...
```

O domínio/remetente precisa estar autorizado no provedor antes do uso em produção. O signing secret é usado pela função `resend-outreach-webhook` para validar os eventos antes de alterar qualquer status interno.

### E-mail recebido

```text
INBOUND_EMAIL_SECRET=
```

`ingest-inbound-email` recebe um payload normalizado do provedor de e-mail de entrada e sempre resolve primeiro o endereço da imobiliária. Uma mensagem recebida só é tratada como resposta a oportunidade quando o remetente corresponde de forma inequívoca a um contato daquela mesma imobiliária com e-mail de oportunidade enviado nos últimos 30 dias. Caso contrário, entra como novo lead.

## Contrato interno de entrega

`process-buyer-opportunities` envia um `POST` autenticado para `BUYER_OUTREACH_WEBHOOK_URL` com:

```json
{
  "agency_id": "uuid",
  "lead_id": "uuid",
  "property_id": "uuid",
  "opportunity_id": "uuid",
  "attempt_id": "uuid",
  "idempotency_key": "uuid",
  "channel": "whatsapp",
  "destination": "5541999999999",
  "message": "texto preparado"
}
```

O adaptador retorna, quando disponível:

```json
{
  "ok": true,
  "attempt_id": "uuid",
  "channel": "whatsapp",
  "message_id": "id-do-provedor",
  "provider": "meta_whatsapp"
}
```

O `message_id` é armazenado pela plataforma para permitir correlação posterior de entrega e resposta.

## Webhook direto da Meta

A Edge Function `meta-whatsapp-webhook` pode ser usada diretamente como Callback URL da configuração de Webhooks do WhatsApp Cloud API:

```text
https://SEU_PROJECT_REF.supabase.co/functions/v1/meta-whatsapp-webhook
```

Ela implementa:

- verificação `GET` com `hub.mode`, `hub.verify_token` e `hub.challenge`;
- validação dos `POST` pela assinatura `X-Hub-Signature-256` usando `META_APP_SECRET`;
- atualização de `sent`, `delivered`, `read` e `failed`;
- uso do timestamp informado pela Meta para registrar o horário real de envio, entrega, leitura ou resposta quando disponível;
- associação de respostas pelo ID da mensagem original quando a Meta fornece `context.id`;
- fallback por telefone somente quando a associação dentro das tentativas recentes for inequívoca;
- classificação local conservadora de interesse, pedido de detalhes, pedido de visita, sem interesse e opt-out;
- gravação idempotente da resposta no CRM;
- revogação automática de alertas e WhatsApp quando o comprador solicita não receber novas mensagens.

O valor informado no campo **Verify token** da Meta deve ser exatamente o mesmo configurado em:

```text
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

## Webhook direto do Resend

Configure o endpoint:

```text
https://SEU_PROJECT_REF.supabase.co/functions/v1/resend-outreach-webhook
```

A função valida as assinaturas Svix com `RESEND_WEBHOOK_SIGNING_SECRET` e correlaciona o `email_id` retornado pelo provedor com `provider_message_id` da tentativa de entrega.

Eventos utilizados:

- `email.sent` → enviada;
- `email.delivered` → entregue;
- `email.opened` → lida;
- `email.failed`, `email.bounced`, `email.complained`, `email.suppressed` → falha.

Bounce, complaint e suppression também desativam novos alertas automáticos por e-mail para aquele contato até que a permissão seja revista.

## Respostas de e-mail no CRM

Quando `ingest-inbound-email` identifica que o remetente respondeu a uma oportunidade recente da mesma imobiliária, grava a mensagem em `buyer_outreach_responses` em vez de criar outro lead. A resposta passa pelo mesmo fluxo de CRM usado pelo WhatsApp: interesse, pedido de detalhes e pedido de visita podem gerar acompanhamento e notificação ao corretor; opt-out desativa os alertas de e-mail.

## Eventos que chegam antes da correlação

Meta e Resend podem enviar um webhook imediatamente após aceitar uma mensagem. Em uma condição de corrida rara, esse webhook pode chegar antes de `process-buyer-opportunities` terminar de gravar `provider_message_id` na tentativa.

Para não perder o evento, os webhooks preservam temporariamente o payload em `outreach_provider_event_inbox`. A função `reconcile-outreach-provider-events`, executada pela manutenção da plataforma, tenta correlacioná-lo novamente.

A fila possui três estados operacionais relevantes:

- **pendente**: ainda aguarda correlação;
- **processado**: foi correlacionado e aplicado à tentativa/resposta;
- **abandonado**: permaneceu sem correlação por mais de 7 dias e foi retirado da fila ativa, mas seu payload continua preservado para auditoria.

Nenhum evento abandonado é apagado automaticamente. A migration `0106_outreach_provider_event_retention.sql` adiciona essa retenção segura.

## Recuperação de envios presos

Tentativas que permanecem no status `sending` por mais de 20 minutos podem ter sofrido falha de rede entre a plataforma e o provedor. A função `recover_stale_buyer_outreach_attempts` marca essas tentativas como falha para revisão manual.

Essa recuperação **não reenvia automaticamente** a mensagem. A decisão é proposital: o provedor pode ter recebido a mensagem mesmo que a resposta tenha sido perdida, e um reenvio automático poderia gerar duplicidade para o comprador.

## Gateway Supabase

As funções chamadas por Meta, Resend, provedores de entrada ou cron têm `verify_jwt = false` em `supabase/config.toml`, porque esses serviços não possuem JWT do Supabase. Isso **não** torna as rotas abertas: cada uma continua protegida por assinatura ou segredo próprio.

Funções iniciadas pelo usuário, como geração de IA e checkout, continuam com `verify_jwt = true`.

## Webhook normalizado para outros provedores

A função `buyer-outreach-webhook` continua sendo o ponto canônico para provedores externos que já consigam transformar os eventos no formato interno da plataforma. Ela exige:

```text
BUYER_OUTREACH_PROVIDER_WEBHOOK_SECRET=
```

O chamador deve enviar esse valor no header `x-webhook-secret`.

Eventos aceitos atualmente:

- `sent`
- `delivered`
- `read`
- `failed`
- `reply`
- `interested`
- `not_interested`
- `request_details`
- `request_visit`
- `opt_out`
- `other`

O webhook é idempotente por `provider + event_id` para respostas e não rebaixa um status de entrega já mais avançado.

## Ordem segura de ativação

Este repositório contém apenas o código e os nomes das variáveis. Nenhuma chave real deve ser commitada.

Antes de ativar em produção:

1. confirmar que o Supabase é o projeto exclusivo do IMOBILIARIAS;
2. aplicar **todas as migrations na ordem**, incluindo `0102` a `0106`, somente no projeto correto;
3. configurar secrets das Edge Functions;
4. fazer deploy de `deliver-buyer-outreach`, `process-buyer-opportunities`, `meta-whatsapp-webhook`, `resend-outreach-webhook`, `ingest-inbound-email`, `buyer-outreach-webhook`, `reconcile-outreach-provider-events` e `platform-maintenance`;
5. configurar o agendador para chamar apenas `platform-maintenance` com `PLATFORM_MAINTENANCE_SECRET`;
6. configurar na Meta a Callback URL da função `meta-whatsapp-webhook` e o mesmo Verify Token salvo no backend;
7. assinar os eventos de WhatsApp necessários no painel da Meta;
8. configurar no Resend o webhook `resend-outreach-webhook`, selecionar os eventos de entrega/abertura/falha e salvar o signing secret no backend;
9. configurar o provedor de e-mail recebido para entregar o formato normalizado a `ingest-inbound-email` com `INBOUND_EMAIL_SECRET`;
10. testar com uma imobiliária de homologação e contatos que tenham consentimento explícito.

A ordem migrations → secrets → Edge Functions é importante porque as funções de reconciliação usam estruturas criadas pelas migrations mais recentes.

A ativação não deve reutilizar chaves, banco, storage ou projeto Supabase de qualquer outro sistema LENOY.
