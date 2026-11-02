# Sistema de Gestão de Baterias Universitárias

Projeto da disciplina **Processo de Desenvolvimento de Software**, professora Fabíola, Grupo 14. O sistema organizará integrantes, instrumentos, ensaios, confirmações, presença, empréstimos e manutenção. Seu fluxo central comparará a demanda de instrumentos de cada ensaio com o estoque disponível.

**Estado atual:** estrutura inicial executável, tela de apresentação, API de saúde, configuração de PostgreSQL e verificações automáticas. As funcionalidades de negócio ainda serão implementadas nas histórias do backlog.

## Tecnologias

JavaScript com módulos ES; React 19, Vite 8 e CSS Modules; Node.js 24 LTS e Express 5; PostgreSQL 18 com o driver `pg`. Dependências exatas são registradas no `package-lock.json`.

## Executar localmente

Pré-requisitos: **Node.js 24.x**, npm e Git. PostgreSQL é necessário para desenvolver persistência; a tela inicial e a API de saúde podem ser executadas sem banco.

```powershell
git clone https://github.com/LucasPhilipsen/Sistema-Baterias-Universitarias.git
cd Sistema-Baterias-Universitarias
npm ci
Copy-Item .env.example .env
npm run dev
```

Em Linux/macOS, substituir `Copy-Item .env.example .env` por `cp .env.example .env`.

- Interface: http://127.0.0.1:5173
- API: http://127.0.0.1:3000/api/health
- Requisições da interface para `/api` usam o proxy local do Vite. O navegador não acessa o banco diretamente.
- Encerrar o desenvolvimento com `Ctrl+C`.

## PostgreSQL

Escolher **uma** das opções:

1. Com Docker Desktop em execução: `docker compose up -d db`. O exemplo configura o banco `baterias` em `127.0.0.1:5433`, isolado em volume próprio. Para parar sem apagar os dados: `docker compose stop db`.
2. Com PostgreSQL 18 já instalado: criar um banco e usuário próprios de desenvolvimento e ajustar `DATABASE_URL` no `.env` para a porta e as credenciais locais.

Executar `npm run db:check` para verificar a conexão. O comando faz somente `SELECT 1`; não cria tabelas. A modelagem e as migrações dos módulos serão implementadas nas histórias correspondentes. Ver [convenções de banco](database/README.md).

Os valores de `.env.example` e do Compose são exemplos para desenvolvimento local. Não publicar o `.env` nem usar essas senhas em um ambiente exposto. Se mudar usuário, senha ou porta do Compose, ajustar também `DATABASE_URL`. Variáveis de inicialização do PostgreSQL só criam o usuário/banco na primeira inicialização de um volume vazio.

## Comandos

| Comando na raiz | Resultado |
| --- | --- |
| `npm run dev` | API e frontend juntos, com recarga durante o desenvolvimento |
| `npm run dev:backend` | Somente API |
| `npm run dev:frontend` | Somente frontend |
| `npm run lint` | Verificação estática do JavaScript/JSX |
| `npm test` | Testes HTTP automatizados da API inicial |
| `npm run build` | Build do frontend em `frontend/dist` |
| `npm run check` | Lint, testes e build |
| `npm run db:check` | Verificação de conexão com PostgreSQL |

O backend usa a porta 3000 por padrão. Se alterar `PORT` no `.env`, ajustar também o proxy em `frontend/vite.config.js`. O build gera somente a interface; a configuração de hospedagem e execução conjunta em produção ainda não foi definida.

## Estrutura e equipe

```text
frontend/src/
  components/       componentes compartilhados
  services/         cliente HTTP
  modules/          usuarios, ensaios, estoque, movimentacoes, dashboard
backend/src/
  config/           conexão com PostgreSQL
  modules/          health e os cinco módulos funcionais
backend/test/       testes automatizados
database/           convenções e futuras migrações SQL
docs/               documentação técnica e contrato da API
```

| Responsável | Módulo de frontend e backend |
| --- | --- |
| Pedro Batista Ribeiro | Usuários, autenticação e integrantes |
| Giovani de Oliveira Lopes | Ensaios, confirmações e presença |
| Felipe Miranda Morais | Estoque e instrumentos |
| Lucas Borges Philipsen | Empréstimos e manutenções |
| Vitor Eduardo Gonçalves | Dashboard, navegação e coordenação da integração |

O backend seguirá orientação a objetos, com entidades, serviços, repositórios e controllers. A base atual contém apenas o controller de saúde e a configuração de conexão; as classes de domínio serão implementadas junto com as funcionalidades.

## Desenvolvimento e documentação

- [Como contribuir](CONTRIBUTING.md)
- [Tecnologias e justificativas](docs/tecnologias.md)
- [Arquitetura e convenções](docs/arquitetura.md)
- [Contrato da API inicial](docs/api.md) e [OpenAPI](docs/openapi.json)
- [Backlog e Sprints no Jira](https://pds20262-g14.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog)
- [Wiki do GitHub](https://github.com/LucasPhilipsen/Sistema-Baterias-Universitarias/wiki) — publicação inicial ainda pendente

Histórias, critérios de aceite, responsáveis e acompanhamento das quatro Sprints ficam no **Jira**. O relatório da disciplina será mantido na **Wiki**, com evidências reais de implementação e validação.
