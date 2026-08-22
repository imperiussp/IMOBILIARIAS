# Homologação e colocação na rede — LENOY IMOBILIÁRIAS

Este documento descreve como colocar o IMOBILIARIAS na rede para testes sem transformar o ambiente em lançamento comercial por acidente.

## Regra principal

Use somente um projeto Supabase exclusivo do IMOBILIARIAS. Não reutilize URL, chaves, banco, storage, usuários administrativos ou secrets de Moto Connect, Lê+, LENOY Match, RM Agenda ou qualquer outro sistema.

## Estado seguro padrão

A migration `0109_platform_release_controls.sql` cria o ambiente inicialmente em `homologation` com:

- catálogo público: ligado;
- novos cadastros de imobiliárias: desligados;
- cobrança real: desligada;
- mensageria externa: desligada;
- IA real: desligada;
- modo manutenção: desligado.

Esse estado permite testar painel, tenants, catálogo, imóveis, corretores, CRM, documentos e navegação sem gerar cobrança, mensagens automáticas ou consumo de IA externa.

## Freios implementados

### Cadastro

`platform_registration_status()` expõe somente o estado mínimo necessário. O formulário de cadastro consulta esse status ao abrir e novamente antes de `signUp`. Convites para membros de imobiliárias existentes continuam permitidos durante homologação.

### Catálogo público

`platform_public_catalog_status()` permite pausar todas as vitrines de tenants sem apagar imóveis ou bloquear o painel administrativo.

### Cobrança

`create-infinitepay-checkout` recusa criação de checkout enquanto `real_billing_enabled=false` ou quando `maintenance_mode=true`.

### Mensageria

`process-buyer-opportunities` e `deliver-buyer-outreach` consultam o controle global. O segundo bloqueio é proposital: mesmo uma chamada direta ao adaptador não deve contornar o modo de homologação.

### Inteligência artificial

`process-buyer-opportunities`, `generate-property-description` e `generate-buyer-opportunity-message` recusam chamadas reais a provedores quando `ai_generation_enabled=false`.

## Diagnóstico pré-voo

A migration `0110_platform_homologation_readiness.sql` cria a view `platform_homologation_readiness`.

O painel global mostra:

- bloqueios obrigatórios;
- recomendações pendentes;
- percentual de itens aprovados;
- manutenção recente;
- eventos de provedores atrasados;
- falhas financeiras;
- domínios personalizados pendentes.

O diagnóstico não executa deploy, não aplica migrations e não ativa serviços.

## Histórico de alterações

`platform_release_control_history` guarda alterações dos controles globais. O painel **Histórico do ambiente** mostra as alterações mais recentes. A migration `0112_release_control_history_indexes.sql` mantém essa consulta eficiente conforme o histórico cresce.

## Ordem recomendada para primeira homologação online

1. Criar e confirmar um Supabase exclusivo para IMOBILIARIAS.
2. Aplicar todas as migrations em ordem, incluindo `0109`, `0110`, `0111` e `0112`.
3. Confirmar que o ambiente continua como `homologation`.
4. Confirmar no painel global que cobrança, mensageria externa, IA e novos cadastros estão bloqueados.
5. Configurar URL e anon key do Supabase no web e app.
6. Configurar apenas secrets indispensáveis às funções que serão testadas; não é necessário configurar Meta, Resend, InfinitePay ou IA nesta etapa.
7. Fazer deploy das Edge Functions.
8. Publicar o web no domínio de homologação/produção escolhido.
9. Configurar DNS/TLS.
10. Criar ou vincular uma imobiliária de teste administrativamente.
11. Testar login, tenant, isolamento, cadastro de corretor, imóvel, fotos, catálogo, lead, CRM, documentos e fluxo offline.
12. Ativar manutenção automática/cron e verificar o painel de Saúde da plataforma.
13. Somente depois, testar individualmente IA, mensageria e cobrança, ligando um controle global por vez.

## Antes do lançamento comercial

Não mudar diretamente de homologação para tudo ligado. A sequência recomendada é:

1. manter `environment_mode=homologation`;
2. validar IA com contatos/dados de teste;
3. validar mensageria somente com números/e-mails autorizados de teste;
4. validar checkout com uma operação controlada;
5. validar webhooks e retornos;
6. voltar os recursos sensíveis para OFF após o teste se o lançamento ainda não ocorrer;
7. conferir o Pré-voo;
8. somente então mudar para `production` e liberar os recursos comerciais deliberadamente.

## O que este repositório não faz sozinho

Ter o código pronto não significa que o ambiente esteja implantado. Ainda são ações externas deliberadas: criar Supabase, aplicar migrations, configurar secrets, fazer deploy das funções/web, apontar DNS, configurar provedores e executar testes reais.
