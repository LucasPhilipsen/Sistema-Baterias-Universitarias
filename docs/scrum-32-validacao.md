# SCRUM-32 — instrumentos e estoque

## Referência da entrega

Registro da entrega de instrumentos e estoque do Grupo 14, conferida em
11/11/2026. A branch `feature/SCRUM-32-instrumentos-estoque` foi atualizada
sobre a `main` em `258558d`. Essa base já inclui a agenda de ensaios da SCRUM-28,
publicada no [PR #13](https://github.com/LucasPhilipsen/Sistema-Baterias-Universitarias/pull/13).
A integração preserva as duas entregas nas rotas e no servidor de testes.

O [ticket SCRUM-32](https://pds20262-g14.atlassian.net/browse/SCRUM-32) pede
formulários, listagem e disponibilidade conectados à API, unidades por situação,
validações e restrição de ações por perfil. A implementação segue os contratos
e o roteiro de integração da Sprint 2. A base utilizada já incluía a API
de instrumentos e estoque da SCRUM-31.

## Implementação

- `/instrumentos` substitui a página provisória por cards de disponibilidade
  por tipo e uma lista de unidades com filtros combináveis de tipo e situação.
  A edição de tipo fica no próprio card de disponibilidade, exclusiva da
  diretoria, sem uma lista de tipos separada. As unidades usam a largura disponível.
- Diretoria cadastra e edita tipos e unidades. Integrante consulta e filtra,
  sem controles de alteração. A autorização também foi conferida na API.
- Todas as requisições usam `session.request()` obtido por `useAuth()`.
  `RequireAuth`, login, logout, sessão e revalidação foram preservados.
- Opções de tipo vêm de `GET /tipos-instrumentos`, usando os IDs retornados.
  O corpo JSON contém ID numérico, não o valor textual do controle HTML.
- `POST` e `PUT` enviam somente `nome` para tipos, ou `tipoInstrumentoId`,
  `identificacao` e `observacoes` para unidades. Não há envio de `id` ou
  `situacao` como campos editáveis.
- O frontend normaliza espaços e identificação em maiúsculas, valida o
  alfabeto ASCII da identificação antes da conversão e confere os limites
  de 80 caracteres no nome, 40 na identificação e 500 nas observações.
  Campos opcionais vazios são enviados como `null`.
- Situações disponíveis são `DISPONIVEL`, `EMPRESTADO` e `EM_MANUTENCAO`.
  A situação é apresentada sem campo de edição. Tipos de unidades indisponíveis
  ficam bloqueados no formulário; identificação e observações continuam editáveis.
- O resumo usa os números retornados por `GET /estoque`, inclui tipos zerados
  e separa unidades disponíveis, emprestadas e em manutenção. Não calcula
  disponibilidade a partir da lista filtrada nem oferece quantidade manual.
- Há carregamento, vazio, validação por campo, mensagens de duplicidade,
  tipo inexistente, registro não encontrado, acesso negado, conflito de situação
  e falha de conexão. O formulário preserva os campos nas falhas. Operações
  só recebem sucesso após confirmação válida da API.
- Requisições antigas de filtro são canceladas, sem substituir a consulta
  mais recente. Operações pendentes bloqueiam envios repetidos.

O módulo usa `PageIntro`, `Button`, `FormField`, `Loading`, `Message`, a
identidade Flam e CSS Modules. A página inicial e seus componentes não foram
alterados nesta branch. Não houve mudanças em backend, migrações, dependências
ou código de autenticação. Não foram implementados empréstimos, devoluções,
manutenções ou outras histórias futuras.

Arquivos principais: `frontend/src/pages/Instrumentos.jsx`,
`InstrumentoForm.jsx`, `Instrumentos.module.css`, `instrumentos.js` e
`useStockQuery.js`.

## Evidências de validação

| Verificação | Resultado |
| --- | --- |
| Unitários no Node 24.22.1 | 27 aprovados, incluindo regressões de sessão, HTTP, permissões e validações do novo módulo |
| Build com Vite no Node 24.22.1 | Aprovado |
| Suíte completa no Chrome, desktop e celular | 77 aprovados, 1 ignorado: cenário de menu móvel não aplicável ao projeto desktop |
| Tipos, unidades, filtros e permissões sem interceptação | 8 cenários, correspondentes a quatro fluxos nos dois tamanhos de tela, aprovados com API e PostgreSQL reais |
| Estados de falha e concorrência de consultas | 24 cenários de interface com respostas ou falhas explicitamente simuladas |
| Ajuste da edição para os cards de disponibilidade | Build e 32 cenários do módulo aprovados novamente em desktop/celular: 8 com API e PostgreSQL reais, 24 com falhas simuladas |

A suíte completa foi executada com `ESTOQUE_E2E_POSTGRES=1`, usando PostgreSQL
18 em uma instância local separada, banco novo com prefixo
`bateria_frontend_estoque_test_` e serviços/repositórios reais. Os scripts
`001` a `004` e os usuários fictícios foram aplicados somente nesse banco.
O banco do teste manual e seus dados foram preservados.

As situações emprestada e em manutenção foram preparadas diretamente no
banco de testes, como previsto no contrato. Os tipos começam no ID 73 nesse
ambiente para conferir que a interface não pressupõe ID 1. Não há esses dados
nem IDs fixos no código publicado da aplicação.

`frontend/e2e/instrumentos-api.spec.js` comprovou:

- Cadastro e edição de tipo pela interface, com nome normalizado e ID estável;
  presença do tipo recém-criado no resumo com zero unidades.
- Cadastro e edição de unidade, identificação em maiúsculas, observação vazia
  como `null`, troca de tipo de uma unidade disponível e situação inicial correta.
- Respostas `201` e `200`, corpos somente com campos editáveis, recarga e nova
  consulta. Consulta SQL conferiu tipo vinculado, identificação, observações,
  situação da unidade e nome atualizado do tipo.
- Integrante visualiza disponibilidade e unidades nas três situações, combina
  filtros e encontra listas vazias. Tentativas diretas de cadastro e edição
  de tipos e unidades recebem `403`, sem alteração do registro.
- Unidade emprestada permite correção de texto sem alterar sua situação.
  Tentativa de troca de tipo recebe `409 INSTRUMENTO_INDISPONIVEL`;
  envio de `situacao` no corpo recebe `400`. Unidades em manutenção também
  apresentam o controle de tipo bloqueado.
- Duplicidade de nome por caixa e identificação duplicada são recusadas pela
  API e mostradas no campo correspondente; correção permite concluir o envio.
- Teclado, foco de validação, navegação por Tab e envio com Enter; formulário
  em 320 px e páginas em dimensões de desktop e celular sem rolagem horizontal.
- Ausência de tokens, senhas ou identidade em localStorage e sessionStorage.

`frontend/e2e/instrumentos-errors.spec.js` simula vazio, carregamento,
falha de conexão, `400`, `401`, `403`, `404`, `409`, `500`, mudança de perfil,
resposta malformada, confirmação atrasada e respostas de filtros fora de ordem.
Esses cenários continuam simulados no modo PostgreSQL: não provam falhas reais
provocadas no banco nem mudanças reais de perfil durante gravação.

As regressões existentes de login, logout, revalidação, navbar, logos e
RibbonWave também passaram. As capturas e evidências da rodada ficam em
`frontend/test-results/`, fora do Git. Para repetir, veja
[o README do frontend](../frontend/README.md#estoque-com-api-e-postgresql-reais).

## Conferência da composição com a agenda

As rotas de ensaios e instrumentos permanecem disponíveis. O servidor de testes
usa os dois módulos em memória por padrão e preserva os modos PostgreSQL
independentes de cada módulo. O README reúne as instruções das duas entregas.

A composição passou no build, em 33 testes unitários e em 99 cenários de
navegador, com um cenário de menu móvel ignorado no desktop. Os oito cenários
de estoque com PostgreSQL real também passaram.

## Pendências para a entrega

- Conferir o ambiente de destino e a configuração de banco/proxy; os testes
  locais não confirmam uma publicação nem um ambiente compartilhado.
- Revogação/expiração de sessão e alteração de perfil diretamente no banco
  durante a gravação do módulo permanecem para a validação integrada. Nesta
  entrega os estados de interface correspondentes foram injetados em testes.
- A validação conjunta da SCRUM-34 permanece separada. A SCRUM-33 pode
  aprofundar integridade e concorrência do estoque, sem acrescentar seus
  fluxos futuros a estas telas.
