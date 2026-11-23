# Contrato de confirmação de participação por instrumento — SCRUM-37

Contrato da história [Confirmar participação por instrumento (SCRUM-14)](https://pds20262-g14.atlassian.net/browse/SCRUM-14). Define a tabela de confirmações e orienta a [API de participação (SCRUM-41)](https://pds20262-g14.atlassian.net/browse/SCRUM-41), a [interface na agenda (SCRUM-45)](https://pds20262-g14.atlassian.net/browse/SCRUM-45) e o [cálculo de demanda (SCRUM-43)](https://pds20262-g14.atlassian.net/browse/SCRUM-43).

---

## 1. Regras de negócio e modelagem relacional

A confirmação de participação representa o compromisso de um integrante ou diretor em comparecer a um ensaio tocando um tipo específico de instrumento (ex.: Caixa, Repinique, Surdo).

### Princípios da modelagem

1. **Demanda por tipo, não reserva de unidade física**:
   - A confirmação vincula o usuário autenticado (`usuarios.id`), o ensaio (`ensaios.id`) e o tipo de instrumento (`tipos_instrumentos.id`).
   - **Não reserva nem altera unidades físicas**: a coluna `instrumentos.situacao` **não** é modificada. O estoque de instrumentos continua sendo regido exclusivamente pelas movimentações de empréstimo e manutenção (SCRUM-31, SCRUM-38).
2. **Unicidade por usuário e ensaio**:
   - Cada usuário possui no máximo **um** registro por ensaio na tabela `confirmacoes`, garantido por restrição de unicidade no banco: `UNIQUE (usuario_id, ensaio_id)`.
   - Isso elimina concorrência com duplicação de linhas mesmo sob requisições paralelas do mesmo usuário.
3. **Cancelamento lógico (soft delete) com histórico**:
   - O campo `cancelado_em timestamptz` indica a situação da participação:
     - `cancelado_em IS NULL`: confirmação **ativa** (conta na demanda do ensaio).
     - `cancelado_em IS NOT NULL`: confirmação **cancelada** (não conta na demanda).
   - O registro permanece armazenado para fins de auditoria, histórico e reativação.
4. **Ciclo de vida (Confirmar, Trocar Tipo, Cancelar e Reativar)**:
   - **Confirmar pela primeira vez** cria um registro ativo com `criado_em` definido por `clock_timestamp()`.
   - **Trocar o tipo de instrumento** atualiza o tipo e o horário da alteração. A próxima consulta move a demanda do tipo anterior para o novo.
   - **Cancelar participação** preenche `cancelado_em` e `atualizado_em` com o mesmo instante. Calcular o valor após bloquear a confirmação ativa, usando o maior valor entre `criado_em`, `atualizado_em` e `clock_timestamp()`. Se a confirmação já estiver cancelada, preservar as datas.
   - **Reativar** limpa `cancelado_em` e atualiza o tipo e o horário da alteração. O registro mantém o ID e a data da confirmação original.
   - O exemplo de gravação abaixo usa o horário real da alteração. Em transações simultâneas, `CURRENT_TIMESTAMP` poderia ser anterior à criação do registro por outra transação.
     ```sql
     INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id, ensaio_id) DO UPDATE
       SET tipo_instrumento_id = EXCLUDED.tipo_instrumento_id,
           cancelado_em = NULL,
           atualizado_em = CASE
             WHEN confirmacoes.cancelado_em IS NOT NULL
               OR confirmacoes.tipo_instrumento_id <> EXCLUDED.tipo_instrumento_id
             THEN GREATEST(confirmacoes.criado_em, confirmacoes.atualizado_em, clock_timestamp())
             ELSE confirmacoes.atualizado_em
           END
     RETURNING id, ensaio_id, usuario_id, tipo_instrumento_id, criado_em, atualizado_em, cancelado_em;
     ```

---

## 2. Estrutura da tabela `confirmacoes` (Script `005-criar-confirmacoes.sql`)

| Coluna | Tipo | Nulo | Padrão | Regra / Descrição |
| --- | --- | --- | --- | --- |
| `id` | `integer` | Não | `GENERATED ALWAYS AS IDENTITY` | Chave primária |
| `ensaio_id` | `integer` | Não | — | FK para `ensaios(id)` com `ON DELETE CASCADE` |
| `usuario_id` | `integer` | Não | — | FK para `usuarios(id)` com `ON DELETE CASCADE` |
| `tipo_instrumento_id` | `integer` | Não | — | FK para `tipos_instrumentos(id)` com `ON DELETE RESTRICT` |
| `criado_em` | `timestamptz` | Não | `clock_timestamp()` | Data/hora do registro inicial |
| `atualizado_em` | `timestamptz` | Sim | `NULL` | Data/hora da última alteração de tipo ou cancelamento/reativação |
| `cancelado_em` | `timestamptz` | Sim | `NULL` | `NULL` se ativa; preenchido se a participação foi cancelada |

### Restrições e índices

- `CONSTRAINT confirmacoes_usuario_ensaio_unico UNIQUE (usuario_id, ensaio_id)`: garante registro único por usuário em cada ensaio.
- `CONSTRAINT confirmacoes_atualizado_apos_criacao CHECK (atualizado_em IS NULL OR atualizado_em >= criado_em)`: garante coerência cronológica na atualização.
- `CONSTRAINT confirmacoes_cancelado_apos_criacao CHECK (cancelado_em IS NULL OR cancelado_em >= criado_em)`: garante coerência cronológica no cancelamento.
- `CREATE INDEX confirmacoes_ensaio_idx ON confirmacoes (ensaio_id)`: otimiza consultas por ensaio.
- `CREATE INDEX confirmacoes_usuario_idx ON confirmacoes (usuario_id)`: otimiza listagem de participações do usuário.
- `CREATE INDEX confirmacoes_ativas_demanda_idx ON confirmacoes (ensaio_id, tipo_instrumento_id) WHERE cancelado_em IS NULL`: índice parcial para o cálculo de demanda agregada por tipo.

---

## 3. Comportamento para ensaios cancelados e coordenação de concorrência

### Regras de ensaio cancelado

1. Um ensaio com `situacao = 'CANCELADO'` não pode receber novas confirmações, trocas de tipo de instrumento ou cancelamentos de participação.
2. Qualquer tentativa de alteração (`PUT` ou `DELETE` em `/api/ensaios/:id/minha-participacao`) em um ensaio cancelado deve retornar HTTP `409 Conflict` com código `ENSAIO_CANCELADO`.
3. As confirmações já realizadas antes do cancelamento do ensaio **permanecem gravadas no banco** para fins de histórico e auditoria (não são excluídas).

### Coordenação de concorrência no backend

Cenário concorrente crítico: um usuário tenta confirmar participação no exato momento em que a diretoria está cancelando o ensaio (`PATCH /api/ensaios/:id/cancelamento`).

Para garantir que nenhuma confirmação seja gravada em um ensaio recém-cancelado e evitar anomalias de corrida (*race conditions*):

1. **Uso de transação explícita com bloqueio de leitura compartilhada (`FOR SHARE`)**:
   - Ao processar `PUT` ou `DELETE /api/ensaios/:id/minha-participacao`, o backend abre uma transação (`BEGIN`).
   - Executa a leitura do ensaio com bloqueio compartilhado:
     ```sql
     SELECT id, situacao FROM ensaios WHERE id = $1 FOR SHARE;
     ```
   - **Por que `FOR SHARE`?**:
     - Permite que múltiplos integrantes confirmem no mesmo ensaio simultaneamente sem criar gargalo de serialização (leituras compartilhadas não se bloqueiam mutuamente).
     - Bloqueia e é bloqueado por operações exclusivas (`FOR UPDATE`), como o cancelamento do ensaio executado por `PATCH /api/ensaios/:id/cancelamento` (`UPDATE ensaios SET situacao = 'CANCELADO' WHERE id = $1`).
2. **Verificação do estado**:
   - Se o ensaio não existir: `ROLLBACK` e responde `404 ENSAIO_NAO_ENCONTRADO`.
   - Se `situacao === 'CANCELADO'`: `ROLLBACK` e responde `409 ENSAIO_CANCELADO`.
3. **Gravação atômica da confirmação**:
   - Se o ensaio estiver `AGENDADO`, executa o `INSERT ... ON CONFLICT (usuario_id, ensaio_id) DO UPDATE` (ou o `UPDATE` de cancelamento) na mesma transação.
   - Faz o `COMMIT`.
4. Se o cancelamento do ensaio estiver em andamento (já adquiriu o lock exclusivo), a requisição de confirmação aguarda o término da transação de cancelamento. Quando liberada, lê `situacao = 'CANCELADO'`, executa o `ROLLBACK` e devolve `409 ENSAIO_CANCELADO` ao cliente de forma consistente.

---

## 4. Contrato da API (SCRUM-41 e SCRUM-45)

### Convenções gerais

- **Prefixo**: `/api`.
- **Autenticação** exige sessão ativa. `exigirAutenticacao` preenche `req.usuario`. A API usa `req.usuario.id` para consultar e alterar a própria participação.
- **Autorização**: Usuários com perfil `INTEGRANTE` e `DIRETORIA` podem confirmar sua própria participação.
- **Proteção de origem** segue a verificação atual do backend. O `PUT` exige JSON da mesma origem. O `DELETE` aplica a mesma regra de origem e recebe a requisição sem corpo.
- **Campos adicionais**: Qualquer campo não reconhecido no corpo ou parâmetro de busca inesperado na URL gera `400 DADOS_INVALIDOS`.

### Rotas

| Método e caminho | Proteção | Corpo da requisição | Resposta de sucesso |
| --- | --- | --- | --- |
| `GET /api/ensaios/:id/minha-participacao` | Sessão ativa | Sem corpo | `200` com `{ "participacao": {...} }` ou `{ "participacao": null }` |
| `PUT /api/ensaios/:id/minha-participacao` | Sessão ativa + mesma origem + JSON | `tipoInstrumentoId` | `200` com `{ "participacao": {...} }` |
| `DELETE /api/ensaios/:id/minha-participacao` | Sessão ativa + mesma origem | Sem corpo | `200` com `{ "participacao": null }` |

---

### Detalhamento das rotas

#### 1. Consultar minha participação

`GET /api/ensaios/:id/minha-participacao`

Permite ao usuário verificar em qual instrumento confirmou presença no ensaio, ou saber se ainda não confirmou (ou cancelou).

- **Parâmetro de URL**: `:id` (inteiro entre 1 e 2147483647).

**Resposta quando houver confirmação ativa (`200 OK`)**:
```json
{
  "participacao": {
    "id": 14,
    "ensaioId": 5,
    "tipoInstrumentoId": 1,
    "tipoInstrumentoNome": "Caixa",
    "confirmadoEm": "2026-11-20T19:45:00.000Z",
    "atualizadoEm": null
  }
}
```

**Resposta quando NÃO houver confirmação ou ela estiver cancelada (`200 OK`)**:
```json
{
  "participacao": null
}
```

---

#### 2. Confirmar participação / Trocar instrumento / Reativar

`PUT /api/ensaios/:id/minha-participacao`

Operação unificada e idempotente:
- Se não havia confirmação anterior: cria o registro ativo.
- Se já havia confirmação ativa com outro instrumento: altera o instrumento (`trocar tipo`).
- Se havia sido cancelada: reativa a confirmação com o instrumento informado.

**Cabeçalhos**:
- `Content-Type: application/json`

**Corpo (`JSON`)**:
```json
{
  "tipoInstrumentoId": 1
}
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `tipoInstrumentoId` | `integer` | Sim | Inteiro positivo entre 1 e 2147483647, correspondente a um tipo existente em `tipos_instrumentos`. |

**Resposta (`200 OK`)**:
```json
{
  "participacao": {
    "id": 14,
    "ensaioId": 5,
    "tipoInstrumentoId": 1,
    "tipoInstrumentoNome": "Caixa",
    "confirmadoEm": "2026-11-20T19:45:00.000Z",
    "atualizadoEm": "2026-11-20T20:10:00.000Z"
  }
}
```

---

#### 3. Cancelar participação

`DELETE /api/ensaios/:id/minha-participacao`

Preenche `cancelado_em` com o horário da gravação. A participação deixa de contar para a demanda e continua registrada.

- **Idempotência**: se o usuário já não tiver participação ativa (ou se já tiver cancelado), a rota responde sucesso normalmente.

**Resposta (`200 OK`)**:
```json
{
  "participacao": null
}
```

---

### Respostas de erro

Formato padronizado: `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | Identificador de ensaio inválido na URL, campos adicionais não permitidos no corpo JSON, `tipoInstrumentoId` ausente ou não inteiro, ou parâmetros de consulta presentes na URL. |
| `400` | `TIPO_INSTRUMENTO_INVALIDO` | O `tipoInstrumentoId` informado não corresponde a nenhum tipo de instrumento existente. |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, expirada ou inválida. |
| `403` | `ORIGEM_INVALIDA` | Tentativa de alteração com cabeçalho de origem divergente. |
| `404` | `ENSAIO_NAO_ENCONTRADO` | O ensaio indicado por `:id` não existe no banco de dados. |
| `409` | `ENSAIO_CANCELADO` | O ensaio está cancelado. Não é permitido confirmar presença, trocar instrumento nem cancelar participação. |
| `415` | `JSON_OBRIGATORIO` | A requisição `PUT` foi enviada sem `Content-Type: application/json`. |

---

## 5. Integração com a comparação de demanda (Felipe — SCRUM-39 / SCRUM-43)

O [contrato de demanda (SCRUM-39)](https://pds20262-g14.atlassian.net/browse/SCRUM-39) define a consulta por tipo de instrumento em `GET /api/ensaios/:id/demanda`.

### Consulta SQL de demanda atualizada

Com a modelagem definida neste documento (`cancelado_em IS NULL` para ativas), a consulta de agregação de demanda em `DemandaRepository` (`SQL_DEMANDA_POR_TIPO`) deve ser estruturada da seguinte forma:

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

### Explicação do tratamento na consulta

1. **Participações canceladas**:
   - O predicado `cancelado_em IS NULL` dentro da subconsulta garante que confirmações canceladas são sumariamente excluídas da contagem de confirmados.
   - O índice parcial `confirmacoes_ativas_demanda_idx` cobre exatamente essa condição, evitando a leitura de registros cancelados.
2. **Troca de instrumento**:
   - Como a troca de instrumento é um `UPDATE` em `tipo_instrumento_id` mantendo `cancelado_em IS NULL`, na próxima consulta a demanda é deduzida do tipo anterior e somada ao novo tipo imediatamente no mesmo snapshot de leitura.
3. **Ensaios cancelados**:
   - Como acordado no contrato da SCRUM-39, a rota `GET /api/ensaios/:id/demanda` verifica previamente a situação do ensaio e responde HTTP `409 ENSAIO_CANCELADO`.
   - Caso a consulta SQL fosse disparada para um ensaio cancelado, ela leria as confirmações ativas daquele ensaio, mas o serviço de demanda bloqueia a operação antes disso com `409`, já que ensaios cancelados não demandam instrumentos.
4. **Isolamento transacional**:
   - Uma única leitura sob `READ COMMITTED` reúne tanto a contagem de estoque disponível quanto a contagem de confirmações ativas a partir do mesmo instante.

---

## 6. Procedimento de aplicação e verificação do script SQL

### Aplicação da migração

Requisitos: PostgreSQL 18 com UTF-8.

Para aplicar a estrutura no banco de desenvolvimento (`bateria_db`):
```sh
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/005-criar-confirmacoes.sql
```

O script é atômico: executa dentro de um bloco `BEGIN ... COMMIT` e falhará se a tabela `confirmacoes` já existir, preservando o estado íntegro do banco.

### Verificação automatizada das restrições (padrão de testes SQL)

Para validar todas as restrições (unicidade, chaves estrangeiras, `ON DELETE RESTRICT`, `CHECK` de datas, transição de estados e contagens de demanda) em um banco descartável com prefixo `bateria_confirmacoes_test_`:

```sh
createdb -h localhost -p 5432 -U postgres bateria_confirmacoes_test_local
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/001-criar-usuarios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/003-criar-ensaios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/004-criar-instrumentos.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/005-criar-confirmacoes.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/tests/confirmacoes.sql
```

O teste `database/tests/confirmacoes.sql` confere as restrições e o ciclo de participação e reverte os dados com `ROLLBACK` ao final. A SCRUM-41 deve conferir também duas requisições simultâneas em conexões distintas e a concorrência com o cancelamento do ensaio.
