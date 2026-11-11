# SCRUM-28 — agenda de ensaios

## Referência da entrega

Registro da entrega da agenda de ensaios do Grupo 14, conferida em 11/11/2026.
A implementação está na branch
`feature/SCRUM-28-agenda-ensaios`, baseada na `main` em `65edd7c`, e foi
publicada no [PR #13](https://github.com/LucasPhilipsen/Sistema-Baterias-Universitarias/pull/13).

A base utilizada já incluía os backends SCRUM-27 e SCRUM-31. A agenda segue os
contratos de ensaios e de integração da Sprint 2; trechos dos documentos
compartilhados que ainda descrevem a API de ensaios como pendente não
representam essa versão do código.

## Alterações

- `/ensaios` substitui a página provisória por uma agenda com local, data,
  horário, descrição e situação. Consulta e filtro disponíveis aos dois perfis.
- Diretoria pode cadastrar, editar e confirmar cancelamentos. Cancelados
  permanecem identificados, sem edição, reabertura ou exclusão.
- Campos e métodos seguem o contrato: `GET /ensaios`, `POST /ensaios`,
  `PUT /ensaios/:id` e `PATCH /ensaios/:id/cancelamento` com `{}`.
- Chamadas autenticadas usam somente `session.request()` de `useAuth()`.
  A tela trata expiração, falta de permissão, validações, conflito, falhas de
  conexão, resposta inválida, carregamento e ausência de registros. A gravação
  bloqueia envios repetidos e confirma sucesso somente após uma resposta válida.
- Datas são interpretadas e apresentadas em `America/Sao_Paulo`, com calendário
  validado e regras históricas do fuso. API recebe UTC com `Z`. Alterar somente
  textos preserva os segundos e milissegundos originais. Na hora histórica
  repetida, utiliza-se a primeira ocorrência; horários inexistentes são recusados.
- Identidade Flam e componentes compartilhados foram reutilizados com CSS
  Modules. A entrega inclui os ajustes da página inicial, o rodapé com marca
  centralizada e gradiente animado e a família Ranade servida localmente.
- A entrada administrativa informa a disponibilidade da agenda. Autenticação,
  `RequireAuth`, login, logout, revalidação e código de backend não foram alterados.

Implementação: `frontend/src/pages/Ensaios.jsx`, `Ensaios.module.css`,
`ensaios.js` e registro da rota em `frontend/src/App.jsx`. Testes, suporte
exclusivo de testes e instruções do frontend acompanham a entrega.

## Resultados e limites das evidências

| Verificação | Ambiente e resultado |
| --- | --- |
| Unitários | Node 24.22.1: 25 aprovados, incluindo sessão, HTTP, permissões, calendário, fuso e mensagens |
| Build | Vite com Node 24.22.1: aprovado |
| Suíte completa padrão | Chrome, Node 26.13.0, repositórios em memória: 67 aprovados, 1 ignorado por ser específico do menu móvel no projeto desktop |
| Suíte completa com PostgreSQL | Chrome, Node 24.22.1, PostgreSQL 18 descartável, serviços e repositórios reais: 67 aprovados e o mesmo cenário específico ignorado no desktop |
| Fluxos de ensaios sem interceptação | 4 cenários, correspondentes aos dois fluxos em desktop e celular, aprovados com API e PostgreSQL reais |
| Erros da agenda | 18 cenários em desktop/celular com respostas ou falhas simuladas; não comprovam falhas reais do banco |
| Formulário em 320 px | Rodada adicional no Node 24 com persistência em memória: 4 cenários aprovados e capturas conferidas, incluindo o formulário aberto sem rolagem horizontal |

Na rodada real, a instância foi isolada em `127.0.0.1:55428`, com banco vazio
`bateria_frontend_test_scrum28`. O suporte de testes aplicou somente os scripts
`001`, `002`, `003` e as contas fictícias. Não foi usado nem alterado o banco
local da aplicação. A instância descartável é encerrada após a conferência.

Os cenários de `frontend/e2e/ensaios-api.spec.js` comprovaram:

- Cadastro pela interface com `201`, edição com `200`, descrição vazia como
  `null`, confirmação de cancelamento com `PATCH {}` e `200`.
- Persistência após recarga e nova consulta HTTP. Consulta SQL também conferiu
  `inicio_em`, local, descrição, `CANCELADO` e existência de sessões no banco.
- `2026-11-10 19:00` em São Paulo resulta em `2026-11-10T22:00:00.000Z`,
  com o navegador configurado em `Asia/Tokyo`.
- Integrante consulta e filtra; chamadas diretas de cadastro, edição e
  cancelamento recebem `403` sem alterar o ensaio.
- Cancelamento repetido recebe `200`; edição de cancelado recebe `409`
  com `ENSAIO_CANCELADO`.
- Teclado no formulário, foco nos erros, envio com Enter e navegação por Tab.
  Os dois perfis foram conferidos em dimensões de desktop e celular, sem
  rolagem horizontal. O formulário aberto também foi conferido em 320 px.
- Ausência de dados em localStorage e sessionStorage. As regressões de
  login, logout, cookie HttpOnly, revalidação, navegação, logos e onda passaram.

`frontend/e2e/ensaios-errors.spec.js` simula carregamento, vazio, falha de
conexão, `400`, `401`, `403`, `404`, `409`, `500`, perda de perfil, resposta
malformada e confirmação atrasada. Confere preservação dos campos e ausência
de sucesso prematuro, inclusive ao perder a sessão. Esses cenários continuam
simulados mesmo quando a suíte é iniciada no modo PostgreSQL.

As capturas da rodada real ficam em `frontend/test-results/`, fora do Git.
O comando e os requisitos para repetir com um banco vazio estão no
[README do frontend](../frontend/README.md#ensaios-com-api-e-postgresql-reais).

## Pendências da entrega

- Preparação e conferência do ambiente de destino, incluindo banco e proxy.
  A validação local não confirma uma publicação ou banco compartilhado.
- Expiração/revogação e mudança de perfil provocadas diretamente no banco
  durante uma gravação do módulo ainda não foram conferidas nesta entrega;
  os estados de interface correspondentes foram testados com respostas
  simuladas. As regressões existentes da sessão foram executadas.
- Validação integrada da SCRUM-34, incluindo a conferência conjunta com os
  módulos de instrumentos e estoque da SCRUM-32, que constituem uma entrega
  separada.

Não foram implementados backend, confirmações, presença, demanda, empréstimos,
manutenções ou outras funcionalidades de Sprints futuras.

## Conferência de regressão — 11/11/2026

A conferência final aprovou o build e os 25 testes unitários no Node 24.22.1,
além de 67 cenários de navegador, com um caso de menu móvel ignorado no
projeto desktop. A suíte utilizou um banco novo e isolado com prefixo
`bateria_frontend_test_cleanup_`, descartado após a execução. Os quatro
cenários principais de ensaios usaram serviços e repositórios reais; os 18
cenários de falhas da agenda utilizaram simulações, conforme descrito acima.
