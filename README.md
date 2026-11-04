# Sistema de Gestão de Baterias Universitárias

Projeto da disciplina **Processo de Desenvolvimento de Software**, professora **Fabíola**, **Grupo 14**.

O sistema será uma aplicação web para gerenciar integrantes, instrumentos, ensaios, confirmações, presença, empréstimos e manutenções de baterias universitárias. A funcionalidade central comparará a demanda de instrumentos por ensaio com o estoque disponível.

## Estado do projeto

A **Sprint 1 — Ajustes iniciais do projeto** foi concluída, com a organização do repositório, a definição das tecnologias e do escopo e a preparação do backlog.

A **Sprint 2 — 04 a 11/11/2026** está em andamento e contempla acesso ao sistema por perfil, agenda de ensaios e cadastro e consulta de estoque. O repositório ainda contém a base documental e as pastas reservadas; a implementação será adicionada pelas entregas dos respectivos tickets.

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

Pedro é responsável pelo frontend de todos os módulos. Os demais integrantes desenvolvem o backend de suas áreas e acompanham a integração e a validação das funcionalidades com ele.

| Integrante | Responsabilidade |
| --- | --- |
| Pedro Batista Ribeiro | Frontend de todos os módulos, componentes e navegação |
| Giovani de Oliveira Lopes | Backend de autenticação, perfis e integrantes; coordenação da integração, validação de permissões entre módulos e organização da Wiki |
| Felipe Miranda Morais | Backend de instrumentos e estoque e cálculo de demanda e disponibilidade |
| Lucas Borges Philipsen | Backend de empréstimos e manutenção, infraestrutura compartilhada e apoio aos testes de integração |
| Vitor Eduardo Gonçalves | Backend de ensaios, confirmações e presença |

Cada responsável corrige e valida sua área. A documentação é produzida por todos e organizada por Giovani na Wiki. Contratos de API, autenticação e alterações compartilhadas no banco devem ser combinados entre os responsáveis antes da implementação.

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
- Histórias da Sprint 2: [SCRUM-10 — Acesso](https://pds20262-g14.atlassian.net/browse/SCRUM-10), [SCRUM-12 — Ensaios](https://pds20262-g14.atlassian.net/browse/SCRUM-12) e [SCRUM-13 — Estoque](https://pds20262-g14.atlassian.net/browse/SCRUM-13).
- [Convenções de contribuição](CONTRIBUTING.md).

Histórias, critérios de aceite, responsáveis, prioridades e acompanhamento das Sprints ficam no **Jira**. O relatório da disciplina será publicado na **Wiki do GitHub** nas entregas correspondentes.
