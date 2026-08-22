# LENOY IMOBILIÁRIAS — Status de lançamento

Atualizado em 22/08/2026.

## Estado atual

O código entrou em **launch-ready hardening**. Ainda não considerar o produto em produção enquanto infraestrutura e homologação real não forem concluídas.

## Concluído no código

- Identidade visual premium V3 aplicada à plataforma e ao site público das imobiliárias.
- Catálogo, filtros, favoritos, detalhe de imóvel e administração preservados.
- App com fila offline, drafts, câmera/galeria, limite de 20 fotos e sincronização protegidos contra alterações agressivas nesta fase.
- Guard de Supabase exclusivo do IMOBILIÁRIAS.
- Contrato de ambiente com proteção contra segredos públicos.
- Migrations de release/security preparadas até `0129`.
- Health `/api/health` com identidade, project ref, commit SHA e build label.
- Smoke pós-deploy capaz de exigir o SHA exato implantado.
- Registro de releases gravável, sem exclusão na UI, com smoke/ativa/rollback controlados.
- `pnpm release:validate` reúne os checks críticos de pré-lançamento.
- CI do `main` executa o mesmo `release:validate` e injeta SHA/build label do run.
- Runbook, homologação, go-live e pós-deploy atualizados para migrations até `0129`.
- Verificador do kit de homologação exige documentos atuais, `release:validate`, build identity e smoke com SHA.

## Infraestrutura Supabase

Na conta conectada foi encontrada somente a organização `imperiussp` e somente o projeto existente `MOTO-CONNECT`.

O projeto `MOTO-CONNECT` permanece intocado e não deve receber nenhuma migration, Edge Function ou credencial do IMOBILIÁRIAS.

O custo retornado pelo Supabase para criar um novo projeto na organização `imperiussp` foi **0 por mês**. A criação ainda depende da confirmação explícita do usuário exigida pelo provedor após a apresentação do custo.

## Bloqueador crítico atual

Criar o projeto Supabase exclusivo `IMOBILIARIAS`.

Depois disso, a sequência é:

1. confirmar project ref e URL exclusivos;
2. configurar variáveis do web/app/backend;
3. executar `pnpm supabase:guard`;
4. aplicar migrations em ordem até `0129`;
5. confirmar `project_identity() = 'IMOBILIARIAS'`;
6. rodar advisors de segurança e performance;
7. configurar Auth/Storage e Edge Functions necessárias;
8. publicar homologação Next.js com commit SHA/build label;
9. configurar DNS/TLS de `imoveis.lenoy.com.br`;
10. executar smoke exigindo o commit exato;
11. criar duas imobiliárias e executar tenant isolation;
12. executar testes funcionais/E2E;
13. registrar evidências, checkpoints e release de homologação;
14. validar backup e rollback;
15. promover para produção somente com todos os gates satisfeitos.

## Regra de segurança

Nenhuma migration, Edge Function, credencial ou configuração do IMOBILIÁRIAS deve ser aplicada ao Supabase `MOTO-CONNECT` ou a qualquer outro projeto existente.
