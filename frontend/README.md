# Interface — acesso e sessão (SCRUM-24)

JavaScript, React 19, Vite 8 e CSS Modules. Requer Node.js 24 LTS e npm.

A [direção visual](../docs/design.md) usa a identidade do Flam: branco, azul-marinho e índigo, fonte Söhne variável e Source Code Pro servidas localmente, divisórias finas e cantos de 4 px.

A página inicial inclui uma faixa [LogoLoop](src/components/LogoLoop/README.md) com as sete baterias fornecidas, entre as ações principais e os módulos. Os logos têm 80 px, espaços de 128 px e rolagem contínua sem botões. A animação pausa somente sobre um logo, retoma ao sair, permite arraste e respeita movimento reduzido. As imagens finais com fundo transparente ficam em `public/logos/`, mantendo os pixels internos dos emblemas.

## Executar com a API

Prepare o backend e o PostgreSQL conforme o [README da raiz](../README.md) e o [contrato da SCRUM-23](../docs/autenticacao.md). Aplique usuários, sessões e, no ambiente de desenvolvimento, as contas fictícias. Inicie o backend em http://localhost:3000.

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
- As operações administrativas continuam protegidas pelos componentes intermediários de autorização da SCRUM-23 no servidor. A página administrativa é uma entrada para os módulos; operações de gestão, ensaios e estoque serão implementadas nas tarefas correspondentes.

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

A suíte inicia o Vite na porta 5174 e a API Express da SCRUM-23 em uma porta local livre. Usa rotas, validação scrypt, cookie e componentes intermediários reais com repositórios em memória: não acessa o banco da aplicação. O servidor `e2e/server.js` exige `NODE_ENV=test`; sua rota de teste da diretoria não integra a aplicação publicada. Falhas de rede, limite de tentativas e mudança de perfil são injetados apenas nos cenários correspondentes.

Se esse mesmo servidor de testes já estiver rodando para conferência manual, defina `PLAYWRIGHT_REUSE_SERVER=1` para reutilizá-lo. Por padrão, a suíte exige a porta livre e gerencia seu próprio servidor.

Os cenários rodam em computador e em dimensões de tela de celular: acesso válido ou inválido, restauração, navegação, URL administrativa, autorização HTTP, saída e revogação de sessão, cookie expirado, recuperação de falhas e sincronização entre abas. Capturas de tela e registros detalhados de falhas ficam em `test-results/`, fora do Git.

A integração com PostgreSQL é uma verificação separada, documentada no contrato da SCRUM-23, e exige banco descartável configurado. Para conferir manualmente com o banco real, use as duas contas de demonstração, recarregue os módulos, tente `/administracao` como integrante, saia e confira que uma nova abertura do módulo exige login.

Os padrões reutilizáveis e exemplos de composição estão em [Componentes da interface](../docs/frontend-components.md).

O contrato compartilhado com ensaios e estoque e os cenários de validação estão em [Integração da Sprint 2](../docs/integracao-sprint-2.md).
