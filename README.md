# Sistema de Gestão de Baterias Universitárias

Projeto da disciplina **Processo de Desenvolvimento de Software**, professora **Fabíola**, **Grupo 14**.

Nosso projeto é uma aplicação web para gerenciar integrantes, instrumentos, ensaios, confirmações, presença, empréstimos e manutenções de baterias universitárias. A principal funcionalidade será comparar a demanda de instrumentos de cada ensaio com o estoque disponível.

## Estado do projeto

Na **Sprint 1 — Ajustes iniciais do projeto**, organizamos o repositório, definimos as tecnologias e o escopo e preparamos o backlog.

Estamos na **Sprint 2 — 04 a 11/11/2026**. Nesta etapa, vamos desenvolver o acesso ao sistema por perfil, a agenda de ensaios e o cadastro e a consulta de estoque. Por enquanto, temos a documentação inicial e as pastas reservadas; vamos adicionar a implementação conforme as tarefas forem entregues.

## Tecnologias definidas

| Parte | Tecnologia |
| --- | --- |
| Linguagem | JavaScript com módulos ES |
| Frontend | React 19 com Vite 8, HTML/JSX e CSS Modules |
| Backend | Node.js 24 LTS com Express 5 |
| Banco de dados | PostgreSQL 18 |
| Acesso ao banco | `pg` (node-postgres) |
| Comunicação | API REST com JSON |
| Dependências | npm |

Vamos organizar o backend em classes de entidades, serviços, repositórios e controllers. Detalhamos essas escolhas em [tecnologias e justificativas](docs/tecnologias.md).

## Equipe

Dividimos o trabalho com Pedro no frontend de todos os módulos e os demais integrantes no backend das suas áreas. Cada um vai acompanhar a integração e os testes da sua parte com ele.

| Integrante | Responsabilidade |
| --- | --- |
| Pedro Batista Ribeiro | Frontend de todos os módulos, componentes e navegação |
| Giovani de Oliveira Lopes | Backend de autenticação, perfis e integrantes; coordenação da integração, validação de permissões entre módulos e organização da Wiki |
| Felipe Miranda Morais | Backend de instrumentos e estoque e cálculo de demanda e disponibilidade |
| Lucas Borges Philipsen | Backend de empréstimos e manutenção, infraestrutura compartilhada e apoio aos testes de integração |
| Vitor Eduardo Gonçalves | Backend de ensaios, confirmações e presença |

Todos vamos contribuir com a documentação das nossas partes, e Giovani vai organizar esse material na Wiki. Antes de alterar autenticação, dados compartilhados ou contratos da API, vamos combinar com os responsáveis envolvidos.

## Organização

```text
frontend/          espaço para a futura interface
backend/           espaço para a futura API
database/          espaço para os futuros scripts PostgreSQL
docs/              documentação técnica das tecnologias
CONTRIBUTING.md    organização do nosso trabalho
```

Por enquanto, as pastas de frontend, backend e banco têm apenas arquivos para manter a estrutura no Git. Vamos incluir os scripts e as instruções de instalação, execução e testes junto com a implementação.

## Obter o repositório

```sh
git clone https://github.com/LucasPhilipsen/Sistema-Baterias-Universitarias.git
cd Sistema-Baterias-Universitarias
```

## Acompanhamento

- [Quadro e backlog no Jira](https://pds20262-g14.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog).
- Histórias da Sprint 2: [SCRUM-10 — Acesso](https://pds20262-g14.atlassian.net/browse/SCRUM-10), [SCRUM-12 — Ensaios](https://pds20262-g14.atlassian.net/browse/SCRUM-12) e [SCRUM-13 — Estoque](https://pds20262-g14.atlassian.net/browse/SCRUM-13).
- [Como vamos trabalhar](CONTRIBUTING.md).

Vamos manter as histórias, os critérios de aceite, os responsáveis e o andamento das Sprints no **Jira**. O relatório da disciplina ficará na **Wiki do GitHub**.
