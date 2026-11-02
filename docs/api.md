# API inicial

Contrato legível por ferramentas: [openapi.json](openapi.json). Ele é a fonte do contrato HTTP inicial e deve ser atualizado junto com as rotas.

## GET /api/health

Sem autenticação e sem parâmetros. Retorna HTTP 200 com:

```json
{ "status": "ok", "service": "baterias-api" }
```

Confirma que o processo HTTP responde. Não testa o banco nem anuncia disponibilidade das funcionalidades. Para banco, usar `npm run db:check`.

## Erros da base

- Rota inexistente: HTTP 404, código `NOT_FOUND`.
- Corpo JSON malformado: HTTP 400, código `INVALID_JSON`.
- Corpo JSON acima de 100 KB: HTTP 413, código `PAYLOAD_TOO_LARGE`.
- Falha interna não tratada: HTTP 500, código `INTERNAL_ERROR`, sem detalhes internos na resposta.

Formato:

```json
{ "error": { "code": "NOT_FOUND", "message": "Rota não encontrada." } }
```

Ainda não há endpoints de login, integrantes, ensaios, estoque, movimentações ou dashboard. Seus contratos serão definidos com as histórias correspondentes do Jira.
