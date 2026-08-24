# Evidência de isolamento multi-imobiliária

Data: 2026-08-24
Ambiente: homologation
Projeto Supabase: rvjsonspplqelktzwusu

## Resultado

Teste executado em transações controladas com `ROLLBACK`, sem persistir dados de teste.

- Usuário A não leu imóvel privado (`draft`) da imobiliária B.
- UPDATE cruzado A → B afetou 0 linhas.
- DELETE cruzado A → B afetou 0 linhas.
- INSERT de imóvel de A no tenant B foi recusado por RLS.
- Upload de objeto no Storage de A para o caminho de propriedade da imobiliária B foi recusado por RLS.
- Cenário de usuário com múltiplas imobiliárias validado: owner em A + broker em B manteve os papéis separados, sem privilégio administrativo indevido em B.
- Com o mesmo usuário vinculado a A e B, imóvel privado de uma terceira imobiliária C permaneceu invisível.

## Conclusão

O isolamento multi-tenant de leitura privada, escrita, exclusão, inserção e Storage foi aprovado na homologação. O contexto de papéis owner/broker entre múltiplas imobiliárias permaneceu segregado.
