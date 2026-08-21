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
- Busca por compra/locação, cidade/bairro, tipo, quartos, uso residencial/comercial e zona urbana/rural.
- Favoritos persistidos no navegador.
- Catálogo demonstrativo como fallback quando o Supabase não está configurado.
- Catálogo real carregado da view `property_catalog` quando o Supabase está configurado.
- Página de imóvel demonstrativa por slug.
- Página genérica de imóvel real por `imovel/?id=<uuid>` para suportar novos cadastros sem novo build.
- Galeria de fotos, dados do corretor, WhatsApp com código do imóvel e formulário de contato.

### Painel administrativo
- Login por Supabase Auth.
- Proteção por papel `admin` ou `broker`.
- Visão de imóveis, métricas, leads e corretores.
- Alteração de status de imóvel.
- Cadastro de imóvel com venda/locação, residencial/comercial, urbano/rural, endereço público ou privado, valores, áreas, características, corretor, destaque e publicação/rascunho.
- Upload de até 20 fotos para o bucket `property-photos`, com primeira foto como capa.
- Cadastro e ativação/inativação de corretores.

### Aplicativo do corretor
- Login obrigatório quando o Supabase estiver configurado.
- Sessão persistida no aparelho.
- Cadastro e edição de rascunhos offline.
- Câmera e seleção múltipla da galeria.
- Até 20 fotos por imóvel.
- Fotos e dados preservados no aparelho sem conexão.
- Fila de sincronização com identificador idempotente.
- Reenvio quando a conexão retorna.
- Resolução de cidade, tipo, bairro e corretor antes de publicar.
- Upload de fotos e criação/atualização do imóvel no Supabase.

### Banco e segurança
- Entidades para cidades, bairros, corretores, tipos, imóveis, fotos, características, contatos, favoritos e sincronização.
- RLS habilitado.
- Perfis `admin` e `broker`.
- Corretor limitado aos próprios imóveis e fotos.
- Storage público para leitura das fotos e escrita restrita a usuários autorizados.
- Finalidade, zona, segmento residencial/comercial, status e estado de publicação.
- View pública `property_catalog` para simplificar o catálogo.

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure apenas localmente:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WHATSAPP_DEFAULT=
```

Nunca commitar credenciais ou chaves privadas.

## Banco de dados

As migrations ficam em `supabase/migrations/` e devem ser aplicadas em ordem. Elas criam o esquema inicial, papéis e políticas, storage, catálogo público, idempotência das fotos e campos adicionais de publicação/segmento.

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
