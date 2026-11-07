# Contratos de ensaios e estoque — Sprint 2

Definição preparada na SCRUM-34 para orientar a implementação de Vitor, Felipe e Pedro. Os scripts de modelagem acompanham este documento. As rotas abaixo ainda precisam ser implementadas e validadas; a presença do contrato não indica que estão disponíveis na API.

## Convenções compartilhadas

- Prefixo HTTP: `/api`. No frontend, `session.request('/ensaios')` chama `/api/ensaios`.
- Propriedades JSON em camelCase; colunas PostgreSQL em snake_case.
- Identificadores são inteiros entre 1 e 2147483647, gerados pelo banco. A interface usa os IDs retornados, sem fixar valores.
- Consultas exigem sessão. Operações de alteração exigem diretoria, JSON e a validação de mesma origem já existente. Integrante autenticado tentando alterar dados recebe `403`.
- `POST` de cadastro responde `201`, com o recurso criado e o cabeçalho `Location` de sua consulta. As demais operações listadas respondem `200` com JSON.
- Listas vazias respondem `200` com um array vazio, não `404`. Nesta entrega, as listas não usam paginação.
- `PUT` substitui os campos editáveis: os campos obrigatórios devem estar presentes; texto opcional omitido, vazio ou nulo vira `null`. Campos de controle, como `id` e `situacao`, não são editáveis por essas rotas e devem ser recusados.
- Corpos de alteração são objetos JSON; arrays, valores escalares e `null` são inválidos.
- Validar tipos sem coerção silenciosa no corpo JSON: um identificador deve ser número inteiro. Nos parâmetros de URL e filtros, aceitar somente dígitos decimais dentro do intervalo permitido. Campos e filtros desconhecidos são recusados com `400`.
- Remover espaços nas extremidades dos textos e conferir os limites após essa normalização. Quantidades nas respostas são números inteiros JSON, inclusive quando originadas de agregações PostgreSQL.
- Usar os componentes de autenticação, autorização e erro do [contrato compartilhado](integracao-sprint-2.md). IDs inexistentes são verificados depois da autenticação e da autorização aplicáveis.

## Ensaios — Vitor e Pedro

### Dados e regras

| JSON | Coluna | Regra |
| --- | --- | --- |
| `id` | `id` | Somente leitura |
| `inicioEm` | `inicio_em` | Obrigatório; data e hora ISO 8601 com `Z` ou deslocamento explícito, como `2026-11-10T19:00:00-03:00` |
| `local` | `local` | Obrigatório, entre 1 e 160 caracteres |
| `descricao` | `descricao` | Opcional, até 1000 caracteres; ausência ou texto vazio vira `null` |
| `situacao` | `situacao` | `AGENDADO` ou `CANCELADO`; cadastro sempre começa em `AGENDADO` |

O formulário recebe data e horário separadamente e informa que são do fuso `America/Sao_Paulo`. Ao chamar a API, converte os dois campos para `inicioEm`, com o deslocamento correspondente. Datas sem fuso e datas de calendário inexistentes são inválidas, mesmo se o conversor JavaScript conseguir ajustá-las automaticamente.

O banco armazena o instante em `timestamptz`; a API responde em UTC, com `Z`. A interface apresenta data e horário em `America/Sao_Paulo`, independentemente do fuso configurado no computador. Por exemplo, `2026-11-10T19:00:00-03:00` corresponde a `2026-11-10T22:00:00.000Z`. Não criar colunas separadas para o mesmo instante nem interpretar um valor sem fuso como UTC.

Nesta Sprint, não há bloqueio por choque de horário ou por data passada. Ensaios cancelados permanecem na agenda; cancelar não exclui o registro. Repetir o cancelamento retorna o ensaio já cancelado. Editar um ensaio cancelado retorna `409`; reabertura e exclusão não fazem parte destas rotas.

### Rotas

