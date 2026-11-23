# Banco de dados e scripts

## Usuários e dados iniciais — SCRUM-22

A tabela `usuarios` guarda a identidade usada no acesso ao sistema e será reutilizada na gestão de integrantes. Usaremos seu `id` como referência nos módulos de ensaios, confirmações e movimentações. Os campos específicos de integrantes serão definidos na SCRUM-11, mantendo nome, e-mail e credenciais em um cadastro compartilhado.

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | integer identity | Chave primária gerada pelo banco |
| `nome` | varchar(120) | Obrigatório, sem espaços nas extremidades e não vazio |
| `email` | varchar(254) | Obrigatório, único, em minúsculas e sem espaços |
| `senha_hash` | text | Obrigatório, no formato scrypt descrito abaixo |
| `perfil` | varchar(10) | `DIRETORIA` ou `INTEGRANTE` |

A classe `Usuario`, em `backend/src/entities/Usuario.js`, normaliza nome e e-mail, valida os dados, identifica o perfil de diretoria e omite o hash na serialização JSON. O repositório de usuários mapeia `senha_hash` para `senhaHash`. O contrato de acesso e os componentes intermediários de autorização estão em [autenticação](../docs/autenticacao.md).

## Confirmações de participação em ensaios — SCRUM-37

A tabela `confirmacoes` registra a intenção de participação de um usuário (`usuarios.id`) em um ensaio (`ensaios.id`), vinculada a um tipo de instrumento (`tipos_instrumentos.id`). A confirmação representa **demanda por tipo de instrumento** e **não reserva uma unidade física**. O estoque real e a disponibilidade física continuam sendo controlados pelas tabelas `instrumentos` e movimentações de estoque.

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | integer identity | Chave primária gerada pelo banco |
| `ensaio_id` | integer | Obrigatório, chave estrangeira para `ensaios.id` com `ON DELETE CASCADE` |
| `usuario_id` | integer | Obrigatório, chave estrangeira para `usuarios.id` com `ON DELETE CASCADE` |
| `tipo_instrumento_id` | integer | Obrigatório, chave estrangeira para `tipos_instrumentos.id` com `ON DELETE RESTRICT` |
| `criado_em` | timestamptz | Obrigatório, padrão `clock_timestamp()` |
| `atualizado_em` | timestamptz | Opcional, nulo na criação; data/hora da última alteração de tipo ou cancelamento |
| `cancelado_em` | timestamptz | Opcional; nulo se ativa, preenchido se cancelada |

- A unicidade no PostgreSQL é garantida por `UNIQUE (usuario_id, ensaio_id)`, permitindo no máximo um registro por usuário e ensaio, mesmo sob requisições concorrentes.
- O cancelamento preenche `cancelado_em` com o horário da gravação e mantém o registro para consulta e reativação.
- Troca de tipo e reativação utilizam `UPDATE` ou `INSERT ... ON CONFLICT (usuario_id, ensaio_id) DO UPDATE`.
- O contrato da API e a integração com o cálculo de demanda estão detalhados em [contrato de confirmações](../docs/contrato-confirmacoes.md).

## Preparar o banco

Requisitos: PostgreSQL 18 com `psql` e `createdb` disponíveis no terminal; Node.js 24 para os testes da entidade.

Os comandos abaixo partem da raiz do repositório e usam um PostgreSQL local na porta 5432. Ajuste o endereço do servidor, a porta e o usuário conforme seu ambiente; informe a senha quando solicitada. Se o banco `bateria_db` já existir, comece pela criação da tabela.

```sh
createdb -h localhost -p 5432 -U postgres bateria_db
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/001-criar-usuarios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/seeds/001-usuarios-desenvolvimento.sql
```

Execute `001-criar-usuarios.sql` uma única vez por banco. O script cria a estrutura e falha se a tabela já existir, evitando ocultar diferenças no esquema. Novas alterações de estrutura deverão usar novos scripts numerados. A numeração dos próximos módulos deve ser combinada com seus responsáveis.

O carregamento dos dados iniciais é opcional e exclusivo para desenvolvimento e testes. Pode ser reaplicado: se o e-mail já existir, ele preserva a conta, inclusive nome, perfil e senha. Uma alteração na senha de demonstração exige atualização explícita da conta no ambiente de testes.

