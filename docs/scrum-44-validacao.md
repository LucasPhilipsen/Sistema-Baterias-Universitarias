# SCRUM-44 — tela de cadastro e consulta de integrantes

Registro da implementação e validação local em **22/11/2026** para a
[SCRUM-44](https://pds20262-g14.atlassian.net/browse/SCRUM-44), na história
[SCRUM-11](https://pds20262-g14.atlassian.net/browse/SCRUM-11).

Base: `origin/main`, commit `401bb0f`, com o contrato da SCRUM-36 e a API da
SCRUM-40 já integrados. Trabalho isolado em `feature/SCRUM-44-integrantes`.

## Critérios conferidos

| Critério | Implementação e evidência |
| --- | --- |
| Identidade visual e componentes existentes | Reutiliza AppShell, Header, ModuleGrid, PageIntro, Button, FormField, Message, Loading e variáveis CSS. Capturas de desktop e celular inspecionadas; formulário de 320 px sem rolagem horizontal e envio por teclado. |
| Listagem, cadastro, consulta e edição | `/integrantes` com busca local por nome/e-mail, GET da lista e do registro atual, POST com nome/e-mail/senha e PUT com apenas nome/e-mail. IDs vêm da API. |
| Cliente autenticado | Todas as chamadas usam `session.request()`. Consultas sem cache; requisições antigas são canceladas ao sair ou trocar o registro. |
| Validação e estados | Obrigatoriedade, limites de nome/e-mail, senha com pelo menos 12 caracteres Unicode e até 1024 bytes. Carregamento, vazio, busca sem resultado, falha, nova tentativa, envio pendente e sucesso. Duplicidade destaca e-mail e preserva o formulário. |
| Diretoria | Rota, menus e cards respeitam o perfil, além da autorização HTTP real. Expiração retorna ao login; perda de perfil remove conteúdo e formulário. |
| Persistência | Após resposta válida com o contato enviado, consulta novamente a lista. Cadastro e edição conferidos após recarga, com consulta SQL e login da nova conta. |
| Proteção de credenciais | Leitores mantêm apenas ID, nome, e-mail e perfil. Lista e detalhes não mostram credenciais. Senha só no cadastro; é descartada ao fechar/salvar. Edição não envia senha nem perfil. Sem storage da aplicação. |

## Execuções

Ambiente: Windows, Node.js **26.13.0**, Chrome instalado e PostgreSQL **18**.
O projeto declara Node.js 24; a execução em Node.js 24 não foi conferida nesta máquina.

| Verificação | Resultado |
| --- | --- |
| `frontend`: `npm test` | 36 aprovações |
| `frontend`: `npm run build` | Compilação de produção aprovada |
| `backend`: `npm test` | 56 aprovações; 4 integrações PostgreSQL opcionais ignoradas |
| `frontend`: `npm run test:e2e -- integrantes auth.spec navigation.spec` | 49 aprovações; 1 cenário exclusivo de menu móvel ignorado no desktop |
| `frontend`: `INTEGRANTES_E2E_POSTGRES=1 npm run test:e2e -- integrantes-api` | 8 aprovações com API e PostgreSQL reais, em desktop e celular |

Foram usados os lockfiles existentes e `PLAYWRIGHT_CHANNEL=chrome`. As primeiras
tentativas HTTP sem acesso ao localhost foram bloqueadas pelo ambiente; os testes de
backend e navegador passaram com acesso local habilitado.

## API e PostgreSQL reais

A instância PostgreSQL 18 foi criada exclusivamente para os testes, no loopback e porta
55444. O banco vazio `bateria_frontend_integrantes_test_scrum44` recebeu as tabelas de
usuários, sessões e ensaios e as contas fictícias. O servidor usou `createApp`, autenticação,
scrypt, cookies, serviço e repositório PostgreSQL reais. Não houve interceptação das rotas
de integrantes nesses oito cenários.

Conferências realizadas em desktop e celular:

1. Cadastro pela tela com POST, resposta 201 e somente campos públicos; novo registro
   visível após salvar e após recarregar a página.
2. Alteração por outra requisição seguida de consulta pela tela, confirmando que
   `GET /integrantes/:id` busca o dado atual em vez de copiar a lista anterior.
3. PUT com somente nome/e-mail; atualização na lista e persistência após recarga.
4. SQL pelo ID da API confirmando contato, perfil INTEGRANTE e hash scrypt diferente
   da senha inicial.
5. Login real da conta criada em contexto separado do navegador, com o e-mail atualizado
   e a senha inicial preservada.
6. E-mail da diretoria recusado por duplicidade; destaque no campo, correção e novo envio.
7. Integrante sem acesso ao menu, URL direta ou recarga; 403 nas quatro operações HTTP.
8. Cookie removido seguido de atualização: sessão expirada encaminha ao login.

## Cenários simulados

`integrantes-errors.spec.js` intercepta respostas para conferir lista vazia, carregamento
atrasado, falha de rede e recuperação, descarte de campos extras sensíveis, consulta 404
com nova tentativa, gravação sem confirmação, resposta malformada e revogação de perfil
durante o envio. Esses cenários não comprovam falhas provocadas no PostgreSQL.

Sem a opção PostgreSQL, a API, o serviço, o scrypt e os cookies continuam reais, mas os
repositórios do servidor de testes são em memória e compartilham os usuários com o login.

Capturas de formulário e lista foram inspecionadas visualmente. Os artefatos ficam em
`frontend/test-results/`, fora do Git. Comandos e proteções contra bancos existentes:
[guia do frontend](../frontend/README.md#integrantes--scrum-44).

## Escopo da entrega

Este registro comprova o fluxo local da tela integrado à API e ao PostgreSQL. As alterações
nesta branch são destinadas à revisão por pull request e integração à `main`. O seletor de integrantes no
cadastro de empréstimos pertence à SCRUM-48 e depende daquele módulo. O status do Jira
e a Wiki não foram alterados por esta implementação.
