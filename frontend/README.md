# Interface — acesso, sessão, ensaios, estoque, integrantes, empréstimos e demanda

JavaScript, React 19, Vite 8 e CSS Modules. Requer Node.js 24 LTS e npm.

A [direção visual](../docs/design.md) usa a identidade do Flam: branco, azul-marinho e índigo, fonte Söhne variável e Source Code Pro servidas localmente, divisórias finas e cantos de 4 px.

A página inicial apresenta título e subtítulo ampliados, com navegação pela navbar e pelos módulos. A faixa [LogoLoop](src/components/LogoLoop/README.md) com as sete baterias fornecidas fica entre a abertura e os módulos. Os logos têm 80 px, espaços de 128 px e rolagem contínua sem botões. A animação pausa somente sobre um logo, retoma ao sair, permite arraste e respeita movimento reduzido. As imagens finais com fundo transparente ficam em `public/logos/`, mantendo os pixels internos dos emblemas.

## Executar com a API

Prepare o backend e o PostgreSQL conforme o [README da raiz](../README.md) e o [contrato da SCRUM-23](../docs/autenticacao.md). Aplique os scripts de estrutura `001` a `004` e, no ambiente de desenvolvimento, as contas fictícias. Inicie o backend em http://localhost:3000.

Em outro terminal, na raiz do repositório:

```sh
cd frontend
npm ci
npm run dev
```

