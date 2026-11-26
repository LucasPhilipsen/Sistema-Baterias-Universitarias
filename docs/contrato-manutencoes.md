# Contrato de manutenção de instrumentos — SCRUM-57

A diretoria abre e encerra uma manutenção por unidade física. A abertura retira a unidade do estoque disponível. O encerramento libera a unidade e preserva o registro no histórico.

## Modelagem

A migração [`008-criar-manutencoes.sql`](../database/008-criar-manutencoes.sql) cria a tabela `manutencoes`.

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `integer` | Chave primária gerada pelo banco |
| `instrumento_id` | `integer` | Referência obrigatória a `instrumentos.id`. A exclusão física de unidades com histórico é bloqueada |
| `motivo` | `varchar(500)` | Texto obrigatório, de 1 a 500 caracteres após aparar as extremidades |
| `aberta_em` | `timestamptz` | Instante da abertura, gerado pelo banco |
| `encerrada_em` | `timestamptz` | Nulo enquanto aberta. Quando preenchido, deve ser igual ou posterior à abertura |

O índice único parcial em `instrumento_id` garante no máximo uma manutenção aberta por unidade. A unidade pode acumular manutenções encerradas. A situação atual da unidade continua em `instrumentos.situacao`.

## Rotas

Todas as rotas exigem sessão ativa e perfil `DIRETORIA`. As gravações exigem JSON da mesma origem. Os identificadores na URL contêm apenas dígitos e representam inteiros entre 1 e 2147483647. As rotas recusam parâmetros de consulta, e as gravações aceitam somente o corpo indicado.

| Método e caminho | Corpo | Resposta de sucesso |
| --- | --- | --- |
| `GET /api/instrumentos/:instrumentoId/manutencoes` | Sem corpo | `200` com `{ "manutencoes": [...] }`, por `abertaEm` e `id` decrescentes. Unidade existente sem histórico retorna lista vazia |
| `POST /api/instrumentos/:instrumentoId/manutencoes` | `{ "motivo": "Trocar a pele" }` | `201` com `{ "manutencao": {...} }` |
| `PUT /api/instrumentos/:instrumentoId/manutencoes/:manutencaoId/encerramento` | `{}` | `200` com `{ "manutencao": {...} }`. Repetir devolve o registro com a data original |

O motivo deve ser uma string. Após aplicar `trim()`, valide o limite de caracteres Unicode e rejeite resultado vazio ou caractere nulo (`\u0000`). O servidor define identificadores, datas e situação.

Exemplo de item em `manutencao` ou `manutencoes`:

```json
{
  "id": 8,
  "instrumentoId": 4,
  "motivo": "Trocar a pele",
  "abertaEm": "2026-11-27T20:30:00.000Z",
  "encerradaEm": null,
  "situacao": "ABERTA"
}
```

Após o encerramento, `encerradaEm` recebe um instante e a situação do registro passa a `ENCERRADA`. As datas da API usam ISO 8601 UTC com `Z`. A interface exibe as datas em `America/Sao_Paulo`.

### Erros

Usar o formato `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | ID, corpo ou parâmetro fora do contrato |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, expirada ou revogada |
| `403` | `ACESSO_NEGADO` | Sessão sem perfil de diretoria |
| `403` | `ORIGEM_INVALIDA` | Gravação a partir de origem incompatível |
| `404` | `INSTRUMENTO_NAO_ENCONTRADO` | Unidade inexistente |
| `404` | `MANUTENCAO_NAO_ENCONTRADA` | A unidade existe, mas o registro informado não pertence a ela ou não existe |
| `409` | `INSTRUMENTO_INDISPONIVEL` | Unidade incompatível com a operação ou manutenção já aberta na tentativa de abertura |
| `415` | `JSON_OBRIGATORIO` | Gravação sem `Content-Type: application/json` |

## Integração com estoque e empréstimos

- **Abertura.** Abra a transação e bloqueie a linha de `instrumentos` com `SELECT ... FOR UPDATE`. Confira que a unidade está `DISPONIVEL` e sem empréstimo ativo. Insira a manutenção, registrando o horário após o bloqueio, e mude a unidade para `EM_MANUTENCAO` na mesma transação. Converta uma violação do índice de manutenção aberta em `409 INSTRUMENTO_INDISPONIVEL`.
- **Encerramento.** Bloqueie primeiro a mesma linha da unidade e depois leia e bloqueie o registro de manutenção dessa unidade. Se já estiver encerrado, devolva o registro sem atualizar a unidade, inclusive se ela tiver sido emprestada ou tiver entrado em outra manutenção depois. Para um registro aberto, confirme que a unidade está `EM_MANUTENCAO` e sem empréstimo ativo. Preencha `encerrada_em` com `GREATEST(aberta_em, clock_timestamp())` e libere a unidade para `DISPONIVEL` na mesma transação.
- **Concorrência.** A retirada de empréstimo e a edição do tipo no estoque usam o mesmo bloqueio na unidade. Se a abertura for confirmada primeiro, a retirada recusa a unidade em manutenção. Se a retirada for confirmada primeiro, a abertura recusa a unidade emprestada. Em caso de falha, a transação reverte tanto o histórico quanto a mudança de situação.
- **Disponibilidade.** Estoque e painel de demanda já contam apenas unidades `DISPONIVEL` como disponíveis. Depois da transação, a próxima consulta reflete a situação gravada.

## Integração com a interface

A diretoria abre o histórico a partir do ID de uma unidade retornada pela API de instrumentos. Use `session.request()` para consultar, abrir e encerrar. Mostre a ação de abrir para unidade disponível e a de encerrar para a manutenção aberta retornada pela API. Após sucesso, consulte novamente o histórico, a unidade e o resumo de estoque. Em caso de `409`, mostre a mensagem e atualize as consultas para refletir a operação concorrente.

Lucas implementa a API na [SCRUM-58](https://pds20262-g14.atlassian.net/browse/SCRUM-58). Pedro usa o contrato na [SCRUM-59](https://pds20262-g14.atlassian.net/browse/SCRUM-59). Felipe confere histórico, empréstimos, concorrência e disponibilidade na [SCRUM-60](https://pds20262-g14.atlassian.net/browse/SCRUM-60).
