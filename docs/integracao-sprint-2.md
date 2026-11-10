# Integração de acesso, ensaios e estoque — SCRUM-34

Este documento reúne o contrato de acesso já implementado e o roteiro para integrar ensaios e estoque na Sprint 2. A preparação pode avançar enquanto os módulos são desenvolvidos. A validação final depende das APIs e das telas conectadas ao banco.

## Referências e responsabilidades

| Parte | Responsável | Tarefas relacionadas |
| --- | --- | --- |
| Sessão, perfis e integração entre módulos | Giovani | SCRUM-23 e SCRUM-34 |
| Interface de acesso, ensaios e estoque | Pedro | SCRUM-24, SCRUM-28 e SCRUM-32 |
| Dados, regras e API de ensaios | Vitor | SCRUM-26 e SCRUM-27 |
| Dados, regras e API de instrumentos e estoque | Felipe | SCRUM-30 e SCRUM-31 |
| Testes de autenticação, sessão e permissões | Lucas | SCRUM-25 |

O [contrato de autenticação](autenticacao.md) define rotas, cookie, perfis e erros da API. Os [contratos de ensaios e estoque](contratos-sprint-2.md) definem os dados e as operações dos módulos. O [guia do frontend](../frontend/README.md) descreve o contexto de sessão e a proteção da navegação. A SCRUM-34 confere a ligação entre essas partes; os testes específicos continuam nas tarefas dos responsáveis.

## Contrato de acesso disponível

### Requisições do frontend

Os componentes autenticados obtêm `session` por `useAuth()`, em `frontend/src/auth/AuthContext.jsx`, e fazem as chamadas dos módulos com `session.request()`, definido em `frontend/src/auth/session.js`.

```jsx
const { session } = useAuth();
const dados = await session.request(caminho, { signal });
await session.request(caminho, { method: 'POST', body: dadosDoFormulario });
```

`caminho`, o formato dos dados e o método de cada operação seguem os [contratos de ensaios e estoque](contratos-sprint-2.md). Esses exemplos mostram o cliente compartilhado. As rotas de instrumentos e estoque já estão disponíveis no backend (SCRUM-31); as de ensaios ainda precisam ser implementadas.

- O cliente envia JSON e o navegador envia o cookie na mesma origem. A interface não precisa ler nem armazenar o token.
- Um `401` de uma chamada autenticada encerra o estado de sessão na interface e exige novo login.
- Um `403` provoca uma nova consulta do perfil e permanece disponível para o módulo informar a falta de permissão.
- Ao tratar falhas, exibir uma mensagem adequada à operação, sem mostrar o corpo bruto de erros internos. Cancelamentos de requisições após sair da tela não devem aparecer como falhas de acesso.
- A entrada em uma rota protegida aguarda a conferência da sessão. Revalidações automáticas preservam a tela enquanto aguardam a resposta; sessão inválida ou falha na consulta bloqueiam o acesso.

### Proteção das operações no backend

Os módulos reutilizam `authService`, de `backend/src/config/autenticacao.js`, e os middlewares de `backend/src/middlewares/autenticacao.js`.

| Operação da Sprint 2 | Proteção necessária |
| --- | --- |
| Consultar ensaios, instrumentos e estoque | `exigirAutenticacao(authService)` |
| Criar, editar ou cancelar ensaios | Autenticação seguida de `exigirDiretoria` |
| Cadastrar ou atualizar tipos e unidades de instrumentos | Autenticação seguida de `exigirDiretoria` |
| Alterar dados com corpo JSON | Aplicar também `exigirJsonMesmaOrigem` |

As proteções devem executar antes do controller. As rotas dos módulos devem ser montadas antes do tratamento global de erros em `backend/src/app.js`. Respostas assíncronas de erro seguem para o middleware compartilhado, mantendo o formato `{ "error": { "code": "...", "message": "..." } }`.

A identidade vem de `req.usuario`. Campos de usuário ou perfil enviados pelo navegador não concedem autorização. O backend precisa recusar uma operação administrativa por integrante mesmo que a chamada seja feita diretamente à API.

