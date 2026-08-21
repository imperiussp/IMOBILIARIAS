# Requisitos adicionais — Aplicativo do corretor e classificação de compradores

Estes requisitos são **aditivos**. Eles não substituem nem removem funções já existentes ou previamente planejadas para o SaaS LENOY IMÓVEIS.

## 1. Cadastro de imóvel pelo aplicativo
- Corretor pode tirar fotos diretamente pelo aplicativo.
- Corretor pode selecionar fotos da galeria.
- Corretor pode escrever e editar a descrição do imóvel.
- Corretor pode preencher os dados necessários do imóvel e enviar diretamente para o site da imobiliária correta.
- O imóvel enviado deve respeitar `agency_id`, usuário/corretor responsável e permissões do plano.
- Após sincronização bem-sucedida, o imóvel pode ser publicado conforme a regra de publicação definida para a imobiliária.

## 2. Últimos lançamentos no site
- Imóveis recém-publicados devem aparecer em uma seção/categoria de **Últimos lançamentos**.
- A ordenação padrão dessa seção deve priorizar os imóveis mais recentemente publicados.
- O sistema deve continuar permitindo outras categorias e vitrines já existentes ou futuras, sem substituir o catálogo principal.

## 3. Filtros e ordenação do catálogo
- Faixa de preço: valor mínimo e valor máximo.
- Ordenar por menor preço.
- Ordenar por maior preço.
- Ordenar por mais recentes/últimos lançamentos.
- Manter os demais filtros já planejados: cidade, bairro, finalidade, tipo de imóvel, segmento, zona, quartos, banheiros, vagas, área e outros que forem adicionados.

## 4. Funcionamento offline do aplicativo
- Corretor pode cadastrar imóvel, descrição e fotos sem internet.
- Os dados devem ficar armazenados localmente em fila offline.
- O aplicativo deve sincronizar automaticamente quando a conexão voltar.
- A sincronização deve ser resiliente e idempotente para evitar cadastro ou foto duplicados.
- Falha parcial não deve apagar o rascunho local antes da confirmação de sincronização completa.

## 5. Regra Wi‑Fi x dados móveis
- Ao detectar que existe fila pendente e a conexão disponível é por dados móveis, o aplicativo deve perguntar ao corretor:
  - **Enviar agora usando dados móveis**; ou
  - **Aguardar conexão Wi‑Fi**.
- A escolha de aguardar Wi‑Fi deve manter a fila local intacta e sincronizar automaticamente quando Wi‑Fi estiver disponível.
- A opção poderá futuramente ter preferência persistente configurável pelo usuário, sem remover a confirmação manual quando a política exigir.

## 6. Android e iPhone personalizáveis
- Aplicativo deve ter versão Android e iOS.
- Branding deve ser personalizável por imobiliária quando o plano permitir, incluindo pelo menos nome, logotipo, cores e identidade visual.
- A arquitetura deve evitar criar um código-base separado para cada cliente.
- A personalização deve derivar do tenant/imobiliária ativa.

## 7. Notificações de clientes
- Aplicativo deve receber notificações visuais e sonoras quando houver novos contatos/mensagens de clientes.
- Origem pode incluir portal/site e integrações de e-mail previstas para o sistema.
- Notificação deve abrir o lead/conversa correspondente quando possível.
- Contagem de não lidas e histórico de notificações devem ser considerados.
- Notificações devem sempre respeitar o `agency_id` e o corretor responsável/permissões.

## 8. Classificação de possíveis compradores
- O aplicativo deve permitir classificar contatos/leads conforme o potencial comercial.
- Categorias iniciais de classificação:
  - possível comprador / interessado qualificado;
  - interessado em acompanhamento;
  - somente consulta de preço/informação;
  - sem interesse atual;
  - outro/sem classificação.
- A classificação deve poder ser alterada pelo corretor conforme a evolução do atendimento.
- A classificação deve ficar disponível para filtros e organização da carteira de leads.
- Não apagar o histórico anterior ao mudar a classificação.

## 9. Regras gerais
- Todos os itens acima são aditivos às funções já existentes.
- Nenhuma implementação deve remover funções de web, painel administrativo, multi-tenant, domínio próprio, planos, equipe, leads, fotos, offline ou segurança já construídas.
- Sempre preservar isolamento entre imobiliárias.
- Nas próximas revisões de andamento, cada item deve ser marcado como: **Pronto**, **Parcial**, **Pendente** ou **Bloqueado**, com indicação objetiva do que falta quando não estiver pronto.
