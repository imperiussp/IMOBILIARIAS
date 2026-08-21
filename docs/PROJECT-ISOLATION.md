# Isolamento do projeto IMOBILIARIAS

Este repositório é exclusivo do sistema IMOBILIARIAS.

## Regra principal

Nunca reutilizar banco, URL, chave, bucket, tabela, usuário técnico, domínio, webhook ou configuração pertencente a outro projeto.

Projetos que NÃO podem ser usados aqui incluem, entre outros:

- MOTO-CONNECT
- LENOY
- LÊ+
- sistemas clínicos
- qualquer outro repositório ou Supabase existente

## Antes de conectar o Supabase

Confirmar os três pontos abaixo:

1. O projeto no painel do Supabase se chama **IMOBILIARIAS**.
2. A URL usada em `NEXT_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_URL` pertence a esse projeto.
3. A chave pública usada em `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` foi copiada desse mesmo projeto.

Se qualquer um desses pontos não puder ser confirmado, interromper a configuração e não aplicar migrations.

## Banco

As migrations em `supabase/migrations/` devem ser aplicadas somente ao projeto Supabase IMOBILIARIAS.

Nunca executar estas migrations em outro projeto.

## Storage

O bucket `property-photos` pertence exclusivamente ao IMOBILIARIAS.

## Autenticação

Usuários, administradores e corretores do IMOBILIARIAS devem existir no Auth do projeto IMOBILIARIAS. Não compartilhar usuários técnicos com outros sistemas.

## Publicação

As variáveis de ambiente do site e do aplicativo devem apontar para o mesmo Supabase IMOBILIARIAS e nunca para ambientes de outros produtos.

## Verificação rápida

Antes de qualquer integração real, conferir:

- repositório: `imperiussp/IMOBILIARIAS`;
- projeto Supabase: `IMOBILIARIAS`;
- bucket: `property-photos`;
- variáveis com prefixos `NEXT_PUBLIC_SUPABASE_` e `EXPO_PUBLIC_SUPABASE_` pertencendo ao mesmo projeto.
