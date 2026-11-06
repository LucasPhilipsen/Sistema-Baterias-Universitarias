# Autenticação — SCRUM-23

Contrato para a tela de acesso da SCRUM-24 e para proteger os módulos do backend. Os perfis continuam sendo `DIRETORIA` e `INTEGRANTE`.

## Sessão

O login cria uma sessão de oito horas no PostgreSQL. O navegador recebe o cookie `bateria_sessao`, com `HttpOnly`, `SameSite=Lax` e caminho `/api`; em `NODE_ENV=production`, ele também tem `Secure` e exige HTTPS. O token é aleatório e somente seu hash SHA-256 é persistido. As respostas JSON não expõem token nem hash de senha.

A expiração é absoluta: consultar a sessão não renova o prazo. Fazer login novamente troca a sessão apresentada no cookie. Sair remove essa sessão do banco. Outras sessões do mesmo usuário continuam válidas até sua própria saída ou expiração.

## Rotas

| Método e caminho | Requisição | Sucesso |
| --- | --- | --- |
| `POST /api/auth/login` | JSON com `email` e `senha` | `200`, usuário e cookie de sessão |
| `GET /api/auth/me` | Cookie enviado pelo navegador | `200`, usuário da sessão |
| `POST /api/auth/logout` | JSON `{}` e cookie, quando houver | `204`, sem corpo, com remoção do cookie |

Login e logout exigem `Content-Type: application/json`. Requisições de outra origem são recusadas; no desenvolvimento, use o proxy `/api` do Vite. O backend não habilita CORS nesta entrega. O JSON obrigatório e a verificação de origem protegem as operações contra requisições de formulários externos.

### Login

```json
{ "email": "integrante@bateria.example", "senha": "IntegranteDemo!2026" }
```

O e-mail é normalizado para minúsculas e sem espaços nas extremidades. A senha é conferida exatamente como foi enviada, sem remover espaços, e aceita até 1024 bytes UTF-8. Campos como `id` e `perfil` enviados pelo cliente não definem a identidade ou as permissões.

Login e consulta de sessão retornam o mesmo formato:

```json
{
  "usuario": {
    "id": 2,
    "nome": "Integrante de Demonstração",
    "email": "integrante@bateria.example",
    "perfil": "INTEGRANTE"
  }
}
```

O `id` é gerado pelo banco e não deve ser fixado no frontend. `GET /api/auth/me` sempre retorna o próprio usuário autenticado. O perfil é consultado no banco, de modo que uma alteração administrativa seja considerada nas próximas requisições.

### Erros

```json
{ "error": { "code": "CREDENCIAIS_INVALIDAS", "message": "E-mail ou senha inválidos." } }
```

| HTTP | Código | Situação |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | Corpo ou campos de login inválidos |
| `400` | `JSON_INVALIDO` | JSON malformado |
| `400` | `IDENTIFICACAO_INVALIDA` | Identificação inválida ao usar o middleware de acesso por usuário |
| `401` | `CREDENCIAIS_INVALIDAS` | E-mail inexistente ou senha incorreta, com a mesma mensagem |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, inválida, expirada ou removida |
| `403` | `ACESSO_NEGADO` | Perfil sem permissão ou tentativa de acessar outro usuário |
| `403` | `ORIGEM_INVALIDA` | Origem da requisição incompatível com a API/proxy |
| `415` | `JSON_OBRIGATORIO` | Login ou logout enviado sem o tipo JSON |
| `413` | `CORPO_MUITO_GRANDE` | Corpo acima do limite de 100 KB do parser JSON |
| `429` | `MUITAS_TENTATIVAS` | Limite de 20 tentativas de login malsucedidas em 15 minutos por IP |
| `500` | `ERRO_INTERNO` | Falha interna, sem detalhes de banco ou credenciais na resposta |

O limite de tentativas fica na memória do processo e reinicia com o servidor. Em uma implantação com várias instâncias, será necessário um armazenamento compartilhado. O logout é idempotente: sem uma sessão válida, ainda limpa o cookie e retorna `204`.

