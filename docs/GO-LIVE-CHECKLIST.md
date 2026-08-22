# Checklist de ativação do IMOBILIARIAS

Este documento existe para impedir mistura com qualquer outro sistema.

## Regra principal

Use exclusivamente um projeto Supabase criado para o **IMOBILIARIAS**.
Nunca reutilize URL, chave, banco, bucket ou usuário administrativo de Moto Connect, LENOY, Lê+ ou outro projeto.

## Quando chegar a hora de ativar

1. Criar um novo projeto no Supabase com nome identificável como `IMOBILIARIAS`.
2. Conferir o nome do projeto antes de copiar qualquer chave.
3. Aplicar as migrations deste repositório em ordem.
4. Preencher apenas no ambiente do IMOBILIARIAS:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
5. Configurar os secrets das Edge Functions conforme `.env.example` e nunca expô-los no navegador/app.
6. Criar a primeira conta da equipe em `/cadastro/`.
7. Confirmar o e-mail, caso a confirmação esteja habilitada no Supabase.
8. Entrar nessa conta e abrir `/primeiro-acesso/` para definir o administrador inicial.
9. Depois disso, todos os novos usuários devem ser liberados pelo menu **Usuários** do painel.
10. Cadastrar corretores e vincular cada conta ao corretor correto.
11. Testar cadastro de imóvel, upload de fotos, catálogo público, WhatsApp, lead e aplicativo antes de publicar para clientes.

## IA de oportunidades para compradores

A estrutura funcional já está preparada no repositório:

- [x] Detectar oportunidades para imóveis existentes e novos imóveis publicados.
- [x] Usar perfil de compra e pontuação de matching por `agency_id`.
- [x] Configurar pontuação mínima, canais, intervalo entre contatos, horário silencioso e ativação por imobiliária.
- [x] Criar fila deduplicada por comprador + imóvel e estados de revisão, aprovação, envio, falha e descarte.
- [x] Registrar consentimento/opt-out separado por canal e permissão específica para alertas automáticos.
- [x] Gerar mensagens com IA sem inventar características do imóvel.
- [x] Controlar disponibilidade e limites por plano (`ai_buyer_outreach`).
- [x] Processar fila com consentimento, cooldown, limite mensal, plano e horário silencioso.
- [x] Possuir adaptador próprio de entrega para WhatsApp Cloud API e e-mail via Resend.
- [x] Registrar IDs de mensagem e estados enviado/entregue/lido/falha.
- [x] Receber webhook direto da Meta com validação de assinatura.
- [x] Classificar respostas em interesse, detalhes, visita, sem interesse e opt-out.
- [x] Revogar alertas automaticamente em opt-out.
- [x] Registrar respostas no histórico do CRM.
- [x] Criar follow-up automático para respostas positivas.
- [x] Notificar o corretor responsável sobre respostas positivas.
- [x] Exibir métricas, respostas e monitor de entrega no painel da imobiliária.
- [x] Evitar fallback ambíguo de telefone entre imobiliárias diferentes.
- [ ] Configurar credenciais reais do provedor de IA no Supabase exclusivo do IMOBILIARIAS.
- [ ] Configurar credenciais reais da Meta e/ou Resend.
- [ ] Cadastrar o webhook `meta-whatsapp-webhook` na Meta e concluir a verificação.
- [ ] Fazer deploy das Edge Functions no projeto Supabase exclusivo do IMOBILIARIAS.
- [ ] Executar testes reais de consentimento, opt-out, duplicidade, limites do plano, entrega, leitura e respostas antes de habilitar envio automático.

## Manutenção automática da plataforma

A função `platform-maintenance` concentra as rotinas recorrentes para reduzir a quantidade de crons independentes.

Ela aciona:

- expiração/manutenção de assinaturas;
- verificação de domínios próprios;
- dispatcher de push;
- processamento da fila de oportunidades para compradores.

Antes da produção:

- [ ] Configurar `PLATFORM_MAINTENANCE_SECRET`.
- [ ] Configurar os secrets específicos de cada rotina.
- [ ] Fazer deploy da função `platform-maintenance`.
- [ ] Criar um cron seguro apontando para essa função.
- [ ] Confirmar que `platform_maintenance_runs` registra as execuções.
- [ ] Conferir a área **Saúde da plataforma** após as primeiras execuções.

## Verificações antes de produção

- O projeto Supabase exibido no painel é IMOBILIARIAS.
- Nenhuma chave de outro projeto aparece no `.env`.
- O administrador inicial entra no painel.
- Um corretor de teste vê apenas os próprios imóveis e contatos.
- Um imóvel em rascunho não aparece no site público.
- Um endereço privado não é retornado pelo catálogo público.
- Fotos de rascunhos não ficam acessíveis publicamente.
- O fluxo offline do aplicativo cria apenas um imóvel após novas tentativas.
- Imóveis vendidos/alugados permanecem no histórico.
- A IA de oportunidades não envia contatos sem consentimento, canal autorizado e plano elegível.
- Uma resposta sem contexto da Meta nunca é ligada a uma imobiliária quando o telefone for ambíguo entre tenants.
- Um opt-out interrompe novos alertas automáticos do canal.
- Falhas de mensageria aparecem no monitor do painel e podem voltar para revisão sem reenvio automático.
- A manutenção automática registra histórico e não deixa uma rotina impedir as demais de serem processadas.

## Publicação web

A URL prevista no GitHub Pages é:

`https://imperiussp.github.io/IMOBILIARIAS/`

Antes de considerar publicada, confirmar que GitHub Pages está configurado para **GitHub Actions** e que o workflow de build terminou com sucesso.
