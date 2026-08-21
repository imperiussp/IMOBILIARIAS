# Requisitos adicionais — Aplicativo do corretor e classificação de compradores

Estes requisitos são **aditivos**. Eles não substituem nem removem funções já existentes ou previamente planejadas para o SaaS LENOY IMÓVEIS.

> Status abaixo significa avanço **no código do projeto**. Itens que dependem de Supabase real, credenciais, build Android/iOS, DNS ou provedor externo continuam exigindo a etapa de produção antes de serem considerados validados em uso real.

## 1. Cadastro de imóvel pelo aplicativo — PRONTO NO CÓDIGO
- Corretor tira fotos pela câmera e seleciona imagens da galeria.
- Preenche título, descrição, finalidade, tipo, segmento, zona, cidade, bairro, endereço, preço, quartos, suítes, banheiros, vagas e áreas.
- Reordena e remove fotos antes da publicação.
- Pode salvar rascunho local.
- Envio usa imobiliária/corretor ativos e `agency_id`.
- Imóveis publicados entram no mesmo catálogo do site.
- Edição posterior de dados, status, publicação e fotos também está preparada no aplicativo.

## 2. Últimos lançamentos no site — PRONTO NO CÓDIGO
- Existe seção **Últimos lançamentos**.
- Ordenação usa data real de publicação quando disponível.
- Imóveis enviados pelo aplicativo são publicados com `published_at` e aparecem no topo conforme essa data.
- Catálogo principal continua separado e completo.

## 3. Filtros e ordenação do catálogo — PRONTO NO CÓDIGO
- Preço mínimo e máximo.
- Menor preço.
- Maior preço.
- Mais recentes.
- Maior área.
- Cidade/bairro, finalidade, tipo, segmento, zona, quartos, banheiros, vagas e área mínima.
- Favoritos e atalhos para categorias continuam disponíveis.

## 4. Funcionamento offline do aplicativo — PRONTO NO CÓDIGO
- Cadastro, descrição e referências locais das fotos ficam em rascunho/fila offline.
- A fila é persistida no aparelho.
- A sincronização é idempotente e usa código estável do rascunho.
- Retentativas não criam novo imóvel para o mesmo rascunho.
- Fotos usam caminhos estáveis e `upsert` na sincronização.
- O rascunho só é removido após a conclusão da sincronização.
- Filas são separadas por imobiliária ativa.

## 5. Regra Wi‑Fi x dados móveis — PRONTO NO CÓDIGO
- Wi‑Fi/Ethernet: sincronização automática.
- Dados móveis: aplicativo pergunta antes de enviar.
- Opções: **Enviar pelos dados** ou **Aguardar Wi‑Fi**.
- Ao aguardar, a fila permanece intacta.
- Ao retornar ao Wi‑Fi, o envio pode ocorrer automaticamente.

## 6. Android e iPhone personalizáveis — PARCIAL / ESTRUTURA PRONTA
- Projeto Expo/React Native preparado para Android e iOS.
- Branding em tempo de execução por imobiliária: nome, logo, cor principal e cor secundária.
- Mesmo código-base atende múltiplas imobiliárias.
- O corretor pode trocar a imobiliária ativa quando trabalhar em mais de uma.
- **Falta para produção:** gerar builds assinados Android/iOS, definir identificadores definitivos, ícones/splash finais e validar distribuição em aparelhos reais.

## 7. Notificações de clientes — PARCIAL AVANÇADO
- Caixa de notificações por `agency_id`, usuário e corretor criada.
- Novo lead do portal gera notificação.
- Contato geral sem corretor é roteado aos corretores ativos da imobiliária.
- Contatos recebidos por e-mail possuem estrutura de ingestão preparada.
- Notificação local visual, sonora, vibração e badge estão preparadas.
- Registro de token remoto Expo Push está preparado.
- Dispatcher backend para Expo Push está criado com controle de tentativas/erros.
- Recursos de push podem ser controlados pelo plano.
- **Falta para produção:** implantar Edge Function, configurar projeto/credenciais Expo Push e executar teste real com app em segundo plano/fechado.

## 8. Classificação de possíveis compradores — PRONTO NO CÓDIGO
- Classificações disponíveis:
  - possível comprador;
  - acompanhar;
  - somente consulta de preço/informação;
  - sem interesse atual;
  - outro;
  - não classificado.
- Classificação é independente da etapa do atendimento.
- Filtro por classificação no aplicativo.
- Alterações preservam histórico.
- Dados permanecem isolados por imobiliária.

## 9. Multi-imobiliária no aplicativo — PRONTO NO CÓDIGO
- Mesmo usuário pode ser corretor em mais de uma imobiliária.
- Cadastro de corretor deixa de ser único globalmente e passa a ser único por `(agency_id, user_id)`.
- Aplicativo lista imobiliárias disponíveis e memoriza a imobiliária ativa.
- Branding, leads, imóveis, notificações e fila offline seguem a imobiliária escolhida.

## 10. Contatos por e-mail — PARCIAL AVANÇADO
- Alias técnico por imobiliária preparado.
- Webhook de ingestão de e-mail preparado e protegido por segredo interno.
- Evita duplicação por `message_id` do provedor.
- Converte o e-mail recebido em lead com origem `email`.
- O lead entra no mesmo fluxo de notificação dos corretores.
- **Falta para produção:** configurar domínio/MX ou provedor de e-mail inbound e apontar o webhook para a Edge Function.

## 11. Regras gerais — MANTIDAS
- Todos os itens são aditivos às funções já existentes.
- Nenhuma implementação deve remover funções de web, painel administrativo, multi-tenant, domínio próprio, planos, equipe, leads, fotos, offline ou segurança já construídas.
- Sempre preservar isolamento entre imobiliárias.
- Nas próximas revisões de andamento, usar: **Pronto**, **Parcial**, **Pendente** ou **Bloqueado**.
