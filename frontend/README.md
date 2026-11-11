# Interface — acesso, sessão, ensaios e estoque (SCRUM-24, SCRUM-28 e SCRUM-32)

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
- Integrantes acessam `/ensaios` e `/instrumentos`; diretoria também acessa `/administracao`. O destino padrão após login é `/ensaios` para integrante e `/administracao` para diretoria. O destino anterior é recuperado somente se for interno, conhecido e permitido.
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

## Configuração e publicação

`.env.example` documenta `VITE_API_BASE_URL`; vazio usa `/api`. Essa variável fica pública na versão compilada. Na configuração atual da API, use a mesma origem e um proxy reverso para `/api`: o servidor não habilita CORS e recusa entrada e saída de contas por outra origem. Uma URL externa exige alinhamento de CORS, cookies e origem com o responsável pela API.

```sh
npm run build
npm run preview
```

O comando `build` gera a versão compilada em `dist/`. O comando `preview` disponibiliza essa versão localmente e herda o proxy configurado para o servidor em localhost:3000; mantenha a API local em execução. A hospedagem publicada deve encaminhar `/api` para o servidor. Em produção, o cookie Secure exige HTTPS.

A hospedagem deve servir `index.html` nas rotas do BrowserRouter (`/acesso`, `/ensaios`, `/instrumentos`, `/administracao`), preservando os caminhos da API.

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
