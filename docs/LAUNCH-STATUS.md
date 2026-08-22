# LENOY IMOBILIÁRIAS — Status de lançamento

Atualizado em 22/08/2026.

## Estado atual

O código está em fase de **release hardening**. Não considerar o produto em produção até que todos os bloqueios de infraestrutura e homologação abaixo estejam concluídos.

## Concluído no código

- Identidade visual premium V3 aplicada à plataforma e ao site público das imobiliárias.
- Rotas públicas, catálogo, filtros, favoritos, detalhe do imóvel, painel administrativo e experiência demonstrativa do app preservados.
- Guard de projeto Supabase exclusivo do IMOBILIÁRIAS.
- Contrato de variáveis de ambiente com bloqueio de segredos públicos.
- RLS, gates de runtime, migrations de segurança e auditoria de tenants preparadas.
- Health check `/api/health` com identidade do projeto, project ref, commit SHA e build label.
- Smoke test pós-deploy com validação opcional do commit esperado.
- Registro operacional de releases com smoke, release ativa e candidato a rollback; exclusão não é oferecida pela UI.
- Checklist de pós-deploy, rollback, homologação e go-live presentes no repositório.
- Verificador de homologação exige `POST-DEPLOY-CHECKLIST.md` e migration `0123`.
- Comando único `pnpm release:validate` para executar os principais checks de pré-lançamento.

## Bloqueador crítico atual

**Ainda não existe um projeto Supabase exclusivo do IMOBILIÁRIAS na conta conectada.**

Foi encontrado somente o projeto `MOTO-CONNECT`. Ele não deve ser reutilizado, alterado ou receber migrations do IMOBILIÁRIAS.

## Próxima sequência obrigatória

1. Criar projeto Supabase exclusivo `IMOBILIARIAS` na organização autorizada.
2. Confirmar project ref e URL exclusivos.
3. Preencher variáveis de ambiente do IMOBILIÁRIAS sem copiar segredos de outros projetos.
4. Executar o guard de destino Supabase.
5. Aplicar migrations em ordem e verificar `project_identity = 'IMOBILIARIAS'`.
6. Rodar advisors de segurança e performance.
7. Configurar Auth, Storage e Edge Functions do próprio projeto.
8. Publicar ambiente de homologação web.
9. Configurar DNS/TLS para `imoveis.lenoy.com.br`.
10. Executar `pnpm release:validate`, testes de isolamento entre tenants e smoke pós-deploy.
11. Registrar release de homologação e marcar `smoke_status=passed` somente após validação real.
12. Fazer E2E de cadastro, login, imóveis, fotos, leads, WhatsApp, app offline/sync e pagamentos habilitados.
13. Liberar indexação e integrações externas somente na etapa de produção, uma a uma.
14. Executar checklist final, backup e promoção para produção.

## Regra de segurança

Nenhuma migration, Edge Function, credencial ou configuração do IMOBILIÁRIAS deve ser aplicada ao projeto Supabase `MOTO-CONNECT` ou a qualquer outro projeto existente.
