# Definição da linguagem e tecnologias

Definimos estas tecnologias na Sprint 1 e registramos a escolha na [SCRUM-7](https://pds20262-g14.atlassian.net/browse/SCRUM-7), em 02/11/2026.

## Tecnologias escolhidas

| Camada | Tecnologia | Uso previsto |
| --- | --- | --- |
| Linguagem | JavaScript moderno, com módulos ES | Frontend e backend na mesma linguagem |
| Interface | React 19, HTML/JSX e CSS Modules | Telas responsivas e componentes por módulo |
| Desenvolvimento e build | Vite 8 | Ambiente de desenvolvimento e geração da interface |
| Ambiente do backend | Node.js 24 LTS | Execução do servidor JavaScript |
| Framework do backend | Express 5 | API REST, rotas e middlewares |
| Banco de dados | PostgreSQL 18 | Persistência relacional dos módulos |
| Conexão com o banco | `pg` (node-postgres) | SQL parametrizado, pool de conexões e transações |
| Comunicação | HTTP/JSON; Fetch API no frontend | Comunicação entre interface e API |
| Dependências | npm | Manifests e lockfile durante a implementação |
| Testes do backend | `node:test` e `node:assert/strict` | Regras de negócio e verificações de integração |
| Validação da interface | Roteiros de testes no navegador | Verificação dos critérios de aceite e fluxos completos |
| Versionamento | Git e GitHub | Código e revisão |
| Gestão e relatório | Jira e Wiki do GitHub | Acompanhamento das Sprints e relatório da disciplina |

Vamos usar as atualizações de correção das versões escolhidas de Node.js e PostgreSQL. Durante a configuração da aplicação, vamos registrar as versões dos pacotes no `package.json` e no `package-lock.json`.

## Justificativa

Escolhemos JavaScript para trabalhar com a mesma linguagem no frontend e no backend. Vamos usar React para organizar as telas em componentes, Vite para desenvolver e gerar o build e Express para montar a API separada da interface.

Escolhemos PostgreSQL porque precisamos relacionar integrantes, ensaios, confirmações, instrumentos e movimentações. Vamos usar chaves estrangeiras e restrições de unicidade para manter esses vínculos e evitar duplicidades. Nos empréstimos, nas devoluções e nas manutenções, vamos usar transações para atualizar os registros e a disponibilidade de forma consistente.

Com o pacote `pg`, vamos usar consultas parametrizadas e concentrar o SQL nos repositórios de cada módulo. O frontend vai acessar a API, e a conexão com o banco ficará no backend.

## Backend orientado a objetos

Vamos dividir cada módulo do backend em entidades, serviços, repositórios e controllers. As entidades terão os dados e os comportamentos do domínio; os serviços cuidarão das regras de negócio; os repositórios acessarão o banco; e os controllers receberão as requisições HTTP.

Exemplo de organização prevista para o módulo de ensaios:

```text
Requisição HTTP
    → EnsaioController
    → EnsaioService → Ensaio / ConfirmacaoEnsaio / Presenca
    → EnsaioRepository
    → PostgreSQL via pg
```

Vamos passar as dependências dos serviços pelo construtor para conseguir testar as regras separadamente do banco. O SQL ficará nos repositórios. Também vamos impedir confirmações e presenças duplicadas com restrições no banco. Nas transações com `pg`, vamos manter a mesma conexão até o `COMMIT` ou o `ROLLBACK`.

Vamos detalhar as classes, as rotas e as tabelas durante a implementação das histórias de cada módulo.

## Referências

- [React](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite](https://vite.dev/guide/)
- [Express 5](https://expressjs.com/en/api/)
- [Node.js: versões e suporte](https://nodejs.org/en/about/previous-releases)
- [PostgreSQL: versões suportadas](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 18: restrições e integridade](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [node-postgres](https://node-postgres.com/)
