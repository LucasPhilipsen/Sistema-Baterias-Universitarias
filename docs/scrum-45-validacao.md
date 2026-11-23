# SCRUM-45 — confirmação por instrumento na agenda

Implementação e conferência local em **23/11/2026**, na branch
`feature/SCRUM-45-confirmacoes-ensaios`, com base atualizada na `main` em `ef8b711`.

Contrato: [SCRUM-37](contrato-confirmacoes.md). A integração usou um checkout separado
da API da SCRUM-41 em `cac2f655aa829f5d23c2637d83b78f70aaaff867`, sem alterar seus arquivos
nem incorporar os commits do backend à branch de frontend.

## Critérios conferidos

| Critério | Resultado |
| --- | --- |
| Escolher um tipo existente | Tipos consultados na API, seleção validada e envio de ID inteiro; ausência ou falha de tipos impede confirmar. |
| Confirmar, consultar e cancelar | GET da própria participação em cada card; PUT para confirmar, trocar e reconfirmar; DELETE sem corpo, com confirmação na interface. |
| Mostrar o próprio estado | Sem participação ativa, confirmada com nome do tipo ou registro preservado em ensaio cancelado. Nenhum ID de usuário ou perfil é enviado. |
| Bloquear ensaio cancelado | Controles removidos para CANCELADO; 409 após cancelamento por outra sessão também bloqueia o card e orienta atualizar a agenda. |
| Usar APIs reais | A aplicação usa apenas `session.request()`; ensaios, tipos e participação foram conferidos pelo navegador com API e PostgreSQL reais. |
| Validação, duplicidade, permissão e falhas | Validação por campo, PUT idempotente e registro único, envio bloqueado enquanto pendente, mensagens para 400/401/403/404/409/500 e consulta obrigatória após gravação incerta. |
| Estado após gravação | Atualização apenas após resposta válida da API para o ensaio e tipo solicitados; consulta e recarga preservam os registros. |

São reutilizados PageIntro, Button, Loading, Message, a identidade visual e a agenda
existente. Cada card isola seu estado; a chave também inclui a identidade da sessão.
O formulário não usa storage. Confirmação e cancelamento não reservam nem movimentam unidades.

## Verificações executadas

Ambiente: Windows, Chrome instalado, Node.js **26.13.0** e PostgreSQL **18**. O projeto
declara Node.js 24; essa versão não foi executada nesta máquina. Nenhuma dependência foi adicionada.

- `frontend`: `npm test` — 44 aprovações com a base atualizada, incluindo os testes de demanda da `main`.
- `frontend`: `npm run build` — aprovado.
- `frontend`: `npm run test:e2e -- participacoes.spec` — 22 cenários aprovados em desktop e celular.
- `frontend`: `npm run test:e2e -- participacoes.spec ensaios-api.spec ensaios-errors.spec auth.spec navigation.spec`
  — 77 aprovações e 1 cenário exclusivo de celular ignorado no desktop.
- Após tornar **Atualizar tipos** disponível na barra da agenda e acrescentar a recuperação
  após tipo removido, `npm run test:e2e -- participacoes.spec ensaios-api.spec` teve 26 aprovações.
- Após atualizar a base para `ef8b711` e conciliar os modos do servidor de testes,
  `npm run test:e2e -- participacoes.spec ensaios-api.spec demanda.spec` teve 52 aprovações.
- `CONFIRMACOES_E2E_POSTGRES=1 npm run test:e2e -- participacoes-api.spec` — 8 cenários
  aprovados em desktop e celular, com aplicação Express, autenticação, cookies, serviços,
  repositórios e banco reais, sem interceptar ensaios, tipos ou participação.

### API e PostgreSQL reais

O banco vazio `bateria_frontend_confirmacoes_test_20261123` foi criado em uma instância
PostgreSQL 18 exclusiva para a conferência, no loopback/porta 55445. Foram aplicadas as
migrações `001` a `005` da `main` e as contas fictícias. Tipos começaram no ID 73 e foram
preparadas unidades disponíveis, emprestadas e em manutenção.

A execução foi repetida após a atualização da base para `ef8b711`, com outro banco vazio
(`bateria_frontend_confirmacoes_test_pr_20261123`) e a porta de frontend 5177: os oito
cenários voltaram a passar. A prévia manual permaneceu em outra porta e outro banco.

Os testes criaram ensaios pela API e conferiram:

1. Integrante confirma com tipo retornado pela API; PUT contém apenas `tipoInstrumentoId`.
2. Participação persiste após recarga, troca de tipo, cancelamento e reconfirmação.
3. Repetir PUT mantém o ID; SQL confirma um único registro por usuário/ensaio. Reconfirmar
   após cancelamento reutiliza esse registro e limpa `cancelado_em`.
4. DELETE envia a requisição sem corpo e retorna `participacao: null`; SQL confirma o
   cancelamento lógico. As situações das unidades permanecem iguais antes e depois do fluxo.
5. Integrante e diretoria consultam/alteram somente a própria participação no mesmo ensaio.
   Corpo ou query tentando informar outro usuário são recusados com 400.
6. Ensaio cancelado por outra sessão após a consulta da agenda retorna 409 no PUT, bloqueia
   os controles e aparece cancelado após atualizar. DELETE também recebe 409.
7. Diretoria participa sem perder as ações administrativas. Ao cancelar o ensaio, o registro
   anterior continua consultável e preservado no banco; a interface não oferece alterações.
8. Requisição sem sessão recebe 401. Layout de 320 px não tem rolagem horizontal.

O cenário de cancelamento após carregar a agenda não mede duas transações simultâneas.
Os testes de concorrência, datas idempotentes e efeito na demanda pertencem à validação
do backend/SCRUM-49 e não são anunciados como cobertos por esses oito cenários.

### Respostas simuladas

`participacoes.spec.js` intercepta ensaios, tipos e participação para conferir os estados
da interface. Login e sessão continuam reais com repositórios em memória. Inclui ausência
de tipos, falha e recuperação, consulta malformada, envio único, falha incerta, tipo removido,
permissão, ensaio inexistente, conflito/duplicidade, ensaio cancelado, resposta de outro ensaio
e expiração. Esses cenários não comprovam falhas provocadas no PostgreSQL.

As suítes anteriores de agenda interceptam somente a consulta de participação, que é
validada em seus testes próprios; as operações de ensaio em `ensaios-api.spec.js` continuam
passando pelas rotas reais. A restrição do integrante foi atualizada para impedir ações
administrativas sem impedir o novo controle da própria participação.

## Entrega e execução

O frontend foi validado localmente contra a API publicada da SCRUM-41. O ambiente final
precisa disponibilizar essa API e a migração `005` para o fluxo funcionar. Não foi feita
publicação, alteração do Jira ou da Wiki nesta implementação. Os arquivos estão no worktree
para revisão. Esta entrega modifica a agenda, o controle de participação, seus testes e documentação.

Uma prévia local foi preparada em `http://127.0.0.1:5175/ensaios`, usando a mesma API real
e um banco de demonstração separado (`bateria_frontend_confirmacoes_test_demo_20261123`).
Contém três ensaios fictícios para testar participação ausente, confirmada e preservada em
ensaio cancelado. A conta de integrante é a conta fictícia já documentada no guia de acesso.

Comandos, variáveis e proteção do banco descartável:
[guia do frontend](../frontend/README.md#participação-nos-ensaios--scrum-45).
