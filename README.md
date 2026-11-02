# Sistema de Gestão de Baterias Universitárias

Projeto da disciplina **Processo de Desenvolvimento de Software**, professora **Fabíola**, **Grupo 14**.

O sistema será uma aplicação web para gerenciar integrantes, instrumentos, ensaios, confirmações, presença, empréstimos e manutenções de baterias universitárias. A funcionalidade central comparará a demanda de instrumentos por ensaio com o estoque disponível.

## Estado do projeto

A entrega atual corresponde à **Sprint 1 — Ajustes iniciais do projeto**: criação e organização do repositório, definição de tecnologias, definição do escopo e organização das histórias no backlog. A implementação da aplicação será feita nas próximas Sprints; ainda não há software executável nesta branch.

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

O backend será orientado a objetos, com classes de entidades, serviços, repositórios e controllers. Ver [tecnologias e justificativas](docs/tecnologias.md).

## Equipe

Cada integrante desenvolverá frontend e backend do módulo sob sua responsabilidade.

| Integrante | Responsabilidade |
| --- | --- |
| Pedro Batista Ribeiro | Usuários, autenticação e integrantes |
| Giovani de Oliveira Lopes | Ensaios, confirmações e presença |
| Felipe Miranda Morais | Estoque e instrumentos |
| Lucas Borges Philipsen | Empréstimos e manutenções |
| Vitor Eduardo Gonçalves | Dashboard, navegação e coordenação da integração |

## Organização

```text
frontend/          espaço para a futura interface
backend/           espaço para a futura API
database/          espaço para os futuros scripts PostgreSQL
docs/              documentação técnica das tecnologias
CONTRIBUTING.md    convenções de colaboração
```

As três pastas de implementação contêm apenas marcadores para preservar a estrutura no Git. Scripts de instalação, execução e teste serão acrescentados quando houver implementação.

## Obter o repositório

```sh
git clone https://github.com/LucasPhilipsen/Sistema-Baterias-Universitarias.git
cd Sistema-Baterias-Universitarias
```

## Acompanhamento

- [Quadro e backlog no Jira](https://pds20262-g14.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog).
- [SCRUM-5 — Ajustes iniciais do projeto](https://pds20262-g14.atlassian.net/browse/SCRUM-5).
- [Convenções de contribuição](CONTRIBUTING.md).

Histórias, critérios de aceite, responsáveis, prioridades e acompanhamento das Sprints ficam no **Jira**. O relatório da disciplina será publicado na **Wiki do GitHub** nas entregas correspondentes.
