# Integração InfinitePay — LENOY IMÓVEIS

## Escopo
Esta integração pertence exclusivamente ao repositório e ao futuro projeto Supabase do **IMOBILIARIAS / LENOY IMÓVEIS**. Ela não deve compartilhar banco, project ref, service role, Edge Functions, webhook ou migrations com Moto Connect.

## Fluxo implementado
1. Proprietário/administrador escolhe o plano e ciclo mensal ou anual no painel.
2. A Edge Function `create-infinitepay-checkout` valida usuário, imobiliária e preço no servidor.
3. O servidor cria `order_nsu` próprio e registra a sessão antes de chamar a InfinitePay.
4. O checkout é criado em `POST https://api.checkout.infinitepay.io/links` com preço em centavos.
5. A InfinitePay redireciona o usuário de volta e também envia webhook.
6. `infinitepay-webhook` valida segredo da URL, `order_nsu`, transação e valor esperado.
7. Como redundância, `confirm-infinitepay-payment` consulta `POST https://api.checkout.infinitepay.io/payment_check` no retorno do usuário.
8. A assinatura só é ativada depois da confirmação do pagamento.
9. A ativação é idempotente: o mesmo checkout não cria duas assinaturas mesmo se webhook e retorno ocorrerem juntos.
10. `transaction_nsu`, `invoice_slug`, meio de captura, valor pago e comprovante ficam associados à sessão.

## Variáveis de backend
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PLATFORM_SITE_URL=https://imoveis.lenoy.com.br`
- `INFINITEPAY_HANDLE` — InfiniteTag sem `$`
- `INFINITEPAY_WEBHOOK_SECRET` — segredo aleatório forte

Nunca colocar `SUPABASE_SERVICE_ROLE_KEY` ou `INFINITEPAY_WEBHOOK_SECRET` em `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`.

## Segurança
- Nenhum valor de plano enviado pelo navegador é aceito como fonte de verdade; o preço é lido de `subscription_plans` pelo servidor.
- A cobrança usa `order_nsu` gerado internamente.
- O webhook não ativa plano se o valor pago divergir do valor esperado.
- Eventos são idempotentes pelo identificador da transação.
- O usuário autenticado precisa ser owner/admin da imobiliária ou super-admin da plataforma.
- O webhook público fica sem JWT porque é chamado pela InfinitePay, mas exige segredo próprio na URL e faz conciliação do pedido antes de qualquer ativação.

## Recorrência
A InfinitePay oferece Planos e Recorrências no produto. Entretanto, a integração pública documentada atualmente para sistemas próprios expõe claramente o Checkout Integrado e `payment_check`. O projeto não inventa um endpoint de assinatura recorrente não documentado. A base do LENOY IMÓVEIS já separa ciclo mensal/anual e dados do provedor para receber a API oficial de recorrência caso ela seja disponibilizada/confirmada para integração.

## Antes de produção
- habilitar Checkout Integrado na conta InfinitePay;
- definir preços reais dos planos no painel global;
- configurar InfiniteTag e segredo no Supabase exclusivo do IMOBILIARIAS;
- aplicar migrations apenas nesse Supabase;
- implantar as três Edge Functions InfinitePay;
- testar Pix e cartão com um plano de teste controlado;
- validar webhook, retorno, comprovante, reenvio de webhook e tentativa duplicada;
- só então liberar o botão de pagamento para clientes reais.
