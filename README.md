# IMOBILIARIAS

Plataforma imobiliária composta por site público, painel administrativo e aplicativo para corretores.

## Stack atual

- **Web e painel:** Next.js 16.3 + React 19.2 + TypeScript
- **Aplicativo:** Expo SDK 57 + React Native 0.86 + TypeScript
- **Backend, autenticação, banco e storage:** Supabase
- **Monorepo:** pnpm workspaces
- **Offline mobile:** AsyncStorage + fila de sincronização resiliente

## O que já existe

### Site público
- Busca por compra/locação, cidade/bairro, tipo, quartos, banheiros, vagas, uso residencial/comercial, zona urbana/rural, preço e área mínima.
- Ordenação por preço e área, favoritos e carregamento progressivo.
- Catálogo demonstrativo como fallback quando o Supabase não está configurado.
- Catálogo real carregado da view `property_catalog` quando o Supabase está configurado.
- Página de imóvel demonstrativa por slug.
- Página genérica de imóvel real por `imovel/?id=<uuid>` para suportar novos cadastros sem novo build.
- Galeria navegável, compartilhamento, características, dados do corretor, WhatsApp com código do imóvel e formulário de contato.
- Endereço completo só é retornado no catálogo quando o imóvel estiver configurado para exibi-lo.

### Painel administrativo
- Login por Supabase Auth.
- Cadastro de novas contas da equipe com liberação posterior pelo administrador.
- Recuperação e redefinição de senha.
- Proteção por papel `admin` ou `broker`.
- Gestão de usuários e permissões.
- Vínculo de conta autenticada ao corretor correto.
- Visão de imóveis, métricas, pipeline de leads e corretores.
- Alteração de status e publicação de imóvel.
- Cadastro de imóvel com venda/locação, residencial/comercial, urbano/rural, endereço público ou privado, valores, áreas, características, corretor, destaque e publicação/rascunho.
- Upload de até 20 fotos, capa, ordenação e exclusão.
- Gestão de cidades, bairros, tipos de imóvel e características.
- Cadastro e ativação/inativação de corretores.
- Histórico de auditoria e exportação CSV.

### Aplicativo do corretor
- Login obrigatório quando o Supabase estiver configurado.
- Sessão persistida no aparelho.
- Cadastro e edição de rascunhos offline.
- Câmera e seleção múltipla da galeria.
- Até 20 fotos por imóvel com ordenação e capa.
- Fotos e dados preservados no aparelho sem conexão.
- Fila de sincronização com identificador idempotente.
- Reenvio quando a conexão retorna.
- Resolução de cidade, tipo, bairro e corretor antes de publicar.
- Upload de fotos e criação/atualização do imóvel no Supabase.
- Tela de imóveis do próprio corretor, alteração de status e publicação.
- Contatos atribuídos ao corretor com WhatsApp, ligação, e-mail e andamento comercial.

### Banco e segurança
- Entidades para cidades, bairros, corretores, perfis, tipos, imóveis, fotos, características, contatos, favoritos, sincronização e auditoria.
- RLS habilitado.
- Perfis `admin` e `broker`.
- Contas novas não recebem permissão automaticamente.
- Primeiro administrador possui fluxo de inicialização que só funciona enquanto não existir nenhum papel cadastrado.
- Corretor limitado aos próprios imóveis, fotos e contatos atribuídos.
- Storage de fotos privado, com leitura pública controlada apenas para imóveis publicados e acessíveis.
- Finalidade, zona, segmento residencial/comercial, status e estado de publicação.
- View pública `property_catalog` limitada ao conteúdo adequado para exposição pública.

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure apenas localmente:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WHATSAPP_DEFAULT=
```

Nunca commitar credenciais ou chaves privadas. As variáveis devem apontar exclusivamente para o projeto Supabase do IMOBILIARIAS.

## Banco de dados

As migrations ficam em `supabase/migrations/` e devem ser aplicadas em ordem. Elas criam o esquema inicial, papéis e políticas, storage, catálogo público, idempotência das fotos, privacidade, auditoria e fluxo de onboarding.

O roteiro de ativação está em `docs/GO-LIVE-CHECKLIST.md`.

## Primeiro acesso

1. Criar uma conta da equipe em `/cadastro/`.
2. Confirmar o e-mail, se a confirmação estiver habilitada.
3. Entrar na conta.
4. Abrir `/primeiro-acesso/` apenas na instalação inicial.
5. Depois do primeiro administrador, todos os novos acessos são liberados em **Usuários** no painel.

## Validação

O repositório contém workflow de CI para:

1. instalar dependências;
2. validar TypeScript da web;
3. gerar o build estático da web;
4. validar TypeScript do aplicativo.

## Publicação web

O projeto possui workflow para GitHub Pages e configuração de `basePath` para `/IMOBILIARIAS`. A URL prevista para acompanhamento é:

`https://imperiussp.github.io/IMOBILIARIAS/`

A publicação depende do GitHub Pages estar habilitado para usar GitHub Actions nas configurações do repositório.

## Regras do projeto

1. Novas funcionalidades são aditivas: preservar o que já funciona.
2. Não remover ou substituir funcionalidades sem pedido explícito.
3. Não expor segredos no repositório.
4. Variáveis sensíveis ficam em `.env`; `.env.example` contém apenas nomes seguros.
5. Corrigir causas reais, evitando alterações especulativas.
6. Site, painel e aplicativo compartilham os mesmos dados e regras.
7. Cadastros offline não podem ser perdidos nem duplicados durante sincronização.
8. Imóveis vendidos ou alugados são preservados historicamente; não há exclusão definitiva por padrão.
9. Nunca reutilizar Supabase, chaves ou dados de outro projeto.