## Integração com o frontend

O cliente existente em `frontend/src/services/http.js` funciona com o proxy local. Na mesma origem, o navegador envia os cookies automaticamente. Não salve token nem senha no `localStorage`.

```js
const { usuario } = await request('/auth/login', {
  method: 'POST', body: { email, senha },
});
const sessao = await request('/auth/me');
await request('/auth/logout', { method: 'POST', body: {} });
```

Ao abrir a aplicação, consulte `/auth/me` para restaurar o usuário na interface. Em `401`, mostre a tela de acesso; em `403`, informe falta de permissão. O cliente HTTP expõe o corpo do erro em `erro.data.error`. A proteção das operações permanece no backend, independentemente da navegação exibida.

## Proteger os módulos do backend

Os middlewares estão em `backend/src/middlewares/autenticacao.js`. Devem ser registrados antes dos controllers e do tratamento global de erros:

| Middleware | Uso |
| --- | --- |
| `exigirAutenticacao(authService)` | Recupera o usuário a partir da sessão e o disponibiliza em `req.usuario`; sem sessão válida, retorna `401` |
| `exigirDiretoria` | Exige autenticação anterior e perfil de diretoria; integrante recebe `403` |
| `exigirProprioUsuarioOuDiretoria('usuarioId')` | Confere se o parâmetro identifica o próprio usuário ou se o perfil é de diretoria |
| `exigirJsonMesmaOrigem` | Confere JSON e origem nas operações que alteram dados |

O serviço compartilhado está em `backend/src/config/autenticacao.js`. Use `req.usuario.id` ao criar registros do próprio integrante. Quando uma rota recebe o identificador de um recurso, como confirmação ou empréstimo, o serviço do módulo também precisa conferir a quem o recurso pertence; o middleware por usuário verifica apenas um parâmetro que identifica um usuário.

## Preparar e testar

Após o script de usuários da SCRUM-22, execute o novo script no banco da aplicação. Na raiz do repositório:

```sh
psql -X -h localhost -p 5432 -U postgres -d bateria_db -v ON_ERROR_STOP=1 -f database/002-criar-sessoes.sql
```

Para um banco novo, a ordem é `001-criar-usuarios.sql`, `002-criar-sessoes.sql` e, somente em desenvolvimento, `seeds/001-usuarios-desenvolvimento.sql`. Cada script de estrutura é aplicado uma vez. Os dados de conexão continuam no `.env` da SCRUM-20.

Na pasta `backend/`, execute `npm ci` e `npm test`. Os testes HTTP usam um servidor local, repositórios em memória e a verificação real de scrypt para conferir o contrato sem depender do PostgreSQL. O teste PostgreSQL é ignorado nessa execução padrão.

Para a integração real, crie um banco vazio com prefixo `bateria_auth_test_`, por exemplo `bateria_auth_test_local`. Configure `backend/.env.test` a partir do exemplo existente, com `NODE_ENV=test` e os dados de conexão desse banco. O teste aplica os scripts e altera apenas esse banco descartável; não deve apontar para o banco da aplicação.

Execute na raiz do repositório, em PowerShell:

```powershell
$env:AUTH_PG_INTEGRATION = '1'
try {
  node --env-file=backend/.env.test --test backend/tests/auth.postgres.test.js
} finally {
  Remove-Item Env:AUTH_PG_INTEGRATION
}
```

A verificação recusa nomes de banco sem o prefixo e falha se as tabelas já existirem. Para repetir, prepare outro banco vazio. Ela cobre login e sessão via HTTP, armazenamento do hash, recuperação da sessão em outra instância do serviço, mudança de perfil, troca de sessão, expiração, limpeza de sessões expiradas e logout.

## Referências

- [OWASP — gerenciamento de sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [Node.js 24 — criptografia](https://nodejs.org/docs/latest-v24.x/api/crypto.html).
- [express-rate-limit — configuração](https://express-rate-limit.mintlify.app/reference/configuration).
