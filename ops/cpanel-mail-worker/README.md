# LENOY — Worker local de e-mails no cPanel

Este worker roda dentro da própria conta cPanel e processa a fila de criação de caixas de e-mail registrada no Supabase.

## Onde instalar

Instale fora do `public_html`, por exemplo:

`/home/robs4905/lenoy-mail-worker/`

Arquivos esperados:

- `mail-worker.php`
- `config.php`
- `worker.log` (criado pelo Cron)

## Configuração

Copie `config.example.php` para `config.php` e substitua somente o valor de `worker_token` pelo mesmo token ativo salvo no Secret `CPANEL_API_TOKEN` do Supabase.

Nunca publique `config.php` no GitHub e não coloque a pasta dentro de `public_html`.

Permissão recomendada para `config.php`: `0600`.

## Cron Job

Execute a cada minuto:

```sh
php -q /home/robs4905/lenoy-mail-worker/mail-worker.php >> /home/robs4905/lenoy-mail-worker/worker.log 2>&1
```

Se o comando `php` não estiver disponível no Cron, substitua pelo caminho do PHP CLI fornecido pela hospedagem.

## Teste

O worker testa primeiro o UAPI local com `Email list_pops`. Somente se o UAPI responder corretamente ele busca e processa solicitações da fila.

O painel do LENOY considera a conexão saudável quando recebeu um heartbeat do worker nos últimos 5 minutos com o UAPI local em estado `ok`.

## Segurança

- A senha da nova caixa é criptografada antes de entrar na fila.
- O worker descriptografa a senha apenas durante a criação local da conta.
- O banco remove o conteúdo criptografado depois do sucesso ou da falha.
- O worker não registra senhas no log.
- O token do worker nunca deve ficar em `public_html`.
