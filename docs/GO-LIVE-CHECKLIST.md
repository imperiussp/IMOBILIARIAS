# Checklist de ativação do IMOBILIARIAS

Este documento existe para impedir mistura com qualquer outro sistema e reduzir o risco de transformar homologação em lançamento por acidente.

## Regra principal

Use exclusivamente um projeto Supabase criado para o **IMOBILIARIAS**.
Nunca reutilize URL, chave, banco, bucket, usuário administrativo ou secret de Moto Connect, LENOY, Lê+ ou outro projeto.

## Quando chegar a hora de ativar

1. Criar um novo projeto no Supabase com nome identificável como `IMOBILIARIAS`.
2. Conferir o nome/project ref antes de copiar qualquer chave.
3. Aplicar **todas** as migrations deste repositório em ordem, incluindo `0102` a `0113`, antes de publicar as Edge Functions que dependem delas.
4. Confirmar que `platform_release_controls` nasceu em `homologation` e que continuam OFF: novos cadastros, cobrança real, mensageria externa e IA real.
5. Preencher apenas no ambiente do IMOBILIARIAS:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_ALLOW_INDEXING=false` durante homologação.
6. Configurar os secrets das Edge Functions conforme `.env.example` e nunca expô-los no navegador/app.
7. Conferir `supabase/config.toml`: webhooks externos e rotinas protegidas por segredo usam `verify_jwt=false`; ações iniciadas pelo usuário continuam com `verify_jwt=true`.
8. Criar/vincular a primeira imobiliária de homologação de forma controlada. Se o cadastro público continuar bloqueado, não abrir o self-service somente para criar dados de teste.
9. Confirmar o e-mail, caso a confirmação esteja habilitada no Supabase.
10. Entrar no painel e validar o administrador inicial.
11. Cadastrar corretores e vincular cada conta ao corretor correto.
12. Testar cadastro de imóvel, upload de fotos, catálogo público, lead, CRM, documentos e aplicativo antes de habilitar integrações externas.

## Controles globais de homologação

A migration `0109_platform_release_controls.sql` cria os freios centrais. O estado seguro esperado para a primeira publicação online é:

- `environment_mode = homologation`;
- `maintenance_mode = false`;
- `public_catalog_enabled = true` (ou false se a vitrine ainda não deve ser exibida);
- `new_registrations_enabled = false`;
- `real_billing_enabled = false`;
- `external_messaging_enabled = false`;
- `ai_generation_enabled = false`.

Itens já protegidos no código:

- [x] Painel global para visualizar/alterar os controles.
- [x] Histórico auditável das mudanças de ambiente.
- [x] Pré-voo automático de homologação (`0110`).
- [x] RPC pública estreita de estado de cadastro e catálogo (`0111`), sem expor configurações internas.
- [x] Índices para o histórico dos controles (`0112`).
- [x] Bloqueio de novos cadastros na interface.
- [x] Revalidação do bloqueio imediatamente antes do `signUp`.
- [x] Bloqueio no trigger do banco contra criação direta de `agency_owner` (`0113`).
- [x] Convites de equipe permanecem separados do cadastro de novo tenant.
- [x] Catálogo de tenants pode ser pausado globalmente sem apagar imóveis nem bloquear o admin.
- [x] Checkout InfinitePay recusa cobrança enquanto `real_billing_enabled=false`.
- [x] Mensageria recusa envio no processador e no adaptador final.
- [x] IA recusa chamadas externas no processamento automático e nas duas gerações manuais.
- [x] `robots.txt` bloqueia indexação por padrão e sitemap fica vazio até `NEXT_PUBLIC_ALLOW_INDEXING=true`.

Antes de colocar na rede em homologação:

- [ ] Confirmar no painel **Controle de homologação e lançamento** que recursos sensíveis estão OFF.
- [ ] Confirmar que **Pré-voo** não mostra bloqueio obrigatório.
- [ ] Abrir `/cadastro/` e confirmar que nova imobiliária está bloqueada.
- [ ] Confirmar que um convite de equipe ainda pode criar conta e aceitar o convite.
- [ ] Confirmar que uma chamada direta de `agency_owner` é recusada pelo trigger do banco.
- [ ] Confirmar que `robots.txt` está bloqueando indexação e que `/sitemap.xml` não publica URLs durante homologação.
- [ ] Confirmar que o botão de pagamento não consegue criar checkout real com cobrança OFF.
- [ ] Confirmar que IA não chama provedor com IA OFF.
- [ ] Confirmar que mensageria não chama Meta/Resend com mensageria OFF.

## IA de oportunidades para compradores

A estrutura funcional já está preparada no repositório:

- [x] Detectar oportunidades para imóveis existentes e novos imóveis publicados.
- [x] Usar perfil de compra e pontuação de matching por `agency_id`.
- [x] Configurar pontuação mínima, canais, intervalo mínimo, horário silencioso e ativação por imobiliária.
- [x] Criar fila deduplicada por comprador + imóvel e estados de revisão, aprovação, envio, falha e descarte.
- [x] Registrar consentimento/opt-out separado por canal e permissão específica para alertas automáticos.
- [x] Gerar mensagens com IA sem inventar características do imóvel.
- [x] Controlar disponibilidade e limites por plano (`ai_buyer_outreach`).
- [x] Processar fila com consentimento, cooldown, limite mensal, plano e horário silencioso.
- [x] Possuir adaptador próprio de entrega para WhatsApp Cloud API e e-mail via Resend.
- [x] Registrar IDs de mensagem, provedor real e estados enviado/entregue/lido/falha.
- [x] Receber webhook direto da Meta com validação de assinatura.
- [x] Registrar timestamps reais informados pela Meta para envio, entrega, leitura e respostas quando disponíveis.
- [x] Receber webhook direto e assinado do Resend.
- [x] Mapear `email.opened` como abertura técnica no monitor.
- [x] Desativar alertas de e-mail após bounce, complaint ou suppression.
- [x] Diferenciar novo lead por e-mail de resposta a oportunidade já enviada.
- [x] Classificar respostas em interesse, detalhes, visita, sem interesse e opt-out.
- [x] Revogar alertas automaticamente em opt-out.
- [x] Registrar respostas no histórico do CRM.
- [x] Criar follow-up automático para respostas positivas.
- [x] Notificar o corretor responsável sobre respostas positivas.
- [x] Exibir métricas, respostas e monitor de entrega no painel da imobiliária.
- [x] Exibir taxa de entrega, abertura/leitura e falha por canal/provedor nos últimos 30 dias.
- [x] Evitar fallback ambíguo de telefone entre imobiliárias diferentes.
- [x] Evitar correlação ambígua de resposta de e-mail; associação só ocorre dentro da imobiliária e para contato inequívoco.
- [x] Detectar tentativa parada em `sending` e transformar em falha controlada após 20 minutos, sem reenvio automático.
- [x] Preservar eventos da Meta/Resend que cheguem antes da gravação do `provider_message_id`.
- [x] Reconciliar posteriormente eventos precoces e respostas WhatsApp referenciadas.
- [x] Indexar buscas por `provider_message_id`.
- [x] Retirar da fila ativa eventos não correlacionados por mais de 7 dias sem apagar payload de auditoria.
- [x] Separar no painel eventos pendentes, atrasados e abandonados/preservados.
- [x] Manter histórico append-only das transições técnicas das tentativas (`0107`).
- [x] Fazer backfill conservador de tentativas anteriores sem inventar transições históricas.
- [x] Resumir histórico técnico por tentativa para leitura escalável (`0108`).
- [ ] Configurar credenciais reais do provedor de IA no Supabase exclusivo do IMOBILIARIAS.
- [ ] Configurar credenciais reais da Meta e/ou Resend.
- [ ] Cadastrar o webhook `meta-whatsapp-webhook` na Meta e concluir a verificação.
- [ ] Cadastrar `resend-outreach-webhook` no Resend e salvar `RESEND_WEBHOOK_SIGNING_SECRET`.
- [ ] Configurar o recebimento normalizado de e-mail para `ingest-inbound-email`.
- [ ] Fazer deploy das Edge Functions no projeto Supabase exclusivo do IMOBILIARIAS.
- [ ] Executar testes reais de consentimento, opt-out, duplicidade, limites do plano, entrega, abertura/leitura, respostas e reconciliação antes de habilitar envio automático.

## Manutenção automática da plataforma

A função `platform-maintenance` concentra as rotinas recorrentes para reduzir a quantidade de crons independentes.

Ela aciona, nesta ordem operacional:

- recuperação conservadora de tentativas de mensageria presas;
- marcação como abandonados, sem exclusão, de eventos de provedor órfãos por mais de 7 dias;
- reconciliação de eventos precoces da Meta/Resend ainda ativos;
- expiração/manutenção de assinaturas;
- verificação de domínios próprios;
- dispatcher de push;
- processamento da fila de oportunidades para compradores.

Antes da produção:

- [ ] Configurar `PLATFORM_MAINTENANCE_SECRET`.
- [ ] Configurar os secrets específicos de cada rotina.
- [ ] Aplicar migrations até `0113` antes do deploy das funções atuais.
- [ ] Fazer deploy de `platform-maintenance` e `reconcile-outreach-provider-events`.
- [ ] Criar um cron seguro apontando somente para `platform-maintenance`.
- [ ] Confirmar que `platform_maintenance_runs` registra execuções.
- [ ] Conferir **Saúde da plataforma** após as primeiras execuções.
- [ ] Confirmar que a manutenção não fica mais de 24h sem execução.
- [ ] Confirmar que eventos aguardando correlação voltam a zero em operação normal.
- [ ] Confirmar que eventos abandonados permanecem auditáveis e não retornam à fila ativa.

## Verificações antes de produção

- O projeto Supabase exibido no painel é IMOBILIARIAS.
- Nenhuma chave de outro projeto aparece no `.env`.
- O administrador inicial entra no painel.
- Um corretor de teste vê apenas os próprios imóveis e contatos.
- Um corretor pertencente a duas imobiliárias não mistura dados entre tenants.
- Um imóvel em rascunho não aparece no site público.
- Um endereço privado não é retornado pelo catálogo público.
- Fotos de rascunhos não ficam acessíveis publicamente.
- O fluxo offline do aplicativo cria apenas um imóvel após novas tentativas.
- Imóveis vendidos/alugados permanecem no histórico.
- A IA de oportunidades não envia contatos sem consentimento, canal autorizado e plano elegível.
- Uma resposta sem contexto da Meta nunca é ligada a uma imobiliária quando o telefone for ambíguo entre tenants.
- Uma resposta por e-mail nunca é correlacionada fora da imobiliária destinatária.
- Um opt-out interrompe novos alertas automáticos do canal.
- Bounce, complaint e suppression interrompem o canal de e-mail automático até revisão da permissão.
- Falhas de mensageria aparecem no monitor e podem voltar para revisão sem reenvio automático.
- Uma tentativa parada em `sending` não é reenviada sozinha.
- Eventos precoces de provedor ficam em `outreach_provider_event_inbox` e são reconciliados pela manutenção.
- Eventos pendentes por mais de 30 minutos aparecem na Saúde da plataforma.
- Eventos sem correlação por mais de 7 dias são marcados como abandonados, preservados e deixam de contar como fila ativa.
- Eventos do Resend alteram o monitor somente após validação da assinatura do webhook.
- Webhooks externos alcançam as Edge Functions sem JWT do Supabase, mas continuam protegidos por assinatura/segredo próprio.
- A manutenção automática registra histórico e não deixa uma rotina impedir as demais.
- Toda mudança de freio global aparece em **Histórico do ambiente**.
- `NEXT_PUBLIC_ALLOW_INDEXING` só muda para `true` quando o lançamento comercial for deliberado.

## Publicação web de homologação

O ambiente pode ser colocado na rede antes do lançamento, desde que os freios acima permaneçam ativos. O arquivo `docs/HOMOLOGATION-GO-LIVE.md` contém a sequência recomendada.

A URL de preview prevista no GitHub Pages é:

`https://imperiussp.github.io/IMOBILIARIAS/`

Antes de considerar a aplicação publicada em qualquer host, confirmar que o build terminou com sucesso. GitHub Pages de documentação/preview não substitui o deploy real da aplicação Next.js.
