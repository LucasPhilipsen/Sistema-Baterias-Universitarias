# SCRUM-47 — painel de demanda e disponibilidade

Implementação iniciada e conferida localmente em **23/11/2026**, na branch
`feature/SCRUM-47-painel-demanda`, com base atualizada na `main` em `2e5f9a7`.

Referências: [SCRUM-47](https://pds20262-g14.atlassian.net/browse/SCRUM-47),
[contrato da SCRUM-39](contrato-demanda.md)
e backend publicado na branch `feature/SCRUM-43-calculo-demanda`, commit
`e816eba18113ec714cf424d690d0a66f22efdce2`.

## Escopo implementado

- `/demanda`, exclusivo da diretoria, com entrada nos cards da área administrativa e da
  página inicial. A proteção de rota inclui URL direta, recarga e recuperação do destino
  após login. A navegação de integrantes não mostra o card.
- Seleção explícita de ensaio consultado em `GET /api/ensaios?situacao=AGENDADO`, usando
  IDs da API. Ensaios cancelados não aparecem como opções.
- Consulta por `GET /api/ensaios/:id/demanda`, com `session.request()` e `cache: no-store`.
  Colunas: tipo, confirmados, disponíveis e falta. A falta vem da API, sem duplicar o cálculo
  no frontend. Leitores validam identidade do ensaio, data UTC, inteiros e IDs únicos.
- Destaque de insuficiência com cor e texto, inclusive para tipos sem unidades. Mensagem
  de atendimento somente quando há tipos e todas as faltas retornadas são zero.
- Aviso permanente de estoque atual, sem reserva ou garantia futura. Instante do cálculo
  em São Paulo, mesmo com o navegador configurado em outro fuso.
- Atualização da comparação e da lista de ensaios. Comparações antigas não permanecem
  durante carregamento ou erro; respostas de seleção antiga são canceladas e descartadas.
- Estados de carregamento, ausência de ensaios, ausência de tipos, falha de rede, resposta
  inválida, falta de permissão, ensaio inexistente/cancelado e expiração ou mudança de perfil.
- Reutilização dos componentes e das variáveis visuais existentes. Tabela em desktop e
  linhas adaptadas em celular, sem rolagem horizontal a 320 px. Identificação textual da
  falta, cabeçalhos de tabela e caption para leitura assistiva.

## Verificações

Ambiente: Windows, Node.js **26.13.0**, Chrome. O projeto declara Node.js 24, que não foi
executado nesta máquina. Nenhuma dependência nova foi adicionada.

- `frontend`: `npm test` — 41 testes aprovados.
- `frontend`: `npm run build` — aprovado.
- `frontend`: `npm run test:e2e -- demanda.spec` — 26 cenários aprovados em desktop e celular.
- `frontend`: `npm run test:e2e -- demanda.spec auth.spec navigation.spec` — 59 aprovações
  e 1 cenário exclusivo de celular ignorado no desktop, na execução final com os ajustes visuais.
- `frontend`: `DEMANDA_E2E_BACKEND_ROOT=<checkout-SCRUM-43> npm run test:e2e -- demanda-api.spec`
  — 4 cenários aprovados em desktop e celular.

Os cenários do painel conferem IDs vindos da API, ausência de consulta antes de selecionar,
filtro de cancelados, horário em São Paulo com navegador em Tóquio, atualização com números
novos, descarte de resposta atrasada, remoção de seleção invalidada, vazio, 400/401/403/404/409/500,
falha de rede, resposta malformada, URL restrita e remoção do painel após perda de perfil.
Capturas de desktop e celular foram inspecionadas; um ajuste de largura da caption móvel
foi feito após a primeira conferência.

## Origem das respostas de teste

### Cenários da interface

`demanda.spec.js` intercepta somente as respostas específicas de ensaios e demanda. Login,
sessão e revalidação usam o servidor de autenticação real com repositórios em memória.
As respostas de falha e os números desse arquivo são simulados explicitamente; não
representam consultas ao PostgreSQL nem falhas reais provocadas no banco.

### API publicada da SCRUM-43

`demanda-api.spec.js` usa, por opção explícita, outro checkout da SCRUM-43, sem incorporar
os commits do backend à branch de frontend e sem alterar seus arquivos. A aplicação Express,
rotas, autenticação, cookies, serviço e entidade de cálculo vêm desse checkout. Não há
interceptação de chamadas de demanda nesses quatro cenários.

Os repositórios de ensaios, usuários, sessões, unidades e confirmações são em memória,
preparados pelo suporte exclusivo de testes. A retirada simulada altera apenas essa memória;
o cálculo real passa de três disponíveis e falta dois para dois disponíveis e falta três.
A troca do ensaio consulta outro conjunto de confirmações. Também foram conferidos
400 por filtros extras, 401 sem sessão, 403 para integrante, 404 para ensaio inexistente
e 409 para ensaio cancelado.

Não foram conferidas transações de empréstimo, persistência, concorrência ou consultas SQL
nesse modo. A rota `/api/e2e/demanda/retirada` existe apenas no servidor de testes e não
integra o backend nem o build de produção.

## Pendência para concluir a tarefa

**A SCRUM-47 ainda não está concluída no fluxo integrado com PostgreSQL.**

O contrato da SCRUM-39 e a migração `005-criar-confirmacoes.sql` da SCRUM-37, já presentes
na `main`, definem confirmações ativas por `cancelado_em IS NULL`, sem coluna `situacao`.
O `DemandaRepository` da SCRUM-43 no commit testado (`e816eba`) ainda utiliza
`situacao = 'ATIVA'`. A consulta precisa ser adequada ao contrato antes da conferência SQL.
As branches de backend não foram modificadas.

Após a adequação da consulta e a integração das entregas, repetir o fluxo com API e PostgreSQL reais,
conferindo confirmação, troca de tipo, cancelamento, retirada e devolução na próxima consulta,
inclusive tipos zerados e ensaio cancelado. Registrar o resultado aqui e então avaliar a
conclusão no Jira. O status do Jira não foi alterado nesta implementação.

Comandos e configuração dos testes: [guia do frontend](../frontend/README.md#demanda-e-disponibilidade--scrum-47).