| Método e caminho | Corpo ou filtro | Resposta |
| --- | --- | --- |
| `GET /api/ensaios` | Filtro opcional `situacao=AGENDADO` ou `CANCELADO`; sem filtro inclui ambos | `{ "ensaios": [...] }`, ordenados por `inicioEm` e depois `id`, crescentes |
| `GET /api/ensaios/:id` | Sem corpo | `{ "ensaio": {...} }` |
| `POST /api/ensaios` | `inicioEm`, `local`, `descricao` opcional | `{ "ensaio": {...} }`; `201` e `Location: /api/ensaios/:id` |
| `PUT /api/ensaios/:id` | `inicioEm`, `local`, `descricao` opcional | `{ "ensaio": {...} }`; não altera a situação |
| `PATCH /api/ensaios/:id/cancelamento` | JSON `{}` | `{ "ensaio": {...} }` com `situacao: "CANCELADO"` |

Exemplo de cadastro:

```json
{
  "inicioEm": "2026-11-10T19:00:00-03:00",
  "local": "Quadra do campus",
  "descricao": "Ensaio geral"
}
```

Exemplo de resposta de cadastro, edição ou consulta de um ensaio agendado:

```json
{
  "ensaio": {
    "id": 1,
    "inicioEm": "2026-11-10T22:00:00.000Z",
    "local": "Quadra do campus",
    "descricao": "Ensaio geral",
    "situacao": "AGENDADO"
  }
}
```

O cancelamento retorna o mesmo objeto com `situacao: "CANCELADO"`. Repetir a chamada mantém essa situação e responde `200`.

Confirmações, demanda e presença não integram este corpo nem criam rotas nesta entrega. As próximas histórias poderão referenciar o `id` estável do ensaio.

## Instrumentos e estoque — Felipe e Pedro

### Dados e regras

`TipoInstrumento` representa a categoria, como Caixa ou Repinique. `Instrumento` representa uma unidade física, como `CAIXA-001`. Uma unidade sempre pertence a um tipo existente; o estoque é calculado pelas unidades, sem uma coluna de quantidade editada manualmente.

| Recurso | Campos JSON | Regras |
| --- | --- | --- |
| Tipo | `id`, `nome` | ID somente leitura; nome obrigatório de 1 a 80 caracteres, único desconsiderando maiúsculas e minúsculas |
| Unidade | `id`, `tipoInstrumentoId`, `identificacao`, `situacao`, `observacoes` | ID e situação somente leitura nas rotas de cadastro e edição |

No banco, a unicidade de nomes usa `lower(nome COLLATE "pg_unicode_fast")`, incluindo letras acentuadas: `AGOGÔ` e `agogô` representam o mesmo nome para essa verificação. O tipo preserva a grafia informada para exibição; acentos não são removidos. Se o repositório consultar um nome antes de salvar, deve usar a mesma expressão; a restrição única continua protegendo gravações concorrentes.

- `identificacao` tem de 1 a 40 caracteres. Normalizar para maiúsculas; aceitar letras de A a Z, dígitos, `_` e `-`, começando por letra ou dígito. A identificação é única em todo o estoque, não somente dentro de um tipo.
- `observacoes` é opcional, com até 500 caracteres; texto vazio ou ausência vira `null`.
- Situações possíveis: `DISPONIVEL`, `EMPRESTADO` e `EM_MANUTENCAO`. Novas unidades sempre começam em `DISPONIVEL`.
- A edição permite corrigir a identificação e as observações. A troca de tipo só é permitida para uma unidade `DISPONIVEL`; as outras situações retornam `409` nessa tentativa. Salvar os dados mantendo o mesmo tipo continua permitido.
- As telas de cadastro não alteram `situacao`. As operações que a modificam serão implementadas nas histórias de empréstimos e manutenções. Nesta Sprint, as situações indisponíveis serão conferidas com dados fictícios preparados diretamente no banco de testes.
- Não há exclusão nestas rotas. O vínculo da unidade com o tipo deve ser garantido por chave estrangeira; uma identificação duplicada deve ser protegida também por restrição única no banco.

