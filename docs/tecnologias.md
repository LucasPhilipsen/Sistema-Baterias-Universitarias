# Definição da linguagem e tecnologias

Decisão registrada na [SCRUM-7](https://pds20262-g14.atlassian.net/browse/SCRUM-7), em 02/11/2026, como parte dos ajustes iniciais da Sprint 1.

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

Node.js e PostgreSQL devem usar as atualizações de correção vigentes das versões escolhidas. As versões exatas das dependências serão registradas nos manifests e no lockfile quando a configuração da aplicação for selecionada para execução.

## Justificativa

JavaScript permite usar uma linguagem comum nos cinco módulos. React organiza as telas em componentes, e Vite fornece o ambiente de desenvolvimento e build. Express permite manter uma API separada da interface, seguindo a arquitetura cliente-servidor.

PostgreSQL atende à modelagem relacional dos vínculos entre integrantes, ensaios, confirmações, instrumentos e movimentações. Restrições de unicidade e chaves estrangeiras apoiarão a integridade dos dados. Transações e controle de concorrência serão necessários nos fluxos de empréstimo, devolução e manutenção.

O pacote `pg` permitirá trabalhar com consultas parametrizadas e concentrar o SQL nos repositórios dos módulos. A interface acessará apenas a API; as credenciais do banco ficarão no backend.

## Backend orientado a objetos

Os módulos do backend terão entidades com estado e comportamento, serviços para regras de negócio, repositórios para persistência e controllers para comunicação HTTP. Usar Express, por si só, não demonstra orientação a objetos.

Exemplo de organização prevista para o módulo de ensaios:

```text
Requisição HTTP
    → EnsaioController
    → EnsaioService → Ensaio / ConfirmacaoEnsaio / Presenca
    → EnsaioRepository
    → PostgreSQL via pg
```

As entidades encapsularão suas operações; os serviços receberão dependências por construtor. Isso permitirá testar regras com repositórios substitutos e manter SQL fora dos controllers. A prevenção de confirmações e presenças duplicadas também deverá existir no banco. Transações com `pg` deverão usar a mesma conexão até `COMMIT` ou `ROLLBACK`.

Essa seção define a estratégia técnica. As classes, os contratos detalhados e as tabelas ainda serão implementados nas histórias correspondentes.

## Referências

- [React](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite](https://vite.dev/guide/)
- [Express 5](https://expressjs.com/en/api/)
- [Node.js: versões e suporte](https://nodejs.org/en/about/previous-releases)
- [PostgreSQL: versões suportadas](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 18: restrições e integridade](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [node-postgres](https://node-postgres.com/)
