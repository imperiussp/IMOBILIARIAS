# Cobrança e inadimplência — validação restrita

Nenhuma das etapas abaixo autoriza mudar produção. Manter Home, planos, cupons, cadastros, recursos públicos e webhooks atuais intactos até teste end-to-end.

## Comprovado em 29/10/2026
- Webhook InfinitePay existente; confirmação de pagamento e ativação da assinatura presentes no código atual.
- Os checkouts encontrados são **somente de `charge_type=implementation`**: seis pendentes e um expirado.
- **Nenhum checkout de assinatura** foi encontrado, portanto a rotina de e-mail não tem URL válida para enviar. Não reutilizar links de taxa de implantação.
- O serviço de e-mail da cobrança não foi implantado. Não há mensagens reais enviadas nesta tarefa.
- O cron existente registra falta de `BILLING_MAINTENANCE_SECRET`. Não ligar o processador de vencimento antigo: ele encerra a assinatura na data devida, antes da tolerância solicitada.

## Para finalizar em homologação
1. Criar uma cobrança InfinitePay de **assinatura**, via mecanismo já existente, usando apenas tenant de testes, e validar `amount`, `expires_at`, `checkout_url`, `billing_cycle`, destinatário e data do vencimento.
2. Instalar o SQL de notificações num projeto isolado e implantar `billing-notification-worker` só nesse ambiente; configurar `BILLING_NOTIFICATION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
3. Executar requisição autorizada com `x-billing-dry-run: true`: nenhum e-mail é enviado e nenhuma linha de entrega é escrita. Confirmar os candidatos de 5 dias antes e dia do vencimento.
4. Testar envio real apenas para e-mail interno autorizado. Verificar idempotência em duas execuções.
5. Auditar o acesso direto ao catálogo, aos detalhes, fotos, contatos, buckets e políticas RLS antes de integrar as regras de 2 e 5 dias. Não basta ocultar componentes React.
6. Simular recebimento genuíno do webhook, confirmar idempotência e recuperação do tenant sem permitir ativação por requisição não validada.
7. Aprovar uma única mudança mínima, versionada e reversível antes de qualquer implantação em produção.

## Regras mantidas
- D-5: primeiro e-mail.
- D0: segundo e-mail.
- D+2: público com informações institucionais limitadas.
- D+5: aviso neutro de indisponibilidade, sem divulgar inadimplência.
- Após pagamento confirmado: restaurar acesso.
- Preservar integralmente imóveis, fotos, contas, painéis de pagamento e histórico.

## Riscos conhecidos
- Há assinatura ativa com `renews_at` vencido e `ends_at` ausente. Nunca aplicar bloqueio em massa sem classificar os casos de homologação/isenções.
- Nenhum link de cobrança de assinatura existe até o momento da última consulta; tratar como bloqueio à conclusão do envio, não improvisar link.
