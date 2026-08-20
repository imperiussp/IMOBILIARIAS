# IMOBILIARIAS

Plataforma imobiliária composta por site público, painel administrativo e aplicativo para corretores.

## Arquitetura inicial

- **Web e painel:** Next.js + TypeScript
- **Aplicativo:** Expo / React Native + TypeScript
- **Backend, autenticação, banco e storage:** Supabase
- **Monorepo:** pnpm workspaces
- **Offline mobile:** armazenamento local + fila de sincronização resiliente

## Objetivos principais

- Vitrine pública de imóveis para venda e locação.
- Filtros por cidade, bairro, tipo, finalidade, zona, preço e características.
- Página individual do imóvel com galeria e contato por WhatsApp.
- Painel administrativo para imóveis, corretores, usuários e contatos.
- Aplicativo para corretores com cadastro, fotos e funcionamento offline.
- Sincronização automática e idempotente quando a internet retornar.

## Regras do projeto

1. Novas funcionalidades são aditivas: preservar o que já funciona.
2. Não remover ou substituir funcionalidades sem pedido explícito.
3. Não expor segredos no repositório.
4. Variáveis sensíveis ficam em `.env`; `.env.example` contém apenas nomes e exemplos seguros.
5. Corrigir causas reais, evitando alterações especulativas e retrabalho desnecessário.
6. Site, painel e aplicativo devem compartilhar os mesmos dados e regras de domínio.

## Estrutura prevista

```text
apps/
  web/       # site público + painel administrativo
  mobile/    # aplicativo dos corretores
packages/
  shared/    # tipos, validações e regras compartilhadas
supabase/
  migrations/
  seed/
```

A estrutura será expandida progressivamente sem perder funcionalidades existentes.
