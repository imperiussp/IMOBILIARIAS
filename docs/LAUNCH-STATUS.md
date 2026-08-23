# LENOY IMOBILIÁRIAS — Status de lançamento

Atualizado em 22/08/2026.

## Estado atual

O projeto está em **homologação técnica**. O banco real e o backend Supabase já foram implantados no projeto exclusivo do IMOBILIÁRIAS, mas o produto ainda **não deve ser considerado produção** enquanto deploy web, DNS/TLS, segredos operacionais e evidências funcionais não forem concluídos.

## Concluído no código e banco

- Identidade visual premium V3 aplicada à plataforma e ao site público das imobiliárias.
- Catálogo, filtros, favoritos, detalhe de imóvel e administração preservados.
- App mantém fila offline, drafts, câmera/galeria, limite de 20 fotos e sincronização.
- Guard de destino impede misturar o Supabase do IMOBILIÁRIAS com outros projetos.
- Health `/api/health` possui identidade, project ref, commit SHA e build label.
- Smoke pós-deploy pode exigir o SHA exato implantado.
- Registro de releases é auditável, sem exclusão pelo fluxo administrativo e não permite ativação antes de smoke aprovado.
- `pnpm release:validate` reúne checks críticos de pré-lançamento.
- Migrations originais `0001–0129` foram aplicadas no ambiente exclusivo.
- Hardening adicional `0130–0132` foi criado após auditoria real e também aplicado.
- Bugs de instalação limpa encontrados durante a implantação foram corrigidos no repositório antes de prosseguir.

## Supabase exclusivo

Projeto: **IMOBILIARIAS**  
Project ref: `rvjsonspplqelktzwusu`  
Região: São Paulo (`sa-east-1`)  
Identidade confirmada: `project_identity() = 'IMOBILIARIAS'`.

O projeto `MOTO-CONNECT` permanece separado e não recebeu migrations, Edge Functions ou credenciais do IMOBILIÁRIAS.

## Edge Functions

As **17 Edge Functions previstas no repositório estão implantadas e ACTIVE** no projeto novo:

- buyer-outreach-health
- buyer-outreach-webhook
- confirm-infinitepay-payment
- create-infinitepay-checkout
- deliver-buyer-outreach
- generate-buyer-opportunity-message
- generate-property-description
- infinitepay-webhook
- ingest-inbound-email
- meta-whatsapp-webhook
- platform-maintenance
- process-buyer-opportunities
- process-subscription-expiry
- push-broker-notifications
- reconcile-outreach-provider-events
- resend-outreach-webhook
- verify-custom-domains

O checkpoint `edge_functions_deployed` foi marcado concluído somente depois da confirmação 17/17 ACTIVE.

## Freios atuais de homologação

- `environment_mode = homologation`
- novos cadastros: **OFF**
- cobrança real: **OFF**
- mensageria externa: **OFF**
- IA: **OFF**
- push: **OFF**
- catálogo público: **ON** para homologação visual

Portanto, implantar as Functions **não libera cobrança, WhatsApp/e-mail, IA ou push automaticamente**.

## Segurança

- Advisors do Supabase foram executados durante e após a implantação.
- Views críticas usam `security_invoker` onde aplicável.
- Execução anônima implícita de RPCs administrativos foi removida (`0130/0131`).
- Funções `SECURITY DEFINER` usadas exclusivamente por triggers deixaram de ser RPCs chamáveis por usuários autenticados (`0132`).
- RPCs públicos necessários ao site permanecem explicitamente liberados.
- O aviso `inbound_email_events` com RLS sem policy é informativo: a tabela é operada pelo backend/service role e não possui leitura pública prevista.

## Checkpoints comprovados

Concluídos:

1. Supabase exclusivo confirmado;
2. migrations aplicadas;
3. identidade do projeto confirmada;
4. 17/17 Edge Functions implantadas.

Estado atual do checklist persistente:

- rede/homologação online: **4 de 12 concluídos**;
- produção: **4 de 14 concluídos**;
- pendentes de rede: **8**;
- pendentes de produção: **10**.

## Próximos bloqueadores reais

1. configurar os segredos privados das Edge Functions no projeto Supabase;
2. configurar variáveis públicas do web/app com URL e chave publishable do Supabase exclusivo;
3. publicar o Next.js de homologação com commit SHA/build label;
4. apontar `imoveis.lenoy.com.br` para o host real e validar TLS;
5. configurar e executar a manutenção real com sucesso;
6. executar health e smoke pós-deploy exigindo o SHA correto;
7. criar usuários/tenants de teste e executar isolamento multi-imobiliária funcional;
8. validar Auth, CRUD de imóveis, fotos/Storage, CRM e permissões;
9. registrar evidências e uma release ativa de homologação com smoke aprovado;
10. validar backup/rollback;
11. somente então avaliar promoção para produção e ativação individual das integrações.

## Regra de segurança

Nenhuma migration, Edge Function, credencial ou configuração do IMOBILIÁRIAS deve ser aplicada ao Supabase `MOTO-CONNECT` ou a qualquer outro projeto existente.
