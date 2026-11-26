# Contrato de presença em ensaios — SCRUM-53

A diretoria registra quem compareceu a cada ensaio. A lista inclui os integrantes cadastrados, inclusive quem não confirmou participação. Registrar ou corrigir presença não altera `confirmacoes`, o cálculo de demanda prevista nem o estoque.

## Dados e regras

| Coluna em `presencas` | Tipo | Regra |
| --- | --- | --- |
| `ensaio_id` | `integer` | Referência obrigatória a `ensaios.id` |
| `usuario_id` | `integer` | Referência obrigatória a `usuarios.id`. A API aceita contas com perfil `INTEGRANTE` |
| `presente` | `boolean` | `true` para compareceu, `false` para ausência registrada |
| `registrado_em` | `timestamptz` | Instante da primeira marcação ou da última mudança do valor, gerado pelo banco |

A chave primária `(ensaio_id, usuario_id)` garante um registro por integrante e ensaio. A falta de registro representa presença ainda sem marcação. As referências impedem apagar fisicamente um ensaio ou integrante com presença registrada.

A gravação verifica o ensaio com `SELECT ... FOR SHARE` e atualiza a presença na mesma transação, seguindo a coordenação com o cancelamento usada nas confirmações. Use um `INSERT ... ON CONFLICT (ensaio_id, usuario_id) DO UPDATE` que só altere `presente` e `registrado_em` quando o valor mudar. Ao repetir o mesmo valor, devolva o registro existente. Em caso de mudança, use `clock_timestamp()` no momento da gravação.

## Rotas

As duas rotas exigem sessão ativa e perfil `DIRETORIA`. O `PUT` também exige JSON da mesma origem. Os identificadores da URL são inteiros decimais de 1 a 2147483647. Nenhuma rota recebe parâmetros de consulta.

| Método e caminho | Corpo | Resposta de sucesso |
| --- | --- | --- |
| `GET /api/ensaios/:ensaioId/presencas` | Sem corpo | `200` com `{ "presencas": [...] }` |
| `PUT /api/ensaios/:ensaioId/presencas/:integranteId` | `{ "presente": true }` ou `{ "presente": false }` | `200` com `{ "presenca": {...} }` |

O `GET` consulta os usuários com perfil `INTEGRANTE` e associa, quando houver, o registro em `presencas` para o ensaio informado. Ordene por nome e ID. Se não houver integrantes, devolva `{ "presencas": [] }`. Um ensaio cancelado continua disponível para consulta do histórico e bloqueia novas gravações.

```json
{
  "presencas": [
    {
      "integranteId": 3,
      "nome": "Ana Ribeiro",
      "presente": true,
      "registradoEm": "2026-11-27T22:15:00.000Z"
    },
    {
      "integranteId": 7,
      "nome": "Rafael Santos",
      "presente": null,
      "registradoEm": null
    }
  ]
}
```

O `PUT` aceita somente a propriedade `presente` com um booleano. Retorna o mesmo formato de item da listagem em `presenca`, com `presente` preenchido e `registradoEm` em ISO 8601 UTC. A resposta de presença contém apenas ID, nome e os dados da marcação.

## Erros

Formato da API: `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | ID inválido, consulta com parâmetros ou corpo fora do contrato |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, expirada ou revogada |
| `403` | `ACESSO_NEGADO` | Sessão sem perfil de diretoria |
| `403` | `ORIGEM_INVALIDA` | Gravação a partir de origem incompatível |
| `404` | `ENSAIO_NAO_ENCONTRADO` | O ensaio indicado não existe |
| `404` | `INTEGRANTE_NAO_ENCONTRADO` | O ID de destino não identifica uma conta com perfil `INTEGRANTE` |
| `409` | `ENSAIO_CANCELADO` | Tentativa de gravar presença em ensaio cancelado |
| `415` | `JSON_OBRIGATORIO` | Gravação sem `Content-Type: application/json` |

## Integração com a agenda

Na [SCRUM-55](https://pds20262-g14.atlassian.net/browse/SCRUM-55), a diretoria abre a lista de presença de um ensaio e distingue os estados **Presente**, **Ausente** e **Sem marcação**. Use `session.request()` e atualize a linha após a confirmação da API. O perfil de integrante continua usando a agenda e a própria participação. A API será implementada na [SCRUM-54](https://pds20262-g14.atlassian.net/browse/SCRUM-54) e o fluxo será conferido com PostgreSQL real na [SCRUM-56](https://pds20262-g14.atlassian.net/browse/SCRUM-56).