## Acessos fictícios

| Perfil | E-mail | Senha de demonstração |
| --- | --- | --- |
| Diretoria | `diretoria@bateria.example` | `DiretoriaDemo!2026` |
| Integrante | `integrante@bateria.example` | `IntegranteDemo!2026` |

Essas contas e senhas são públicas e servem somente para testes locais e demonstrações. Não carregue esses dados iniciais em um ambiente com dados reais. Para usar o acesso da SCRUM-23, aplique também `002-criar-sessoes.sql` conforme as [instruções de autenticação](../docs/autenticacao.md).

As senhas são armazenadas no formato:

```text
scrypt$131072$8$1$<salt hexadecimal de 16 bytes>$<hash hexadecimal de 64 bytes>
```

Parâmetros: `N=131072`, `r=8`, `p=1`; cada senha recebeu um salt aleatório próprio. Para gerar ou conferir esses hashes com `node:crypto`, decodifique o salt de hexadecimal para `Buffer` e use `maxmem: 256 * 1024 * 1024`. O limite de memória permite executar esses parâmetros. Na autenticação, `SenhaService` deriva o hash da senha informada de forma assíncrona e compara os resultados com `timingSafeEqual`.

As restrições do banco e a entidade aceitam esse formato de hash; uma mudança de algoritmo deverá atualizar ambos. O formato protege contra o armazenamento acidental de senha em texto, mas a geração correta dos hashes continua sendo responsabilidade da aplicação.

## Configuração compartilhada com o backend