### Rotas

| Método e caminho | Corpo ou filtro | Resposta |
| --- | --- | --- |
| `GET /api/tipos-instrumentos` | Sem filtros | `{ "tiposInstrumentos": [...] }`, ordenados por `nome` e `id` |
| `POST /api/tipos-instrumentos` | `nome` | `{ "tipoInstrumento": {...} }`; `201` e `Location: /api/tipos-instrumentos/:id` |
| `GET /api/tipos-instrumentos/:id` | Sem corpo | `{ "tipoInstrumento": {...} }` |
| `PUT /api/tipos-instrumentos/:id` | `nome` | `{ "tipoInstrumento": {...} }` |
| `GET /api/instrumentos` | Filtros opcionais `tipoInstrumentoId` e `situacao`; podem ser combinados | `{ "instrumentos": [...] }`, ordenados por `identificacao` e `id` |
| `GET /api/instrumentos/:id` | Sem corpo | `{ "instrumento": {...} }` |
| `POST /api/instrumentos` | `tipoInstrumentoId`, `identificacao`, `observacoes` opcional | `{ "instrumento": {...} }`; `201` e `Location: /api/instrumentos/:id` |
| `PUT /api/instrumentos/:id` | `tipoInstrumentoId`, `identificacao`, `observacoes` opcional | `{ "instrumento": {...} }` |
| `GET /api/estoque` | Sem filtros | `{ "estoque": [...] }`, com todos os tipos, ordenados por `nome` e `tipoInstrumentoId` |

Um filtro com situação inválida retorna `400`. Filtrar unidades por um tipo válido mas sem unidades retorna lista vazia; um ID de tipo inexistente no filtro também retorna lista vazia. No cadastro ou na edição, porém, referenciar um tipo inexistente retorna `400` e não salva a unidade.

Exemplo de cadastro ou edição de unidade:

```json
{ "tipoInstrumentoId": 1, "identificacao": "caixa-001", "observacoes": "Pele revisada" }
```

Resposta correspondente:

```json
{
  "instrumento": {
    "id": 1,
    "tipoInstrumentoId": 1,
    "identificacao": "CAIXA-001",
    "situacao": "DISPONIVEL",
    "observacoes": "Pele revisada"
  }
}
```

O resumo do estoque usa os nomes atuais dos tipos e inclui tipos com zero unidades:

```json
{
  "estoque": [
    { "tipoInstrumentoId": 1, "nome": "Caixa", "total": 4, "disponiveis": 2, "emprestados": 1, "emManutencao": 1 },
    { "tipoInstrumentoId": 2, "nome": "Repinique", "total": 0, "disponiveis": 0, "emprestados": 0, "emManutencao": 0 }
  ]
}
```

`total = disponiveis + emprestados + emManutencao`. A disponibilidade considera somente `DISPONIVEL`. Calcular os totais na consulta ao banco, usando `COUNT(instrumentos.id)` ao incluir tipos sem unidades, e converter os resultados para números inteiros JSON. Confirmações de ensaio não reservam unidades e não reduzem essa disponibilidade.

## Erros dos módulos

Manter o formato existente, por exemplo:

```json
{ "error": { "code": "IDENTIFICACAO_DUPLICADA", "message": "Já existe um instrumento com esta identificação." } }
```

