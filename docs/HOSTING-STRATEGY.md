# Estratégia de hospedagem

## Estado atual

- A aplicação web continua compatível com Vercel. O arquivo `apps/web/vercel.json`, o root `apps/web` e a integração existente não devem ser removidos.
- A Netlify foi adicionada como rota paralela de hospedagem para homologação e continuidade operacional durante o limite de builds da Vercel.
- O repositório fonte continua sendo `imperiussp/IMOBILIARIAS`, branch `main`.
- O app web continua em `apps/web`, usando Next.js e pnpm.
- O Supabase permanece no projeto exclusivo do IMOBILIARIAS (`rvjsonspplqelktzwusu`). A mudança de hospedagem web não altera o banco.

## Netlify

Projeto: `lenoy-imobiliarias`

Configuração usada no primeiro deploy:

- Project to deploy: `apps/web`
- Branch: `main`
- Build: pacote `@imobiliarias/web`
- Publish: `apps/web/.next`
- URL temporária de homologação: `https://lenoy-imobiliarias.netlify.app`

A URL temporária foi vinculada à agência de demonstração apenas para homologação. Ela não substitui o domínio canônico da plataforma.

## Vercel

A Vercel permanece preparada como rota suportada. Não remover:

- `apps/web/vercel.json`
- vínculo do projeto oficial `lenoy-imobiliarias`
- configuração de root `apps/web`

Existe histórico de dois status checks Vercel para o mesmo repositório (`Vercel – lenoy-imobiliarias` e `Vercel – imobiliarias`). Antes de voltar a depender da Vercel para produção, eliminar o gatilho legado/duplicado para evitar consumo duplicado de builds.

## Domínio canônico

O domínio planejado continua:

`https://imoveis.lenoy.com.br`

Não alterar DNS para a nova hospedagem até o build, catálogo, autenticação, painel, rotas dinâmicas e smoke tests estarem validados. A troca de DNS deve ser a última etapa e deve manter rollback simples para a hospedagem anterior.