Os comandos `psql` usam o mesmo banco indicado pelas variáveis propostas na SCRUM-20: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`. O `psql` não lê essas variáveis `DB_*` nem o arquivo `.env` automaticamente; use os parâmetros dos comandos acima ou configure as variáveis `PG*` do próprio PostgreSQL.

O carregamento do ambiente, o conjunto de conexões do `pg` e a inicialização do servidor ficam na SCRUM-20. A organização dos scripts fica em `database/`, com dados fictícios em `database/seeds/`. Os scripts são executados explicitamente, sem carregar contas de demonstração na inicialização da API.

## Verificar a entrega

### Modelagem de ensaios e instrumentos

Os scripts `003-criar-ensaios.sql` e `004-criar-instrumentos.sql` definem a base dos módulos da Sprint 2, conforme os [contratos de ensaios e estoque](../docs/contratos-sprint-2.md). O primeiro cria `ensaios`; o segundo cria `tipos_instrumentos` e `instrumentos`. Cada um executa em uma transação. Eles não implementam rotas HTTP.

Esses scripts requerem PostgreSQL 18 com banco em UTF-8. A unicidade de nomes dos tipos usa `pg_unicode_fast` para tratar maiúsculas e minúsculas também em letras acentuadas, independentemente da configuração regional do banco.

Em um banco de desenvolvimento com usuários e sessões já preparados, aplicar cada novo script uma vez:

```sh
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/003-criar-ensaios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/004-criar-instrumentos.sql
```

Para conferir as restrições sem usar o banco da aplicação, criar um banco novo com prefixo `bateria_integracao_test_`:

```sh
createdb -h localhost -p 5432 -U postgres bateria_integracao_test_local
psql -X -h localhost -p 5432 -U postgres -d bateria_integracao_test_local -v ON_ERROR_STOP=1 -f database/003-criar-ensaios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_integracao_test_local -v ON_ERROR_STOP=1 -f database/004-criar-instrumentos.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_integracao_test_local -v ON_ERROR_STOP=1 -f database/tests/contratos-sprint-2.sql
```

O teste confere instante com fuso, situações iniciais, validações, unicidade, chave estrangeira e contagens por situação, incluindo tipo sem unidades. Os registros de teste são revertidos ao final; os valores das sequências de identificação podem avançar. A verificação das rotas e da interface fica para a implementação dos módulos.

### Modelagem de confirmações de ensaio (SCRUM-37)

O script `005-criar-confirmacoes.sql` cria a tabela `confirmacoes`, as chaves estrangeiras com `ensaios`, `usuarios` e `tipos_instrumentos`, as restrições de unicidade por usuário/ensaio, as checagens temporais e os índices de consulta e cálculo de demanda ativa (`confirmacoes_ativas_demanda_idx`). O script executa em uma transação atômica.

Em um banco de desenvolvimento preparado com os scripts `001` a `004`, aplicar o script:

```sh
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/005-criar-confirmacoes.sql
```

Para conferir todas as restrições e o ciclo de vida sem impactar o banco da aplicação, criar um banco descartável com prefixo `bateria_confirmacoes_test_`:

```sh
createdb -h localhost -p 5432 -U postgres bateria_confirmacoes_test_local
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/001-criar-usuarios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/003-criar-ensaios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/004-criar-instrumentos.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/005-criar-confirmacoes.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_confirmacoes_test_local -v ON_ERROR_STOP=1 -f database/tests/confirmacoes.sql
```

O teste `database/tests/confirmacoes.sql` confere a confirmação inicial, a unicidade por usuário e ensaio, as chaves estrangeiras, a restrição de exclusão de tipos, a ordem das datas, a troca de tipo, o cancelamento, a reativação e a contagem de confirmações ativas por tipo (`WHERE cancelado_em IS NULL`). Todos os registros são revertidos ao final com `ROLLBACK`.

### Empréstimos (SCRUM-38)

O script `006-criar-emprestimos.sql` cria a tabela `emprestimos`, com referências restritivas a integrantes e unidades, datas de retirada/devolução e índice único parcial para impedir mais de um empréstimo ativo por unidade. A situação atual da unidade permanece em `instrumentos.situacao`; as operações do backend atualizam a tabela e o registro de empréstimo na mesma transação.

Em um banco de desenvolvimento com scripts `001` a `004` já aplicados, execute uma vez:

```powershell
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/006-criar-emprestimos.sql
```

Para testar as rotas e transações com PostgreSQL real, prepare `backend/.env.test` para um banco vazio chamado, por exemplo, `bateria_emprestimos_test_local`. O teste aplica `001`, `002`, `004`, `006` e as contas fictícias; recusa banco fora do prefixo ou com tabelas existentes. Em `backend/`, execute:

```powershell
$env:NODE_ENV = 'test'
$env:EMPRESTIMOS_PG_INTEGRATION = '1'
try {
  node --env-file-if-exists=.env.test --test tests/emprestimos.postgres.test.js
} finally {
  Remove-Item Env:EMPRESTIMOS_PG_INTEGRATION
}
```

O teste confere autorização, criação persistida, atualização do estoque, histórico isolado por integrante, recusa de unidade em manutenção, retirada concorrente e devolução repetida após uma nova retirada. Os registros ficam restritos ao banco descartável.

### Usuários e dados iniciais

Teste da entidade e dos hashes das contas fictícias, sem depender do servidor HTTP ou de pacotes npm:

```sh
node --test backend/tests/usuario.test.js
```

Para verificar as restrições no PostgreSQL, crie um banco separado. Os testes esperam a tabela e as duas contas fictícias:

```sh
createdb -h localhost -p 5432 -U postgres bateria_usuarios_test
psql -X -h localhost -p 5432 -U postgres -d bateria_usuarios_test -v ON_ERROR_STOP=1 -f database/001-criar-usuarios.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_usuarios_test -v ON_ERROR_STOP=1 -f database/seeds/001-usuarios-desenvolvimento.sql
psql -X -h localhost -p 5432 -U postgres -d bateria_usuarios_test -v ON_ERROR_STOP=1 -f database/tests/usuarios.sql
```

Os testes verificam os dois perfis, duplicidade de e-mail, normalização, campos inválidos, bloqueio de senha em texto e preservação das contas ao reaplicar os dados iniciais. As alterações do teste SQL são revertidas ao final.

## Referências

- [Node.js 24 — scrypt](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).
- [OWASP — armazenamento de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
- [PostgreSQL 18 — restrições](https://www.postgresql.org/docs/18/ddl-constraints.html).
- [PostgreSQL 18 — regras de comparação e conversão de caixa](https://www.postgresql.org/docs/18/collation.html#COLLATION-MANAGING-STANDARD).
