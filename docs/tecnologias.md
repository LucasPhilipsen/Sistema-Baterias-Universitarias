# Definição da linguagem e tecnologias — SCRUM-7

Data: 02/11/2026. Definição técnica confirmada pelo usuário, com PostgreSQL como banco de dados. A descrição foi registrada no Jira e a subtarefa [SCRUM-7](https://pds20262-g14.atlassian.net/browse/SCRUM-7) foi movida para **Concluído**. A publicação na Wiki ainda não foi realizada.

## Tecnologias

| Camada | Escolha | Uso no projeto |
| --- | --- | --- |
| Linguagem | JavaScript moderno, com módulos ES | Frontend e backend na mesma linguagem |
| Interface | React 19, HTML/JSX e CSS Modules | Telas responsivas e componentes por módulo |
| Desenvolvimento e build da interface | Vite 8 | Executar a interface durante o desenvolvimento e gerar os arquivos de distribuição |
| Ambiente do backend | Node.js 24 LTS, com atualização de correção vigente | Executar o servidor JavaScript |
| Framework do backend | Express 5 | API REST, rotas HTTP, middlewares e tratamento de erros |
| Banco de dados | PostgreSQL 18, com atualização de correção vigente | Persistência relacional de todos os módulos |
| Conexão com o banco | node-postgres, pacote `pg` | Consultas SQL parametrizadas, pool de conexões e transações |
| Comunicação | HTTP com JSON; Fetch API no frontend | Comunicação entre a interface e o backend |
| Dependências | npm e `package-lock.json` | Registrar versões e reproduzir as instalações com `npm ci` |
| Testes do backend | Executor nativo `node:test` e `node:assert/strict` | Verificar regras de negócio; integração em banco exclusivo de teste |
| Validação da interface | Roteiros de testes no navegador | Verificar os critérios de aceite e os fluxos completos |
| Versionamento e documentação | Git, GitHub e Wiki do GitHub | Código, revisão e relatório da disciplina |
| Gestão | Jira | Backlog, histórias, subtarefas e quatro Sprints |

As versões exatas dos pacotes estão registradas nos manifests e no lockfile. A estrutura inicial já executa a interface e a API de saúde. As funcionalidades de negócio e a modelagem final do banco ainda serão implementadas.

## Justificativa

JavaScript mantém uma linguagem comum para os cinco responsáveis pelos módulos. React permite organizar as telas em componentes, e Vite fornece o ambiente de desenvolvimento e o build. Express permite manter a API separada da interface, conforme a arquitetura cliente-servidor do projeto.

PostgreSQL atende à modelagem relacional de integrantes, ensaios, confirmações, instrumentos e movimentações. Chaves estrangeiras e restrições de unicidade apoiam a integridade dos dados. Transações e controle de concorrência serão necessários nos fluxos de empréstimo, devolução e manutenção; a escolha do banco não implementa essas regras automaticamente.

O pacote `pg` permite trabalhar diretamente com SQL, mantendo consultas nos repositórios de cada módulo. O frontend acessa somente a API; credenciais do banco ficam no backend, em variáveis de ambiente.

## Como atender ao backend orientado a objetos

Os módulos do backend terão entidades com comportamento, serviços para regras de negócio, repositórios para persistência e controllers para a comunicação HTTP. Usar Express, por si só, não demonstra orientação a objetos.

Exemplo da organização prevista para o módulo de ensaios:

```text
Requisição HTTP
    → EnsaioController
    → EnsaioService → Ensaio / ConfirmacaoEnsaio / Presenca
    → EnsaioRepository
    → PostgreSQL via pg
```

As entidades encapsulam seu estado e operações; o serviço recebe os repositórios de que precisa por construtor. Isso permite testar regras com repositórios substitutos e manter SQL fora dos controllers. O relatório deve mostrar exemplos reais dessa organização quando houver implementação.

No módulo de Giovani, isso inclui organizar ensaios, impedir confirmações duplicadas e separar confirmação antecipada de presença efetiva. A prevenção de duplicidade também deve existir no banco. Operações transacionais com `pg` usam a mesma conexão até `COMMIT` ou `ROLLBACK`.

## Documentação consultada

- [React: criação com ferramentas como Vite](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite: guia e requisitos de Node.js](https://vite.dev/guide/)
- [Express 5: referência da API](https://expressjs.com/en/api/)
- [Node.js: versões e suporte LTS](https://nodejs.org/en/about/previous-releases)
- [Node.js: executor de testes](https://nodejs.org/docs/latest-v24.x/api/test.html)
- [PostgreSQL: versões suportadas](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 18: restrições e integridade](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [node-postgres: conexão com PostgreSQL](https://node-postgres.com/)
- [node-postgres: transações](https://node-postgres.com/features/transactions)
