# Fechamento da etapa técnica de homologação

Data: 23/08/2026

## Escopo encerrado nesta etapa

A aplicação web está publicada em rota paralela de homologação na Netlify, sem remover a compatibilidade existente com a Vercel.

Estado confirmado:

- Supabase exclusivo: `rvjsonspplqelktzwusu`.
- `project_identity()` retorna `IMOBILIARIAS`.
- `environment_mode=homologation`.
- catálogo público habilitado.
- novos cadastros públicos desabilitados.
- cobrança real desabilitada.
- mensageria externa desabilitada.
- IA real desabilitada.
- push desabilitado.
- manutenção global desabilitada.
- 0 tabelas públicas sem RLS.
- 0 grupos de policies permissivas duplicadas.
- migrations aplicadas até `0152_platform_domain_verification_consistency`.
- teste estrutural não destrutivo aprovado.
- agendador `platform-maintenance` com execuções recentes `success=true` e 0 tarefas com falha.
- host temporário `lenoy-imobiliarias.netlify.app` vinculado somente à agência de demonstração.
- host temporário validado publicamente em navegação anônima.

## Código consolidado

O pacote de homologação inclui:

- proteção do RPC de normalização de capa de foto contra acesso cruzado entre tenants;
- conclusão conservadora de índices de FK prioritários;
- consistência automática do status de verificação dos subdomínios de plataforma;
- rascunhos móveis isolados por usuário + imobiliária;
- fila offline impedida de sincronizar tenant divergente;
- busca de tipo de imóvel limitada ao tipo global ou ao tenant ativo;
- recursos pagos do app móvel em modo fail-closed;
- App do Corretor disponível somente quando o snapshot do plano confirma `broker_app=true`;
- suíte estrutural de regressão sem INSERT/UPDATE/DELETE de dados de tenant;
- `/api/health` compatível com identidade de build da Vercel e da Netlify.

## Hospedagem

### Netlify

Rota de homologação operacional:

`https://lenoy-imobiliarias.netlify.app`

A Netlify recebe a branch `main` e publica o app Next.js localizado em `apps/web`.

### Vercel

A Vercel permanece preservada como rota suportada. Não remover `apps/web/vercel.json` nem a configuração do projeto oficial `lenoy-imobiliarias`.

Antes de voltar a depender da Vercel para produção, eliminar o gatilho/status legado `Vercel – imobiliarias`, pois o repositório ainda registra dois checks Vercel para o mesmo commit.

## Próxima etapa: domínio e smoke final

Esta etapa técnica termina antes da troca de DNS.

Próximas ações deliberadas:

1. adicionar `imoveis.lenoy.com.br` à hospedagem escolhida;
2. obter a instrução DNS exata do provedor;
3. alterar somente o registro necessário;
4. aguardar HTTPS válido;
5. executar smoke pós-deploy em `/`, `/login`, `/cadastro`, `/imovel`, `/admin`, `/api/health` e `/robots.txt`;
6. registrar a release somente depois do smoke aprovado;
7. manter rollback simples para a hospedagem anterior;
8. continuar com `NEXT_PUBLIC_ALLOW_INDEXING=false` enquanto o lançamento comercial não for autorizado.

## Pendências de go-live comercial que não bloqueiam o encerramento desta homologação

- habilitar Leaked Password Protection no Supabase Auth antes da produção comercial;
- validar integrações comerciais uma por vez antes de liberar os gates;
- completar smoke no domínio canônico depois da troca de DNS;
- eliminar a integração Vercel duplicada antes de usar a Vercel como hospedagem principal novamente.

Nenhum gate comercial deve ser ligado como consequência automática da troca de hospedagem ou DNS.
