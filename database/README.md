# Usuários e dados iniciais — SCRUM-22

A tabela `usuarios` guarda a identidade usada no acesso ao sistema e será reutilizada na gestão de integrantes. Usaremos seu `id` como referência nos módulos de ensaios, confirmações e movimentações. Os campos específicos de integrantes serão definidos na SCRUM-11, mantendo nome, e-mail e credenciais em um cadastro compartilhado.

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | integer identity | Chave primária gerada pelo banco |
| `nome` | varchar(120) | Obrigatório, sem espaços nas extremidades e não vazio |
| `email` | varchar(254) | Obrigatório, único, em minúsculas e sem espaços |
| `senha_hash` | text | Obrigatório, no formato scrypt descrito abaixo |
| `perfil` | varchar(10) | `DIRETORIA` ou `INTEGRANTE` |

A classe `Usuario`, em `backend/src/entities/Usuario.js`, normaliza nome e e-mail, valida os dados, identifica o perfil de diretoria e omite o hash na serialização JSON. O repositório de usuários mapeia `senha_hash` para `senhaHash`. O contrato de acesso e os componentes intermediários de autorização estão em [autenticação](../docs/autenticacao.md).

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
