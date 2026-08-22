# Provedores de oportunidades para compradores

A plataforma possui uma cadeia completa para oportunidades automáticas:

1. `process-buyer-opportunities` seleciona oportunidades elegíveis.
2. O processamento valida plano, consentimento, canal, intervalo mínimo, limite mensal e horário silencioso.
3. `deliver-buyer-outreach` faz a entrega pelo canal configurado.
4. `meta-whatsapp-webhook` recebe diretamente os eventos da Meta para WhatsApp.
5. `buyer-outreach-webhook` permanece disponível como entrada normalizada para outros provedores.
6. O painel administrativo exibe métricas, respostas, pedidos de visita e descadastros.

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
```

O domínio/remetente precisa estar autorizado no provedor antes do uso em produção.

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
- associação de respostas pelo ID da mensagem original quando a Meta fornece `context.id`;
- fallback pelo número do comprador para localizar a última oportunidade WhatsApp enviada;
- classificação local de respostas como interesse, pedido de detalhes, pedido de visita, sem interesse e opt-out;
- gravação idempotente da resposta no CRM;
- revogação automática de alertas e WhatsApp quando o comprador solicita não receber novas mensagens.

O valor informado no campo **Verify token** da Meta deve ser exatamente o mesmo configurado em:

```text
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

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

## Ativação segura

Este repositório contém apenas o código e os nomes das variáveis. Nenhuma chave real deve ser commitada.

Antes de ativar em produção:

1. confirmar que o Supabase é o projeto exclusivo do IMOBILIARIAS;
2. aplicar as migrations na ordem somente no projeto correto;
3. configurar secrets das Edge Functions;
4. fazer deploy de `deliver-buyer-outreach`, `process-buyer-opportunities`, `meta-whatsapp-webhook` e `buyer-outreach-webhook`;
5. configurar o agendador de processamento;
6. configurar na Meta a Callback URL da função `meta-whatsapp-webhook` e o mesmo Verify Token salvo no backend;
7. assinar os eventos de WhatsApp necessários no painel da Meta;
8. testar com uma imobiliária de homologação e um contato que tenha consentimento explícito.

A ativação não deve reutilizar chaves, banco, storage ou projeto Supabase de qualquer outro sistema LENOY.
