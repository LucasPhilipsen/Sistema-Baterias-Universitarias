# Sistema de Gestão de Baterias Universitárias

Projeto da disciplina **Processo de Desenvolvimento de Software**, professora **Fabíola**, **Grupo 14**.

Nosso projeto é uma aplicação web para gerenciar integrantes, instrumentos, ensaios, confirmações, presença, empréstimos e manutenções de baterias universitárias. A principal funcionalidade será comparar a demanda de instrumentos de cada ensaio com o estoque disponível.

## Estado do projeto

Na **Sprint 1 — Ajustes iniciais do projeto**, organizamos o repositório, definimos as tecnologias e o escopo e preparamos o backlog.

Estamos na **Sprint 2 — 04 a 11/11/2026**. Nesta etapa, vamos desenvolver o acesso ao sistema por perfil, a agenda de ensaios e o cadastro e a consulta de estoque. A base Express e a conexão com PostgreSQL foram implementadas na SCRUM-20. A SCRUM-22 prepara o modelo de usuários, os perfis e os dados fictícios de acesso. As demais funcionalidades serão integradas conforme as respectivas tarefas forem entregues.

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

Vamos organizar o servidor em classes de entidades, serviços, repositórios e controladores. Detalhamos essas escolhas em [tecnologias e justificativas](docs/tecnologias.md).

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
frontend/          interface React, acesso, sessão e navegação por perfil
backend/           API Express, entidades e testes
database/          scripts PostgreSQL, dados fictícios e testes
docs/              documentação técnica das tecnologias
CONTRIBUTING.md    organização do nosso trabalho
```

As instruções para criar a tabela de usuários, carregar as contas fictícias e executar os testes da SCRUM-22 estão em [usuários e dados iniciais](database/README.md). A configuração e a execução do backend estão descritas abaixo.

A tela de acesso da SCRUM-24 usa a API de autenticação e protege a navegação por perfil. Os comandos para executar o frontend, as contas de demonstração e os testes de navegador estão no [guia do frontend](frontend/README.md).

## Obter o repositório

```sh
git clone https://github.com/LucasPhilipsen/Sistema-Baterias-Universitarias.git
cd Sistema-Baterias-Universitarias
```

## Configuração e execução do backend

O contrato de login, sessão, saída e permissões para integrar a tela de acesso está em [autenticação — SCRUM-23](docs/autenticacao.md).

### Pré-requisitos
- **Node.js 24 LTS** (conforme `.nvmrc`)
- **PostgreSQL 18** rodando localmente

### 1. Criar o banco de dados
No PostgreSQL, crie o banco da aplicação:
```sql
CREATE DATABASE bateria_db;
```
*(Opcional: para os testes com banco isolado, crie também `CREATE DATABASE bateria_test_db;`)*

Após criar o banco, aplique os scripts de usuários e sessões. A ordem, as contas fictícias e os comandos estão em [usuários e dados iniciais](database/README.md) e no [contrato de autenticação](docs/autenticacao.md#preparar-e-testar).

### 2. Instalar dependências
Entre na pasta `backend/` e instale os pacotes:
```sh
cd backend
npm install
```

### 3. Configurar variáveis de ambiente
Copie o modelo de ambiente `.env.example` para `.env`:
```sh
cp .env.example .env
```
Edite o arquivo `.env` e configure o `DB_PASSWORD` com a senha do seu PostgreSQL local. As variáveis essenciais são validadas na inicialização do servidor.

Para os testes, crie o `.env.test` a partir do exemplo:
```sh
cp .env.test.example .env.test
```

### 4. Executar o servidor
Ainda dentro de `backend/`:

- **Modo desenvolvimento** (com recarregamento automático e `--env-file=.env`):
  ```sh
  npm run dev
  ```
- **Modo padrão**:
  ```sh
  npm start
  ```
O servidor estará disponível em `http://localhost:3000`.

### 5. Executar os testes
Para rodar a suíte de testes com o executor de testes nativo do Node.js (`node:test` e `node:assert/strict`):
```sh
npm test
```

### 6. Verificar a conexão e saúde da API
Acesse a rota `GET http://localhost:3000/api/health` para checar se a API e a conexão com o PostgreSQL estão operacionais:

- **Banco conectado (200 OK):**
  ```json
  {
    "status": "OK",
    "message": "API operacional e conectada ao banco de dados.",
    "timestamp": "2026-11-04T15:10:00.000Z",
    "database": {
      "status": "connected",
      "timestamp": "2026-11-04T12:10:00.123-03"
    }
  }
  ```

- **Banco indisponível (503 Service Unavailable):**
  ```json
  {
    "status": "DEGRADED",
    "message": "API operacional, mas o banco de dados está inacessível.",
    "timestamp": "2026-11-04T15:10:00.000Z",
    "database": {
      "status": "disconnected",
      "error": "connect ECONNREFUSED 127.0.0.1:5432"
    }
  }
  ```

## Acompanhamento

- [Quadro e backlog no Jira](https://pds20262-g14.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog).
- Histórias da Sprint 2: [SCRUM-10 — Acesso](https://pds20262-g14.atlassian.net/browse/SCRUM-10), [SCRUM-12 — Ensaios](https://pds20262-g14.atlassian.net/browse/SCRUM-12) e [SCRUM-13 — Estoque](https://pds20262-g14.atlassian.net/browse/SCRUM-13).
- [Como vamos trabalhar](CONTRIBUTING.md).

Vamos manter as histórias, os critérios de aceite, os responsáveis e o andamento das Sprints no **Jira**. O relatório da disciplina ficará na **Wiki do GitHub**.