### Ambiente e banco

No desenvolvimento, acessar o frontend pelo Vite e enviar as chamadas para `/api`. O proxy mantém o Host para a validação de origem da API. A conexão atual não depende de CORS entre origens diferentes.

O preparo do ambiente está no [README](../README.md), no [guia do banco](../database/README.md) e no [contrato de autenticação](autenticacao.md#preparar-e-testar). Para um banco novo, a ordem atual é:

1. `database/001-criar-usuarios.sql`;
2. `database/002-criar-sessoes.sql`;
3. `database/003-criar-ensaios.sql`;
4. `database/004-criar-instrumentos.sql`;
5. dados fictícios de `database/seeds/001-usuarios-desenvolvimento.sql`, somente em desenvolvimento.

Os scripts `003` e `004` acompanham a definição dos contratos. As operações de instrumentos e estoque que usam o `004` estão implementadas no backend; as de ensaios, sobre o `003`, ainda não. Em um banco que já tem usuários e sessões, aplicar somente os novos scripts. Scripts de estrutura já aplicados não devem ser editados para atualizar um banco existente; alterações posteriores usam novos scripts.

## Definições para implementação em paralelo

O contrato de acesso acima já existe no código. Os dados, as rotas, os corpos JSON e os erros dos módulos foram preparados em [contratos da Sprint 2](contratos-sprint-2.md), com os scripts de modelagem correspondentes, para permitir que frontend e backend avancem a partir da mesma definição.

| Quem implementa | Definição disponível | Resultado esperado |
| --- | --- | --- |
| Vitor e Pedro | `inicioEm` com fuso, local, descrição e situação; cadastro, edição, consulta e cancelamento; script `003` | Backend e agenda com os mesmos campos e respostas |
| Felipe e Pedro | Tipos e unidades separados, identificação única, situações e contagem disponível; script `004` | Backend e telas de estoque com os mesmos campos e respostas |
| Giovani com os responsáveis | Cliente autenticado, autorização, apresentação de `401` e `403`, roteiro integrado | Validação entre os módulos implementados |

A definição foi preparada para revisão e repasse ao grupo. Ajustes necessários durante a implementação devem atualizar o contrato e considerar quem consome a operação. A validação final continua dependente das APIs e telas prontas.

## Roteiro de validação integrada

Usar contas e dados fictícios de diretoria e integrante. Nas verificações de persistência, consultar novamente após recarregar a página. Nas verificações de permissão, conferir também a resposta da API; a ausência de um botão não comprova autorização no servidor.

| ID | Cenário | Resultado esperado | Quando executar |
| --- | --- | --- | --- |
| I01 | Abrir `/ensaios` e `/instrumentos` sem sessão | Encaminhar ao login sem mostrar conteúdo protegido | Base de acesso disponível |
| I02 | Entrar com credenciais inválidas | Mostrar erro e não criar sessão | Base de acesso disponível |
| I03 | Entrar com cada perfil e recarregar | Restaurar a identidade da sessão persistida e manter a navegação correspondente | Base de acesso disponível |
| I04 | Integrante abrir `/administracao` | Mostrar acesso restrito | Base de acesso disponível |
| I05 | Sair e tentar reabrir uma área protegida | Revogar a sessão no banco e exigir login | Base de acesso disponível |
| I06 | Expirar ou revogar a sessão no banco de testes | API retorna `401` e a interface exige novo login | Base de acesso disponível |
| I07 | Alterar o perfil no banco de testes e revalidar | Interface passa a respeitar o perfil atual | Base de acesso disponível |
| I08 | Diretoria criar, editar e cancelar ensaio pela interface | API persiste as operações e nova consulta mostra o resultado, incluindo cancelamento | SCRUM-27 e SCRUM-28 disponíveis |
| I09 | Integrante consultar ensaios e tentar alteração diretamente pela API | Consulta permitida; alteração recusada com `403`, sem mudar o banco | SCRUM-27 e SCRUM-28 disponíveis |
| I10 | Diretoria cadastrar e atualizar tipos e unidades pela interface | Nova consulta mostra os dados persistidos e as situações corretas | SCRUM-31 e SCRUM-32 disponíveis |
| I11 | Integrante consultar estoque e tentar alteração diretamente pela API | Consulta permitida; alteração recusada com `403`, sem mudar o banco | SCRUM-31 e SCRUM-32 disponíveis |
| I12 | Sessão expirar durante uma operação em ensaios ou estoque | A chamada é recusada e a interface exige login, sem anunciar sucesso | APIs e telas dos módulos disponíveis |
| I13 | API de um módulo recusar acesso com `403` | Interface informa falta de permissão e considera o perfil reconsultado | APIs e telas dos módulos disponíveis |
| I14 | Enviar formulário inválido e repetir após corrigir os campos | Exibir validação sem anunciar sucesso; persistir somente a operação válida | APIs e telas dos módulos disponíveis |

Os casos de identificação única, vínculo entre tipo e unidade e contagem de unidades disponíveis são aprofundados na SCRUM-33. Empréstimos e manutenções podem aparecer como situações em dados fictícios; seus fluxos completos pertencem às histórias correspondentes.

## Registro da conferência

### Base de acesso — 07/11/2026

Referência: `main` em `e46868e`. Conferência pelo navegador com React/Vite, a API Express da aplicação e PostgreSQL 18 em uma instância local descartável. Foram aplicados os dois scripts de estrutura e os dados fictícios de acesso. As chamadas passaram pelo proxy `/api`, sem substituir os repositórios por implementações em memória.

Foram aprovados 11 cenários de conferência, cobrindo:

| Verificação | Resultado observado |
| --- | --- |
| Conexão pelo proxy | `/api/health` respondeu `200` com o banco conectado |
| I01 e I02 | Áreas sem sessão encaminharam ao login; senha inválida exibiu erro e não criou sessão no banco |
| I03 | Os dois perfis entraram e tiveram a sessão restaurada após recarregar; cookie HttpOnly e hash de sessão persistido foram conferidos |
| Navegação dos módulos | Ambos os perfis abriram as páginas de ensaios e instrumentos; as páginas ainda informaram que os módulos estão em desenvolvimento |
| I04 | Integrante recebeu acesso restrito ao abrir a URL da diretoria e não teve o link administrativo na navegação |
| I05 | Saída pela interface removeu a sessão do PostgreSQL; consulta de sessão retornou `401` e nova abertura da área exigiu login |
| I06 | Expiração e revogação, provocadas somente no banco descartável, fizeram a interface exigir novo login |
| I07 | Mudança do perfil de diretoria para integrante no banco foi refletida ao revalidar; a área administrativa passou a ser recusada |

O perfil alterado durante a conferência foi restaurado no banco de testes. Identidade e token não foram encontrados no armazenamento local do navegador; a resposta de sessão expôs somente `id`, `nome`, `email` e `perfil`.

Os casos I08 a I14 permanecem pendentes das APIs e telas dos módulos. A restrição da página administrativa conferida em I04 não comprova a proteção de operações de ensaios ou estoque, que ainda precisam ser verificadas diretamente na API.

### Continuação da validação

Ao executar o roteiro, registrar versão, data, ambiente, perfil, passos, resultado esperado e observado. Para uma falha, incluir o método e caminho chamados, o status HTTP e a evidência necessária para reproduzir, sem cookies, senhas reais ou dados pessoais.

- Giovani acompanha falhas de sessão, autorização compartilhada e integração entre módulos.
- Pedro acompanha apresentação e chamadas da interface.
- Vitor acompanha regras, persistência e rotas de ensaios.
- Felipe acompanha regras, persistência e rotas de estoque.

A SCRUM-34 só estará concluída após o repasse dos contratos, a conferência das duas áreas integradas e o tratamento das falhas encontradas.