Abra o endereço informado pelo Vite (normalmente http://localhost:5173). O proxy encaminha `/api` ao backend, mantendo o cookie e a verificação de origem. A opção `changeOrigin: false` preserva o cabeçalho Host para a comparação com Origin feita pela API.

Contas exclusivas de demonstração, disponíveis após carregar os dados iniciais:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Integrante | integrante@bateria.example | IntegranteDemo!2026 |
| Diretoria | diretoria@bateria.example | DiretoriaDemo!2026 |

O formulário usa `POST /api/auth/login`, envia somente `email` e `senha` e mostra mensagens para credenciais inválidas, limite de tentativas e indisponibilidade. A senha não é aparada nem persistida. Durante o envio, o formulário impede novas submissões.

## Sessão e permissões

- O backend mantém a sessão de oito horas e o cookie HttpOnly. A interface guarda apenas o usuário em memória; não usa localStorage nem sessionStorage.
- `GET /api/auth/me` restaura a sessão na abertura e a revalida ao entrar em uma rota protegida, ao retomar a aba e a cada minuto enquanto a aplicação estiver visível e autenticada. A consulta não prolonga a sessão.
- A revalidação automática acontece em segundo plano e preserva a tela, o foco e os formulários abertos. A entrada em uma rota protegida aguarda a conferência; expiração ou falha na consulta bloqueiam o acesso.
- `POST /api/auth/logout` revoga a sessão antes de confirmar a saída. Uma falha bloqueia o conteúdo e oferece uma nova tentativa; não anuncia uma revogação que não aconteceu.
- A entrada e a saída da conta são comunicadas às outras abas por BroadcastChannel quando disponível. A revalidação ao retomar a aba e nas rotas também funciona sem esse recurso.
- Integrantes acessam `/ensaios`, `/instrumentos` e `/emprestimos`; diretoria também acessa `/administracao`, `/integrantes` e `/demanda`. O destino padrão após login é `/ensaios` para integrante e `/administracao` para diretoria. O destino anterior é recuperado somente se for interno, conhecido e permitido.
- A área da diretoria tem proteção de rota, inclusive ao digitar a URL ou recarregar. Sessão ausente redireciona para `/acesso`; perfil sem permissão recebe uma mensagem de acesso restrito. Enquanto a sessão é verificada, o conteúdo protegido não é exibido. Perfis desconhecidos e falhas na consulta bloqueiam o acesso.
- As operações administrativas continuam protegidas pelos componentes intermediários de autorização da SCRUM-23 no servidor. A página administrativa é uma entrada para os módulos. A agenda da SCRUM-28 permite gerir ensaios; o módulo da SCRUM-32 permite cadastrar e editar tipos e unidades e consultar o estoque.

## Organização e integração dos próximos módulos

- `src/pages/Login.jsx`: formulário de acesso e mensagens.
- `src/auth/session.js`: restauração, login, logout e cliente de requisições autenticadas; protege o estado contra respostas atrasadas de uma sessão anterior.
- `src/auth/AuthContext.jsx`: contexto React, sincronização entre abas e revalidação.
- `src/auth/RequireAuth.jsx`: proteção de rotas e estados de indisponibilidade.
- `src/auth/access.js`: perfis, permissões da interface e destinos de navegação.
- `src/services/http.js`: requisições JSON pela API Fetch, cookie na mesma origem, limite padrão de 15 segundos, erros HttpError e sinal AbortSignal opcional.
- `src/components/ui.jsx`: componentes acessíveis de botão (`Button`), link de ação (`ActionLink`), campo de formulário (`FormField`), mensagem (`Message`) e carregamento (`Loading`).

Nos módulos autenticados, use o cliente disponibilizado pelo contexto, preservando a autorização da API:

```jsx
const { session } = useAuth();
// Quando a rota do módulo estiver implementada:
const dados = await session.request('/caminho-do-modulo', { signal });
```

Um `401` desse cliente limpa a identidade e encaminha o fluxo à tela de acesso. Um `403` reconsulta o perfil e continua sendo retornado ao módulo, que deve informar a falta de permissão. O corpo bruto do erro não deve ser mostrado ao usuário.

## Agenda de ensaios — SCRUM-28

`/ensaios` consulta a API real por `session.request()`, obtido com `useAuth()`.
Os dois perfis consultam a agenda e filtram agendados, cancelados ou todos. A
diretoria também cadastra e edita ensaios e confirma seu cancelamento. Cancelados
continuam visíveis e não oferecem edição ou reabertura.

Data e horário são preenchidos separadamente no fuso `America/Sao_Paulo`.
`src/pages/ensaios.js` valida o calendário e calcula o instante usando as regras
do fuso fornecidas por `Intl`; envia ISO 8601 em UTC com `Z`. A exibição e a
edição usam explicitamente São Paulo, mesmo em computadores com outro fuso.
Horários inexistentes no salto histórico de horário de verão são recusados;
na hora repetida, é usada a primeira ocorrência. Edições somente de texto
preservam os segundos e milissegundos do instante recebido.

A interface trata carregamento, lista vazia, validações, falta de permissão,
registro inexistente, conflito de cancelamento e falhas de conexão. Não mantém
dados fictícios na aplicação nem confirma operações antes da resposta da API.
Uma falha de rede durante uma alteração pode deixar o resultado desconhecido:
a mensagem orienta consultar novamente a agenda antes de repetir o envio.

O backend da SCRUM-27 e os scripts `001`, `002` e `003` são necessários para
usar a agenda. A disponibilidade deve ser conferida no ambiente de destino;
a implementação da tela não substitui a preparação desse ambiente.

## Participação nos ensaios — SCRUM-45

Cada card de `/ensaios` consulta e mostra **Minha participação**. Integrantes e diretoria
podem confirmar a própria participação, escolher outro tipo, cancelar com confirmação na
tela e reconfirmar. A lista de tipos vem de `GET /api/tipos-instrumentos`; IDs são enviados
como inteiros, sem valores fixos no código da aplicação. Confirmar não reserva uma unidade.

O fluxo segue o [contrato da SCRUM-37](../docs/contrato-confirmacoes.md):

| Operação | Requisição |
| --- | --- |
| Consultar ou atualizar o estado | `GET /api/ensaios/:id/minha-participacao` |
| Confirmar, trocar tipo ou reconfirmar | `PUT /api/ensaios/:id/minha-participacao` com apenas `tipoInstrumentoId` |
| Cancelar participação | `DELETE /api/ensaios/:id/minha-participacao`, sem corpo |

Todas as chamadas passam por `session.request()`. Não há ID de usuário, perfil ou
identidade de outro integrante nas requisições. A tela aceita somente uma resposta válida
para o ensaio solicitado antes de atualizar o estado. `participacao: null` significa que
não há participação ativa; a API usa esse mesmo retorno para quem nunca confirmou ou cancelou.

Há carregamento, ausência/falha de tipos, validação de seleção, falha de consulta, erro de
gravação e nova tentativa. Uma gravação em andamento bloqueia as ações e os filtros da
agenda, evitando submissões duplicadas e a desmontagem do card durante o envio. Em falha
sem confirmação, é preciso usar **Atualizar participação** antes de repetir a alteração.

Ensaio cancelado preserva a consulta do registro e remove controles de alteração. Se for
cancelado por outra sessão depois de carregar a página, o `409 ENSAIO_CANCELADO` também
bloqueia o card e orienta atualizar a agenda. O backend continua responsável pela autorização
e unicidade; o PUT é idempotente. A diretoria mantém os controles administrativos existentes.

Arquivos principais: `src/pages/ParticipacaoEnsaio.jsx`, `ParticipacaoEnsaio.module.css` e
`participacoes.js`, integrados à página `Ensaios.jsx`.

Para testar estados da interface com respostas interceptadas e sessão real, em `frontend/`:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:E2E_PORT = '5175' # Opcional; o padrão é 5174.
try {
  npm run test:e2e -- participacoes.spec
} finally {
  Remove-Item Env:PLAYWRIGHT_CHANNEL, Env:E2E_PORT
}
```

Para conferir a interface com API e PostgreSQL reais, prepare um checkout separado da
branch `feature/SCRUM-41-backend-confirmacoes`, instale suas dependências de backend e crie
um banco vazio e descartável com prefixo `bateria_frontend_confirmacoes_test_`. Configure
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` no ambiente local e execute:

```powershell
$env:CONFIRMACOES_E2E_BACKEND_ROOT = 'C:/caminho/checkout-SCRUM-41'
$env:CONFIRMACOES_E2E_POSTGRES = '1'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:E2E_PORT = '5175'
try {
  npm run test:e2e -- participacoes-api.spec
} finally {
  Remove-Item Env:CONFIRMACOES_E2E_BACKEND_ROOT, Env:CONFIRMACOES_E2E_POSTGRES, Env:PLAYWRIGHT_CHANNEL, Env:E2E_PORT
}
```

O servidor de testes exige `NODE_ENV=test`, recusa banco preenchido ou fora do prefixo e
aplica as migrações `001` a `005` e as contas fictícias. Não intercepta respostas de ensaios,
tipos ou participação nesse modo. Cada teste cria seu ensaio pela API real; a conferência
SQL valida persistência, unicidade, cancelamento lógico e preservação das unidades físicas.
Use outro banco vazio para repetir. Sem esse modo, os oito cenários de API são ignorados.

A API da SCRUM-41 deve estar disponível no ambiente final para usar a funcionalidade.
O checkout separado serve à integração local e não é incorporado ao build do frontend.
O [registro da SCRUM-45](../docs/scrum-45-validacao.md) diferencia os cenários reais dos simulados.

## Instrumentos e estoque — SCRUM-32

`/instrumentos` apresenta os tipos nos cards de disponibilidade e uma lista de unidades. Integrantes
consultam as listas, os três estados de uma unidade e os filtros de tipo e situação,
que podem ser combinados. A diretoria também cadastra e edita tipos e unidades;
a edição de cada tipo fica no próprio card de disponibilidade, sem uma lista separada.
O resumo vem de `GET /estoque`, inclui tipos sem unidades e considera disponível
somente a situação `DISPONIVEL`; os filtros da lista de unidades não alteram o
resumo geral.

Todos os pedidos passam por `session.request()` de `useAuth()`. Não há dados
fictícios ou IDs de tipos fixos no código da aplicação: as opções do formulário
e do filtro vêm de `GET /tipos-instrumentos`. As alterações usam `POST` ou
`PUT`, enviando somente `nome` para tipos ou `tipoInstrumentoId` numérico,
`identificacao` e `observacoes` para unidades.

A situação é somente de consulta. Unidades novas começam disponíveis; o
formulário de edição bloqueia a troca de tipo de unidades emprestadas ou em
manutenção, mas permite corrigir identificação e observações. A API continua
responsável por validar permissões e a situação atual ao gravar. Não há
exclusão, empréstimo, devolução nem manutenção nesta entrega.

O frontend valida nomes com até 80 caracteres, identificação ASCII com até 40
caracteres e observações com até 500 caracteres, normalizando espaços e
maiúsculas conforme o contrato. Mostra carregamento, vazio, validação por campo,
duplicidade, tipo inexistente, conflito de situação, acesso negado e falha de
conexão. Uma alteração só é anunciada como concluída depois da resposta válida
da API; em falha de rede, consulte novamente antes de repetir o envio. Consultas
antigas de filtros são canceladas e não substituem respostas mais recentes.

Arquivos principais: `src/pages/Instrumentos.jsx`, `InstrumentoForm.jsx`,
`instrumentos.js`, `useStockQuery.js` e `Instrumentos.module.css`.
O backend da SCRUM-31 e as estruturas `001`, `002` e `004` precisam estar
disponíveis no ambiente. Preparar a tela não substitui conferir esse ambiente.

## Integrantes — SCRUM-44

O módulo `/integrantes` aparece na navegação, na página inicial e na área da diretoria
somente para esse perfil. A rota também bloqueia consulta e alteração para integrantes,
inclusive por URL direta e recarga, seguindo o [contrato da SCRUM-36](../docs/contrato-integrantes.md).

A listagem permite buscar localmente por nome ou e-mail, sem enviar filtros não aceitos
pela API. As ações Consultar e Editar buscam o registro atual em `GET /integrantes/:id`.
O cadastro envia `nome`, `email` e `senha` por `POST /integrantes`; a edição envia
somente `nome` e `email` por `PUT /integrantes/:id`. Todas as chamadas usam
`session.request()`. O backend define o perfil `INTEGRANTE`.

O formulário valida nome até 120 caracteres, e-mail único até 254 caracteres e senha
inicial com pelo menos 12 caracteres Unicode e até 1024 bytes UTF-8, preservando espaços
da senha. A senha aparece apenas no cadastro e é descartada ao fechar ou concluir o
formulário. Os leitores mantêm somente `id`, `nome`, `email` e `perfil`; a lista exibe
nome e e-mail. Não há senha, hash ou opção de alterar perfil na consulta ou edição.

Há estados de carregamento, lista vazia, busca sem resultados, consulta individual com
nova tentativa, validação por campo e falha de gravação. E-mail duplicado destaca o campo
e preserva o formulário. Durante o envio, campos e ações ficam bloqueados. A tela anuncia
sucesso somente após resposta válida da API e consulta novamente a lista. Em falha de
rede, orienta atualizar a lista antes de repetir o envio. Erros `401` e `403` seguem o
tratamento de sessão existente, incluindo remoção do formulário quando o perfil muda.

Arquivos principais: `src/pages/Integrantes.jsx`, `IntegranteForm.jsx`, `integrantes.js`
e `Integrantes.module.css`. A API da SCRUM-40 e as tabelas de usuários e sessões precisam
estar disponíveis; não há dados de demonstração no código da tela.

Para conferir no navegador, com as dependências de frontend e backend instaladas:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try { npm run test:e2e -- integrantes } finally { Remove-Item Env:PLAYWRIGHT_CHANNEL }
```

Por padrão, o servidor de testes usa a API, o serviço de integrantes, o scrypt e os cookies
reais com repositórios em memória compartilhados com o login. `integrantes-errors.spec.js`
intercepta respostas para conferir indisponibilidade e outros estados de falha.

Para conferir persistência real, crie um banco PostgreSQL vazio e descartável com prefixo
`bateria_frontend_integrantes_test_`. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`
e `DB_PASSWORD` no ambiente local. O teste recusa outros nomes e bancos já preenchidos;
aplica as estruturas de usuários, sessões e ensaios e os usuários fictícios. IDs novos
começam em 73 para conferir o uso dos identificadores reais. Em `frontend/`:

```powershell
$env:INTEGRANTES_E2E_POSTGRES = '1'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try {
  npm run test:e2e -- integrantes-api
} finally {
  Remove-Item Env:INTEGRANTES_E2E_POSTGRES, Env:PLAYWRIGHT_CHANNEL
}
```

Use outro banco vazio para repetir e descarte o banco após a execução. Nesse modo não
reutilize o servidor de testes em memória. A suíte confere cadastro, consulta individual,
edição, recarga, login com novo e-mail e a senha inicial, duplicidade e bloqueios por
perfil/sessão. Também consulta o banco diretamente para conferir contato, perfil e hash.
O [registro da SCRUM-44](../docs/scrum-44-validacao.md) separa os resultados reais dos simulados.

## Demanda e disponibilidade — SCRUM-47

A diretoria encontra o painel em **Diretoria → Demanda e disponibilidade**, no card da
página inicial ou diretamente em `/demanda`. Integrantes não veem esse card e recebem
acesso restrito na URL, inclusive após recarregar.

A lista vem de `session.request('/ensaios?situacao=AGENDADO')`. Ao escolher um ensaio,
o painel consulta `session.request('/ensaios/' + id + '/demanda')`, sem corpo ou parâmetros
adicionais. Não há IDs nem dados fictícios no módulo. Os campos `confirmados`, `disponiveis`
e `falta` são os números retornados pela API, conforme o contrato da SCRUM-39; a tela não
refaz o cálculo. Tipos com falta recebem destaque de cor e o texto **Insuficiente**.

O aviso permanente explica que a comparação usa o estoque atual e não reserva unidades.
`calculadoEm` aparece em `America/Sao_Paulo`, independentemente do fuso do navegador.
**Atualizar comparação** repete a consulta sem cache. Os resultados anteriores saem da tela
enquanto a consulta ocorre; respostas atrasadas de outra seleção não substituem a atual.
**Atualizar ensaios** consulta novamente a agenda e remove seleções que deixaram de estar
agendadas. O usuário escolhe o ensaio explicitamente; o painel não guarda essa seleção em storage.

Há estados para agenda vazia, ausência de tipos, carregamento, falha de conexão, resposta
inválida, sessão expirada, falta de permissão, ensaio inexistente e ensaio cancelado. Ao
falhar uma atualização, a tela não mantém números antigos como se fossem atuais.

Arquivos principais: `src/pages/Demanda.jsx`, `Demanda.module.css`, `demanda.js` e
`useDemanda.js`. O painel precisa da API de demanda da SCRUM-43. A `main` usada nesta
entrega ainda não possui essa rota; o frontend não inclui uma rota substituta em produção.

Para testar os estados da interface com respostas interceptadas e sessão real:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try { npm run test:e2e -- demanda.spec } finally { Remove-Item Env:PLAYWRIGHT_CHANNEL }
```

Para testar sem interceptar as rotas HTTP de demanda, prepare um checkout separado da
branch `feature/SCRUM-43-calculo-demanda` e instale as dependências de seu `backend/`.
Informe o caminho da raiz desse checkout (não a pasta backend):

```powershell
$env:DEMANDA_E2E_BACKEND_ROOT = 'C:/caminho/checkout-SCRUM-43'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try {
  npm run test:e2e -- demanda-api.spec
} finally {
  Remove-Item Env:DEMANDA_E2E_BACKEND_ROOT, Env:PLAYWRIGHT_CHANNEL
}
```

Esse modo usa a aplicação Express, autenticação, sessão, controller, serviço e cálculo
reais daquele checkout, com repositórios e movimentações simulados em memória. Ele exige
`NODE_ENV=test`, imposto pelo servidor exclusivo de testes. Não comprova a integração SQL
ou o fluxo real de confirmações e empréstimos. Sem o caminho explícito, os quatro cenários
de `demanda-api.spec.js` são ignorados.

O contrato da SCRUM-39 já está na `main` e define confirmações ativas por
`cancelado_em IS NULL`, conforme a SCRUM-37. O backend da SCRUM-43 usado na conferência
(commit `e816eba`) ainda consulta `situacao = 'ATIVA'`. A integração com PostgreSQL precisa
aguardar a adequação dessa consulta e a disponibilização dos módulos reais.
Os resultados e limites da conferência estão no [registro da SCRUM-47](../docs/scrum-47-validacao.md).

## Empréstimos e devoluções — SCRUM-46

Abra o card **Empréstimos** na página inicial ou na área da diretoria, ou acesse
`/emprestimos`. O módulo segue o [contrato da SCRUM-38](../docs/contrato-emprestimos.md):

- Diretoria escolhe um integrante de `GET /api/integrantes` e uma unidade de
  `GET /api/instrumentos?situacao=DISPONIVEL`; confirma a retirada com
  `POST /api/emprestimos`, enviando somente os dois IDs numéricos selecionados.
- A devolução exige uma confirmação e usa `PUT /api/emprestimos/:id/devolucao`
  com `{}`. Datas e situação vêm do servidor. O frontend não altera o estoque por conta própria.
- O histórico usa `GET /api/emprestimos`, sem filtros. A API deve restringir os
  registros do integrante ao ID da sessão. Integrantes não consultam cadastros
  administrativos nem veem ações de retirada ou devolução.
- Todas as chamadas passam por `session.request()`. Depois de gravar, consultar
  novamente histórico, integrantes e unidades disponíveis. Uma resposta inválida
  não anuncia sucesso; conflitos atualizam as opções e descartam seleções removidas.
- A interface exibe carregamento, vazio, falha com nova consulta, validação de
  seleção e mensagens para sessão expirada, permissão negada e conflitos. Datas
  aparecem no fuso `America/Sao_Paulo`; campos sensíveis não são renderizados.

A base `ef8b711` contém o contrato e o script `006`, mas ainda não registra as
rotas de empréstimos da SCRUM-42. A tela está preparada para essas rotas reais;
sem elas, a consulta exibe indisponibilidade. A implementação não inclui uma
API fictícia na aplicação nem conclui a integração com PostgreSQL.

Para conferir a interface, instale as dependências de `frontend/` e `backend/`.
Em `frontend/`, com Chrome instalado:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:E2E_PORT = '5178'
try {
  npm run test:e2e -- emprestimos
} finally {
  Remove-Item Env:PLAYWRIGHT_CHANNEL, Env:E2E_PORT
}
```

`e2e/emprestimos.spec.js` simula explicitamente as respostas de empréstimos pelo
contrato. Um cenário usa as APIs reais de integrantes, tipos e unidades com
persistência em memória para conferir cadastros novos nos seletores. Esses testes
não comprovam transações, isolamento do histórico no servidor ou persistência no
PostgreSQL. O [registro da validação](../docs/scrum-46-validacao.md) descreve os
resultados e os passos pendentes para a conferência conjunta com SCRUM-42 e SCRUM-50.

## Configuração e publicação

`.env.example` documenta `VITE_API_BASE_URL`; vazio usa `/api`. Essa variável fica pública na versão compilada. Na configuração atual da API, use a mesma origem e um proxy reverso para `/api`: o servidor não habilita CORS e recusa entrada e saída de contas por outra origem. Uma URL externa exige alinhamento de CORS, cookies e origem com o responsável pela API.

```sh
npm run build
npm run preview
```

O comando `build` gera a versão compilada em `dist/`. O comando `preview` disponibiliza essa versão localmente e herda o proxy configurado para o servidor em localhost:3000; mantenha a API local em execução. A hospedagem publicada deve encaminhar `/api` para o servidor. Em produção, o cookie Secure exige HTTPS.

A hospedagem deve servir `index.html` nas rotas do BrowserRouter (`/acesso`, `/ensaios`, `/instrumentos`, `/integrantes`, `/emprestimos`, `/demanda`, `/administracao`), preservando os caminhos da API.

## Testes

Na pasta `frontend/`:

```sh
npm test
npm run build
```

Os testes unitários verificam o cliente HTTP, permissões, destinos, restauração, expiração, erros, logout e respostas concorrentes.

Para testar no navegador, instale também as dependências do backend (`cd backend` e `npm ci` a partir da raiz). Depois, em `frontend/`:

```sh
npx playwright install chromium
npm run test:e2e
```

Alternativamente, com Chrome instalado, em PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

A suíte inicia o Vite na porta 5174 e a API Express em uma porta local livre. Por padrão, usa rotas de autenticação, ensaios e estoque, validação scrypt, cookie e componentes intermediários reais com repositórios em memória: não acessa o banco da aplicação. O servidor `e2e/server.js` exige `NODE_ENV=test`; sua rota de teste da diretoria não integra a aplicação publicada. Falhas de rede, limite de tentativas e mudança de perfil são injetados apenas nos cenários correspondentes.

Defina `E2E_PORT` para executar em outra porta livre, sem interromper outras prévias locais. A configuração do Playwright e o servidor usam o mesmo valor; o padrão continua sendo 5174.

Se esse mesmo servidor de testes já estiver rodando para conferência manual, defina `PLAYWRIGHT_REUSE_SERVER=1` para reutilizá-lo. Por padrão, a suíte exige a porta livre e gerencia seu próprio servidor.

Os cenários rodam em computador e em dimensões de tela de celular: acesso válido ou inválido, restauração, navegação, URL administrativa, autorização HTTP, saída e revogação de sessão, cookie expirado, recuperação de falhas e sincronização entre abas. Capturas de tela e registros detalhados de falhas ficam em `test-results/`, fora do Git.

A integração com PostgreSQL é uma verificação separada, documentada no contrato da SCRUM-23, e exige banco descartável configurado. Para conferir manualmente com o banco real, use as duas contas de demonstração, recarregue os módulos, tente `/administracao` como integrante, saia e confira que uma nova abertura do módulo exige login.

Os padrões reutilizáveis e exemplos de composição estão em [Componentes da interface](../docs/frontend-components.md).

O contrato compartilhado com ensaios e estoque e os cenários de validação estão em [Integração da Sprint 2](../docs/integracao-sprint-2.md).

### Ensaios com API e PostgreSQL reais

Os cenários `e2e/ensaios-api.spec.js` executam cadastro, edição, cancelamento,
recarga, consulta e autorização HTTP sem interceptar as chamadas de ensaios.
Por padrão, somente a persistência é simulada. `e2e/ensaios-errors.spec.js`
intercepta respostas e falhas explicitamente; esses cenários não comprovam
persistência no PostgreSQL.

Para executar os fluxos com repositórios reais, crie um banco **vazio e
descartável** chamado `bateria_frontend_test_<sufixo>` na sua instância de
testes. Em `frontend/`, configure a conexão sem versionar a senha:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_NAME = 'bateria_frontend_test_sua_execucao'
$env:DB_USER = 'postgres'
# Defina DB_PASSWORD no ambiente local conforme a instância de testes.
$env:ENSAIOS_E2E_POSTGRES = '1'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try {
  npm run test:e2e -- ensaios-api
} finally {
  Remove-Item Env:ENSAIOS_E2E_POSTGRES, Env:PLAYWRIGHT_CHANNEL
}
```

Esse modo recusa nomes fora do prefixo e bancos que já tenham tabelas públicas.
Aplica `001`, `002`, `003` e as contas fictícias, usando os serviços e
repositórios da aplicação. Os testes também consultam o SQL para conferir o
instante, textos, cancelamento e existência de sessões persistidas. Não apaga
o banco; descarte-o depois pela rotina da sua instância e use outro banco vazio
para repetir. Não reutilize um servidor iniciado no modo em memória.

O [registro da SCRUM-28](../docs/scrum-28-validacao.md) diferencia os ambientes,
as evidências e as pendências desta entrega.

### Estoque com API e PostgreSQL reais

`e2e/instrumentos-api.spec.js` testa as operações HTTP sem interceptar as
chamadas de tipos, unidades e estoque. Por padrão, somente a persistência é
simulada. Para usar PostgreSQL 18 com os repositórios reais, crie um banco vazio
e descartável chamado `bateria_frontend_estoque_test_<sufixo>`, configure sua
conexão no ambiente e execute, a partir de `frontend/`:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_NAME = 'bateria_frontend_estoque_test_sua_execucao'
$env:DB_USER = 'postgres'
# Defina DB_PASSWORD no ambiente local conforme sua instância de testes.
$env:ESTOQUE_E2E_POSTGRES = '1'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try {
  npm run test:e2e -- instrumentos-api
} finally {
  Remove-Item Env:ESTOQUE_E2E_POSTGRES, Env:PLAYWRIGHT_CHANNEL
}
```

Esse modo recusa bancos fora do prefixo ou que já contenham tabelas públicas.
Aplica os quatro scripts de estrutura e os usuários fictícios. Prepara um tipo
com unidades nas três situações e outro tipo zerado, diretamente no banco de
testes; a sequência de tipos começa em 73 para conferir IDs sem valores fixos
na interface. O teste também verifica a persistência por SQL. Use outro banco
vazio para repetir e descarte o banco de testes depois da execução. Não reutilize
um servidor iniciado no modo em memória.

`e2e/instrumentos-errors.spec.js` intercepta respostas e falhas explicitamente.
Esses cenários não comprovam falhas reais provocadas no PostgreSQL, mesmo
quando o servidor está configurado no modo de integração.

O [registro da SCRUM-32](../docs/scrum-32-validacao.md) detalha a versão, os
cenários reais, os simulados e as pendências da entrega.

Execute os modos PostgreSQL de ensaios e estoque separadamente, com apenas a variável de ativação do modo escolhido e um banco vazio com o prefixo correspondente.

### Conferência conjunta — SCRUM-29, SCRUM-33 e SCRUM-34

O modo `ESTOQUE_E2E_POSTGRES=1` prepara os quatro scripts e usa os serviços
reais de autenticação, ensaios e estoque. Para executar a suíte completa no
banco descartável configurado acima, defina também `NODE_ENV=test`:

```powershell
$env:NODE_ENV = 'test'
$env:ESTOQUE_E2E_POSTGRES = '1'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
try {
  npm run test:e2e
} finally {
  Remove-Item Env:NODE_ENV, Env:ESTOQUE_E2E_POSTGRES, Env:PLAYWRIGHT_CHANNEL
}
```

Use um banco vazio a cada rodada. Para executar somente os novos cenários,
use `npm run test:e2e -- integracao.postgres`. Sem o opt-in, esses cenários
aparecem como ignorados e não acessam PostgreSQL.

`integracao.postgres.spec.js` altera sessão e perfil diretamente no banco
descartável, retendo o envio até concluir a alteração e depois encaminhando a
requisição à API real. Não fabrica respostas `401` ou `403`. Confere também
que a gravação recusada não alterou o registro, a navegação entre módulos,
o logout persistido, a unicidade global, o vínculo com tipo e as contagens.
Os testes de falhas simuladas dos módulos continuam explicitamente simulados.
