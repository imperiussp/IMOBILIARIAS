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
5. Criar a primeira conta da equipe em `/cadastro/`.
6. Confirmar o e-mail, caso a confirmação esteja habilitada no Supabase.
7. Entrar nessa conta e abrir `/primeiro-acesso/` para definir o administrador inicial.
8. Depois disso, todos os novos usuários devem ser liberados pelo menu **Usuários** do painel.
9. Cadastrar corretores e vincular cada conta ao corretor correto.
10. Testar cadastro de imóvel, upload de fotos, catálogo público, WhatsApp, lead e aplicativo antes de publicar para clientes.

## Recursos pendentes / roadmap

- [ ] **IA de oportunidade para compradores:** quando um imóvel disponível atingir a compatibilidade mínima com as preferências registradas de um comprador, a IA deve preparar e disparar um contato comercial personalizado nos canais autorizados pela imobiliária e pelo cliente.
  - Deve funcionar tanto para imóveis que já estejam no catálogo quanto para **novos imóveis assim que forem cadastrados/publicados**.
  - Usar o perfil de compra e a pontuação de matching já existente, respeitando sempre `agency_id` para não misturar compradores e imóveis de imobiliárias diferentes.
  - Permitir definir uma pontuação mínima de compatibilidade antes do contato automático.
  - Evitar envio duplicado do mesmo imóvel para o mesmo comprador e aplicar período de espera entre contatos.
  - Registrar no CRM qual imóvel gerou o contato, a pontuação de compatibilidade, canal utilizado, data/hora, resultado e eventual resposta do comprador.
  - Permitir ligar/desligar automação por imobiliária e, futuramente, controlar o recurso por plano.
  - Priorizar WhatsApp e permitir outros canais compatíveis, sempre respeitando consentimento, opt-out e regras do provedor utilizado.
  - A IA não pode inventar características do imóvel: a mensagem deve usar somente dados confirmados no cadastro.
  - O corretor responsável deve receber aviso da oportunidade e do contato efetuado.

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

## Publicação web

A URL prevista no GitHub Pages é:

`https://imperiussp.github.io/IMOBILIARIAS/`

Antes de considerar publicada, confirmar que GitHub Pages está configurado para **GitHub Actions** e que o workflow de build terminou com sucesso.