| HTTP | Código | Uso |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | Campos, filtros ou identificadores de URL inválidos, incluindo data inválida e corpo com campos desconhecidos |
| `400` | `TIPO_INSTRUMENTO_INVALIDO` | Tipo referenciado no cadastro ou edição de unidade não existe |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, expirada ou revogada; reutilizar middleware existente |
| `403` | `ACESSO_NEGADO` | Integrante tentando alteração administrativa; reutilizar middleware existente |
| `404` | `ENSAIO_NAO_ENCONTRADO` | Ensaio consultado ou alterado não existe |
| `404` | `TIPO_INSTRUMENTO_NAO_ENCONTRADO` | Tipo consultado ou alterado não existe |
| `404` | `INSTRUMENTO_NAO_ENCONTRADO` | Unidade consultada ou alterada não existe |
| `409` | `ENSAIO_CANCELADO` | Tentativa de editar ensaio já cancelado |
| `409` | `TIPO_INSTRUMENTO_DUPLICADO` | Nome de tipo já cadastrado, desconsiderando maiúsculas e minúsculas |
| `409` | `IDENTIFICACAO_DUPLICADA` | Identificação física já cadastrada |
| `409` | `INSTRUMENTO_INDISPONIVEL` | Tentativa de trocar o tipo de unidade emprestada ou em manutenção |

Os erros compartilhados de JSON, origem e falha interna continuam conforme [autenticação](autenticacao.md). Usar `ErroAplicacao` para erros esperados de domínio e mapear violações conhecidas de integridade; não devolver mensagens SQL ao cliente. A validação deve estar nas classes do backend, além das restrições de integridade do banco.

Nas alterações que dependem da situação atual do recurso, validar e gravar de forma atômica, por condição na atualização ou por transação com bloqueio. Uma consulta isolada seguida de uma gravação sem essa proteção pode permitir editar um ensaio que acabou de ser cancelado ou trocar o tipo de uma unidade que ficou indisponível.

## Banco e divisão da implementação

| Script | Define | Uso |
| --- | --- | --- |
| `database/003-criar-ensaios.sql` | Tabela `ensaios` e ordenação por início | Base de modelagem para Vitor |
| `database/004-criar-instrumentos.sql` | Tabelas `tipos_instrumentos` e `instrumentos`, unicidade e situações | Base de modelagem para Felipe |

Os scripts seguem a numeração de usuários (`001`) e sessões (`002`). Aplicar cada script de estrutura uma vez no banco de desenvolvimento; dados fictícios e testes ficam separados. Cada novo script usa uma transação para criar sua estrutura inteira ou reverter em caso de falha. O script `004` não depende da tabela de ensaios, permitindo implementar os dois módulos em paralelo.

Vitor implementa as classes e rotas de ensaios; Felipe, as classes e rotas de estoque; Pedro implementa as telas usando estes corpos e respostas. Giovani acompanha a integração, as permissões e a SCRUM-33. As tarefas de implementação e validação continuam com seus responsáveis.

Conferir os [cenários de integração](integracao-sprint-2.md#roteiro-de-validação-integrada) quando as rotas estiverem disponíveis. Não marcar as operações como testadas somente por validar os scripts do banco.

### Conferência da modelagem — 07/11/2026

Os scripts de estrutura `001` a `004`, os dados fictícios de acesso e `database/tests/contratos-sprint-2.sql` foram executados em um banco PostgreSQL 18 novo e descartável. Foram conferidos o instante com fuso e os valores iniciais de ensaio, local e situação inválidos, nome de tipo sem duplicidade por caixa, inclusive com acentos, identificação única entre tipos, chave estrangeira, formato da identificação, situações válidas, contagem por situação e tipo sem unidades. A verificação passou e os registros criados pelo teste foram revertidos.

Também foi provocada uma falha durante a criação da estrutura de instrumentos: a transação reverteu as estruturas criadas pelo script, sem deixar a tabela de tipos parcialmente instalada. O teste de dados recusou execução em banco fora do prefixo permitido.

As regras de autorização, normalização na API, cancelamento e edição condicionada ainda precisam ser implementadas e verificadas nas entregas de backend e frontend. A modelagem não conclui sozinha as tarefas SCRUM-26 ou SCRUM-30 nem a integração da SCRUM-34.
