# Validação de restauração do backup — 2026-08-24

Fonte: artefato `imobiliarias-supabase-backup-32684824030`
Run GitHub Actions: `32684824030`
Commit do backup: `863db1811064e4350c57d96b22ab1ea14ceb4c9a`

## Integridade

- `SHA256SUMS.txt`: 100% aprovado.
- Migrations: checksums aprovados até `0155_fix_property_storage_insert_policy_alias.sql`.
- Storage: 2/2 objetos presentes e com checksum aprovado.

## Restore lógico descartável

O conteúdo exportado foi importado em banco local descartável para validar restaurabilidade lógica, sem tocar no Supabase de homologação.

Resultado:

- 87 tabelas/visões exportadas importadas.
- 141 registros restaurados.
- 2 usuários Auth restaurados como payload de validação.
- Nenhuma divergência de contagem entre export e restore.
- Nenhuma relação-chave quebrada em `agencies`, `agency_memberships`, `agency_domains`, `agency_subscriptions`, `properties`, `property_photos`, `cities` e `property_types`.
- Todos os caminhos de `property_photos.storage_path` e `thumbnail_path` localizaram os respectivos arquivos no backup de Storage.

## Limitação conhecida

Esta rodada comprova integridade e restaurabilidade lógica do artefato. Não foi possível subir um servidor PostgreSQL descartável dentro do limite de execução do ambiente local. Portanto, um restore PostgreSQL integral em ambiente separado continua recomendado como evidência final antes do go-live comercial.
