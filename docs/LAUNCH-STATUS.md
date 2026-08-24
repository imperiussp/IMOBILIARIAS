# LENOY IMOBILIÁRIAS — Status de lançamento

Atualizado em 23/08/2026.

## Estado atual

O projeto permanece em **homologação**, com aplicação web publicada e acessível em `https://imoveis.lenoy.com.br`. O lançamento comercial ainda não deve ser ativado: os gates de produção e integrações externas permanecem deliberadamente fechados até a conclusão das últimas evidências funcionais.

## Concluído e comprovado

- Supabase exclusivo do **IMOBILIÁRIAS**: `rvjsonspplqelktzwusu`, região `sa-east-1`.
- `project_identity() = 'IMOBILIARIAS'` confirmado.
- Migrations aplicadas e repositório alinhado até `0155_fix_property_storage_insert_policy_alias.sql`.
- 17 Edge Functions previstas no projeto implantadas.
- Ambiente continua em `homologation`; cadastro comercial, cobrança real, mensageria externa, IA e push permanecem bloqueados pelos gates.
- Catálogo público liberado somente para homologação visual.
- Web publicada em host real e domínio `imoveis.lenoy.com.br` resolvendo para a aplicação.
- HTTPS/TLS válido no domínio, com certificado emitido e acesso confirmado também em janela anônima/outro navegador.
- Tipos globais padrão de imóvel semeados e disponíveis no formulário administrativo.
- Criação de imóvel exercitada no painel real.
- Upload de foto/Storage exercitado no painel real após correção da policy de Storage da migration `0155`.
- Rotina de manutenção segura configurada e com execução bem-sucedida observada em homologação.
- Hardening de RLS concluído sem avisos `auth_rls_initplan` e sem `multiple_permissive_policies` no estado auditado.
- Backup operacional lógico concluído com sucesso pelo GitHub Actions: dados, Storage e migrations preservados; evidência em `docs/BACKUP-STATUS.md`.
- O backup não depende mais de senha de Postgres/pooler; utiliza a chave secreta de servidor do projeto e gera artefato de retenção no GitHub Actions.
- Isolamento multi-imobiliária validado diretamente sob papel `authenticated` com as contas de homologação: leitura cruzada de vínculos bloqueada nos dois sentidos, imóvel da imobiliária `teste` invisível para `homologacao-b`, tentativa de UPDATE cruzado retornando zero linhas e objetos do bucket `property-photos` do tenant `teste` invisíveis para a outra imobiliária. Os testes de escrita foram executados dentro de transação com rollback.

## Autenticação — estado do código

O fluxo está implementado no web:

- login por e-mail/senha;
- link **Esqueci minha senha**;
- envio de recuperação pelo Supabase Auth para `/nova-senha/`;
- validação da sessão de recuperação;
- criação e confirmação de nova senha;
- logout automático após a troca;
- novo login obrigatório;
- bloqueio de backend que não seja o projeto IMOBILIÁRIAS;
- sanitização de redirecionamentos do login.

Falta somente a **evidência funcional real ponta a ponta**: solicitar um e-mail de recuperação em `imoveis.lenoy.com.br`, abrir o link recebido, trocar a senha e autenticar novamente.

## Bloqueadores reais restantes para fechar a homologação

1. Teste ponta a ponta de login/sessão/recuperação de senha no domínio real.
2. Smoke final do deploy, incluindo `/api/health`, identidade do projeto e identificação inequívoca do commit/build servido.
3. Revisão funcional consolidada das permissões administrativas/corretor e CRM que ainda não tenham evidência manual registrada.
4. Habilitar **Leaked Password Protection** no Supabase Auth antes de produção.
5. Registrar a release de homologação e o smoke como `passed` somente depois dos testes reais.
6. Manter InfinitePay, Meta/WhatsApp, Resend, IA e Push desligados até ativação comercial deliberada.

## Não são mais bloqueadores

Os itens abaixo já foram concluídos e não devem voltar para a fila como se estivessem pendentes:

- publicação inicial da aplicação;
- DNS de `imoveis.lenoy.com.br`;
- HTTPS/TLS;
- seed dos tipos de imóvel;
- correção de gravação de imóvel;
- correção do upload de foto/Storage;
- rotina de manutenção segura;
- implantação das Edge Functions;
- backup operacional do Supabase;
- isolamento multi-imobiliária de leitura, escrita cruzada e Storage.

## Regra para produção

O ambiente não deve ser promovido para `production` enquanto faltar qualquer evidência obrigatória de segurança, isolamento, smoke ou autenticação. Os gates de banco existentes devem continuar sendo respeitados; não contornar validações apenas para antecipar o lançamento.

## Separação de projetos

Nenhuma migration, Edge Function, chave, bucket, usuário administrativo ou configuração do IMOBILIÁRIAS deve ser aplicada ao Moto Connect, LENOY Match, Lê+ ou qualquer outro projeto.
