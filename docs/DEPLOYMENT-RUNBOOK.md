# Runbook de implantação — LENOY IMOBILIÁRIAS

Este runbook existe para colocar o sistema na rede primeiro em homologação, mantendo cobrança, mensageria, IA, push e indexação bloqueados até decisão explícita.

## 1. Pré-condição obrigatória

Use um projeto Supabase exclusivo do IMOBILIARIAS.

Antes de qualquer migration/deploy de banco, configure no ambiente local/CI autorizado:

- `IMOBILIARIAS_SUPABASE_PROJECT_REF`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`

Execute `pnpm supabase:guard`. O guard bloqueia se project refs divergirem ou se web/app/backend apontarem para outro projeto Supabase.

## 2. Validações do repositório

Antes de implantar:

- `pnpm env:contract`
- `pnpm migration:safety`
- `pnpm edge:guards`
- typecheck web
- build web
- typecheck mobile

O workflow de CI já executa essas validações em push/PR. Não considerar um commit homologável sem resultado verde do workflow ou validação equivalente executada no ambiente de implantação.

## 3. Estado seguro de homologação

Após aplicar as migrations, confirme em `platform_release_controls`:

- `environment_mode = homologation`
- `maintenance_mode = false`
- `new_registrations_enabled = false`
- `real_billing_enabled = false`
- `external_messaging_enabled = false`
- `ai_generation_enabled = false`
- `push_notifications_enabled = false`

O catálogo pode permanecer ligado para testes controlados. Se a vitrine não puder ficar visível, desligue `public_catalog_enabled`.

## 4. Banco de dados

1. Aplicar todas as migrations em ordem, até a migration mais recente do repositório.
2. Executar `select public.project_identity();` e confirmar retorno `IMOBILIARIAS`.
3. Abrir a administração global e verificar:
   - Pré-voo;
   - Auditoria de isolamento entre clientes;
   - Checklist para colocar na rede;
   - Checklist real de homologação.
4. Marcar `migrations_applied` e `supabase_identity_checked` somente depois da confirmação real.

## 5. Backend / Edge Functions

Implantar somente no Supabase exclusivo do IMOBILIARIAS.

Endpoints com `verify_jwt=false` permanecem protegidos pela assinatura/secret próprio. Não publicar função privilegiada se o secret correspondente ainda não estiver configurado.

Para a primeira homologação, priorize as funções necessárias para login, operação do painel e manutenção. Meta, Resend, InfinitePay e IA podem continuar sem credenciais enquanto seus gates globais estiverem OFF.

Depois do deploy, marque `edge_functions_deployed` somente após confirmar que as funções necessárias respondem no projeto correto.

## 6. Aplicação web

Configurar pelo menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_PLATFORM_HOST=imoveis.lenoy.com.br`
- `NEXT_PUBLIC_SITE_URL=https://imoveis.lenoy.com.br`
- `NEXT_PUBLIC_ALLOW_INDEXING=false`

Publicar a aplicação Next.js. Não considerar GitHub Pages como deploy real da aplicação.

Após abrir a aplicação publicada e confirmar que o painel carrega, marcar `web_deployed`.

## 7. DNS e HTTPS

Apontar `imoveis.lenoy.com.br` para o host escolhido.

Confirmar:

- resolução DNS correta;
- certificado HTTPS válido;
- redirecionamento HTTP → HTTPS, quando aplicável;
- ausência de erro de certificado;
- aplicação carregando pelo hostname oficial.

Somente então marcar:

- `platform_domain_pointed`;
- `tls_valid`.

## 8. SEO em homologação

Confirmar `NEXT_PUBLIC_ALLOW_INDEXING=false`.

Validar que:

- `robots.txt` bloqueia indexação;
- sitemap não publica URLs para indexação;
- metadata não contradiz o bloqueio.

Depois marcar `seo_blocked_homologation`.

## 9. Cron / manutenção

Configurar um cron seguro para `platform-maintenance`, usando `PLATFORM_MAINTENANCE_SECRET`.

Confirmar pelo menos uma execução com `success=true` em `platform_maintenance_runs`.

Depois marcar:

- `maintenance_cron_configured`;
- `maintenance_success_verified`.

## 10. Teste multi-imobiliária

Criar duas imobiliárias de teste e duas contas independentes.

Executar o cenário de `supabase/tests/tenant-isolation-regression.sql` e validar manualmente no web/app que:

- uma imobiliária não lê dados privados da outra;
- INSERT/UPDATE/DELETE fora do tenant são recusados;
- fotos respeitam o tenant herdado pelo imóvel;
- corretor vinculado a mais de uma imobiliária não mistura contexto.

Registrar a evidência correspondente em `platform_release_validations`.

## 11. Testes funcionais mínimos

Antes de considerar a homologação online concluída, validar e registrar:

- login/sessão/recuperação de senha;
- CRUD de imóvel;
- fotos, capa e ordenação;
- catálogo público;
- lead e CRM;
- permissões admin/corretor;
- documentos;
- app e sincronização offline quando fizer parte do escopo testado;
- backup e recuperação.

## 12. Integrações externas

Ativar uma por vez, somente com dados controlados:

- InfinitePay;
- Meta/WhatsApp;
- Resend;
- IA;
- push.

Depois de cada teste, se o lançamento ainda não ocorrer, voltar o gate correspondente para OFF.

## 13. Promoção para produção

A mudança para `production` é protegida no banco. Ela é recusada se faltarem critérios obrigatórios de manutenção, segurança multi-tenant, evidências funcionais ou checkpoints de implantação.

Antes da promoção:

1. revisar Pré-voo V4;
2. revisar Checklist para colocar na rede;
3. revisar Auditoria de isolamento;
4. revisar Checklist real de homologação;
5. revisar Saúde da plataforma;
6. registrar release label e release notes completas;
7. confirmar backup e recuperação;
8. confirmar zero bloqueios obrigatórios.

Somente no lançamento público deliberado habilitar `NEXT_PUBLIC_ALLOW_INDEXING=true`.
