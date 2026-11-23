# Contrato da comparação de demanda e disponibilidade — SCRUM-39

Contrato para a história [Comparar demanda e disponibilidade (SCRUM-18)](https://pds20262-g14.atlassian.net/browse/SCRUM-18). Ele orienta o cálculo no backend ([SCRUM-43](https://pds20262-g14.atlassian.net/browse/SCRUM-43), Felipe), o painel ([SCRUM-47](https://pds20262-g14.atlassian.net/browse/SCRUM-47), Pedro) e a validação integrada ([SCRUM-51](https://pds20262-g14.atlassian.net/browse/SCRUM-51), Giovani).

A comparação usa a modelagem de [confirmações (SCRUM-37)](https://pds20262-g14.atlassian.net/browse/SCRUM-37) e as regras de [empréstimos (SCRUM-38)](https://pds20262-g14.atlassian.net/browse/SCRUM-38) para interpretar a disponibilidade das unidades.

## Regra do cálculo

Para um ensaio, o resultado tem uma linha por tipo de instrumento:

| Campo | Origem |
| --- | --- |
| `confirmados` | Quantidade de confirmações do ensaio e tipo com `cancelado_em IS NULL` |
| `disponiveis` | Quantidade de unidades do tipo com situação `DISPONIVEL` no momento da consulta |
| `falta` | `max(0, confirmados - disponiveis)` |

- Unidades `EMPRESTADO` e `EM_MANUTENCAO` não contam como disponíveis, como já acontece no `GET /api/estoque`.
- Confirmações canceladas não contam. Trocar o tipo de uma confirmação ativa move a demanda para o novo tipo.
- O resultado é uma **previsão baseada no estoque atual**. Ele não reserva unidades e não prevê a disponibilidade na data do ensaio. Confirmar participação não altera `instrumentos.situacao`.
- Exemplo dos critérios de aceite: cinco confirmações ativas de Caixa e três caixas disponíveis resultam em `falta: 2`.
- Uma retirada, devolução, confirmação ou cancelamento gravados antes da consulta aparecem na próxima resposta. Não há cache nem contagem guardada em coluna.

## Rota

| Método e caminho | Proteção | Resposta de sucesso |
| --- | --- | --- |
| `GET /api/ensaios/:id/demanda` | Sessão de **diretoria** | `200` com `{ "demanda": {...} }` |

- Sem corpo e sem filtros. Qualquer parâmetro de consulta responde `400`, seguindo o padrão das outras rotas.
- O `:id` segue a regra compartilhada: apenas dígitos decimais, entre 1 e 2147483647.
- A rota é somente de leitura. Por isso não usa `exigirJsonMesmaOrigem`.
- O integrante autenticado recebe `403`. Ele continua consultando a própria confirmação pelas rotas da SCRUM-14 e o estoque pelo `GET /api/estoque`.
- A rota fica no módulo de demanda (`DemandaController`, `DemandaService`, `DemandaRepository`) e é montada em `/api/ensaios` sem alterar o router de ensaios. A rota `GET /:id` de ensaios não captura `/:id/demanda`.

### Corpo da resposta

```json
{
  "demanda": {
    "ensaioId": 7,
    "calculadoEm": "2026-11-20T21:30:00.000Z",
    "tipos": [
      { "tipoInstrumentoId": 1, "nome": "Caixa", "confirmados": 5, "disponiveis": 3, "falta": 2 },
      { "tipoInstrumentoId": 3, "nome": "Repinique", "confirmados": 0, "disponiveis": 2, "falta": 0 },
      { "tipoInstrumentoId": 2, "nome": "Surdo", "confirmados": 2, "disponiveis": 0, "falta": 2 }
    ]
  }
}
```

| Campo | Regra |
| --- | --- |
| `ensaioId` | ID do ensaio consultado, como número inteiro |
| `calculadoEm` | Instante do cálculo em UTC, com `Z`. A interface mostra esse valor em `America/Sao_Paulo` para deixar claro que é uma foto do estoque atual. |
| `tipos` | Todos os tipos cadastrados, inclusive os que têm zero confirmações ou zero unidades, ordenados por `nome` e `tipoInstrumentoId`, como o resumo do estoque. Sem tipos cadastrados, a lista vem vazia (`[]`). |
| `confirmados`, `disponiveis`, `falta` | Números inteiros JSON maiores ou iguais a zero, mesmo quando vêm de agregações do PostgreSQL |
| `nome` | Nome atual do tipo |

Não há totais gerais na resposta. A interface pode somar as linhas ou destacar as que têm `falta > 0`.

## Erros

O formato é o mesmo das outras rotas: `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | ID fora do formato ou parâmetros de consulta |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, expirada ou revogada |
| `403` | `ACESSO_NEGADO` | Sessão de integrante |
| `404` | `ENSAIO_NAO_ENCONTRADO` | O ID é válido, mas o ensaio não existe |
| `409` | `ENSAIO_CANCELADO` | O ensaio está cancelado. Ele não recebe confirmações novas, então não há demanda a comparar. |

A autenticação e a autorização rodam antes da validação do ID e da consulta ao ensaio, como nas rotas da Sprint 2. Um ensaio com data passada não é recusado, porque a Sprint 2 não bloqueia datas passadas. Na lista de seleção, o painel pode mostrar apenas os ensaios `AGENDADO`.

## Cálculo no backend (SCRUM-43)

- `DemandaRepository` faz uma única consulta SQL parametrizada. Ela parte de `tipos_instrumentos` e faz `LEFT JOIN` com as unidades disponíveis e com as confirmações ativas do ensaio, agrupadas por tipo, usando `COUNT(...)::integer` e `COALESCE(..., 0)`. Assim, em `READ COMMITTED`, estoque e confirmações vêm do mesmo snapshot.
- O ensaio é consultado antes, para diferenciar `404` e `409`. Como a rota só lê dados, não há bloqueio de linhas.
- A falta é calculada na entidade do item de demanda, a partir dos inteiros já validados, para testar a regra sem banco.
- A rota não altera nenhuma tabela. Ela não grava reservas nem contagens.

Consulta para o esquema definido na SCRUM-37:

```sql
SELECT t.id AS "tipoInstrumentoId",
       t.nome,
       COALESCE(c.confirmados, 0)::integer AS confirmados,
       COUNT(i.id) FILTER (WHERE i.situacao = 'DISPONIVEL')::integer AS disponiveis
FROM tipos_instrumentos t
LEFT JOIN instrumentos i ON i.tipo_instrumento_id = t.id
LEFT JOIN (
  SELECT tipo_instrumento_id, COUNT(*) AS confirmados
  FROM confirmacoes
  WHERE ensaio_id = $1 AND cancelado_em IS NULL
  GROUP BY tipo_instrumento_id
) c ON c.tipo_instrumento_id = t.id
GROUP BY t.id, t.nome, c.confirmados
ORDER BY t.nome, t.id;
```

## Acordos com os outros módulos

### Confirmações — Vitor (SCRUM-37 e SCRUM-41)

- O script `005-criar-confirmacoes.sql` define `confirmacoes` com `ensaio_id`, `usuario_id`, `tipo_instrumento_id` e `cancelado_em`. A restrição `UNIQUE (usuario_id, ensaio_id)` mantém um registro por usuário e ensaio, inclusive após cancelamento e reativação.
- A demanda conta apenas `cancelado_em IS NULL`. Esse predicado também é usado pelo índice `confirmacoes_ativas_demanda_idx`, em `(ensaio_id, tipo_instrumento_id)`.
- A troca de instrumento atualiza `tipo_instrumento_id` e muda a contagem para o novo tipo. Cancelar uma participação preenche `cancelado_em`. Reativá-la volta a deixar o campo nulo.
- Cancelar o ensaio preserva os registros de confirmação. A rota de demanda devolve `409 ENSAIO_CANCELADO` nesse caso.

### Empréstimos — Lucas (SCRUM-38 e SCRUM-42)

- A demanda lê somente `instrumentos.situacao`. Ela não consulta a tabela de empréstimos.
- A retirada muda a unidade para `EMPRESTADO` e a devolução para `DISPONIVEL`, com `UPDATE` na mesma linha e na mesma transação do registro do empréstimo. Essa é a mesma proteção descrita na [implementação do estoque](contratos-sprint-2.md#implementação-no-backend--scrum-31).
- `EM_MANUTENCAO` continua sendo testada com dados fictícios preparados no banco. A operação real fica para a SCRUM-17, na Sprint 4.

### Painel — Pedro (SCRUM-47)

- A lista de ensaios vem de `GET /api/ensaios?situacao=AGENDADO`. A demanda vem de `session.request('/ensaios/' + id + '/demanda')`.
- Colunas do painel: tipo (`nome`), confirmados, disponíveis e falta. Destacar as linhas com `falta > 0`.
- Mostrar um aviso de que a comparação usa o estoque atual (`calculadoEm`) e não reserva unidades.
- Ter uma ação de atualizar que repete a consulta. Tratar carregamento, lista vazia, `403`, `404`, `409` e falha com os componentes existentes.

## Validação (SCRUM-43 e SCRUM-51)

| Caso | Resultado esperado |
| --- | --- |
| 5 confirmações ativas de Caixa e 3 caixas disponíveis | `confirmados: 5`, `disponiveis: 3`, `falta: 2` |
| Mais unidades disponíveis que confirmações | `falta: 0` |
| Tipo sem unidades e com confirmações | `disponiveis: 0` e `falta` igual a `confirmados` |
| Tipo sem confirmações | Aparece com `confirmados: 0` |
| Cancelar uma confirmação | A próxima consulta reduz `confirmados` |
| Trocar o tipo da confirmação | A demanda sai de um tipo e entra no outro |
| Retirada e devolução | A próxima consulta reduz e depois recompõe `disponiveis` |
| Unidade em manutenção (dado fictício) | Não conta em `disponiveis` |
| Confirmações de outro ensaio | Não entram na contagem |
| Integrante, sem sessão, ID inválido, ensaio inexistente ou cancelado | `403`, `401`, `400`, `404` e `409`, respectivamente |
| Consultar a demanda | Não altera `instrumentos` nem as confirmações |

A suíte padrão (`npm test`) cobre a regra e o contrato HTTP com repositórios em memória. Para validar o cálculo no PostgreSQL, aplicar os scripts `001` a `005` em um banco descartável. Para conferir retirada e devolução no fluxo integrado, aplicar também o script `006` da SCRUM-38.

## Implementação no backend — SCRUM-43

| Parte | Arquivo |
| --- | --- |
| Regra da falta | `backend/src/entities/ItemDemanda.js` |
| Serviço | `backend/src/services/DemandaService.js`: valida ID e filtros, confere o ensaio (`404` e `409`) e converte as contagens em inteiros |
| Consulta | `backend/src/repositories/DemandaRepository.js`: SQL parametrizado único, exportado como `SQL_DEMANDA_POR_TIPO` |
| HTTP | `backend/src/controllers/DemandaController.js` e `backend/src/routes/demanda.js`, montados em `/api/ensaios` no `app.js` |
| Testes | `backend/tests/demanda.test.js`, com repositórios em memória, e `backend/tests/demanda.postgres.test.js`, com o banco real |

`SQL_DEMANDA_POR_TIPO` usa `cancelado_em IS NULL`, como o script `005`. `npm test` em `backend/` executa a suíte padrão.

Para conferir a consulta no PostgreSQL 18, crie um banco vazio com prefixo `bateria_demanda_test_` e configure a conexão em `backend/.env.test`. Depois execute, na raiz do repositório, em PowerShell:

```powershell
$env:DEMANDA_PG_INTEGRATION = '1'
try {
  node --env-file=backend/.env.test --test backend/tests/demanda.postgres.test.js
} finally {
  Remove-Item Env:DEMANDA_PG_INTEGRATION
}
```

O teste aplica os scripts `001` a `005` e as contas fictícias. Confirmações e situações de unidades são preparadas diretamente no banco, e o teste confere:

- o exemplo 5/3 → falta 2;
- unidades emprestadas e em manutenção fora da disponibilidade;
- cancelamento, reativação e troca de tipo;
- retirada e devolução;
- confirmações de outro ensaio;
- os erros `403`, `404` e `409`;
- que a consulta não grava nada.

O teste falha se as tabelas já existirem. Para repetir, use outro banco vazio.
