# Contrato de integrantes — SCRUM-36

Contrato para a [gestão de integrantes (SCRUM-11)](https://pds20262-g14.atlassian.net/browse/SCRUM-11). O cadastro usa a tabela `usuarios` e o serviço de autenticação da Sprint 2. Uma conta com perfil `INTEGRANTE` é o cadastro do integrante. O identificador desse usuário também serve de referência para confirmações e empréstimos.

## Dados

| Campo | Cadastro | Edição | Resposta | Regra |
| --- | --- | --- | --- | --- |
| `id` | Gerado pelo banco | Pela URL | Sim | Inteiro positivo de até 2147483647 |
| `nome` | Obrigatório | Obrigatório | Sim | Texto de 1 a 120 caracteres após aparar as extremidades |
| `email` | Obrigatório | Obrigatório | Sim | Endereço válido de até 254 caracteres, aparado, convertido para minúsculas e único na tabela `usuarios` |
| `senha` | Obrigatória | — | — | Senha inicial informada pela diretoria, com pelo menos 12 caracteres Unicode e até 1024 bytes em UTF-8 |
| `perfil` | Definido pela API | — | Sim | `INTEGRANTE` |

Os limites de nome e e-mail seguem a validação de `Usuario`. Caractere nulo em nome ou e-mail gera erro de validação antes da gravação. O servidor usa `scrypt` com salt aleatório e o formato de hash aceito pelo login atual. A senha é usada exatamente como recebida, inclusive se contiver espaços. Após o cadastro, o integrante entra pelo fluxo de login existente com o e-mail cadastrado e a senha inicial.

A edição substitui `nome` e `email`, preservando ID, senha e perfil. O próximo login usa o novo e-mail. Cadastro público, redefinição de senha, promoção de perfil e exclusão ficam fora da entrega.

## Rotas

| Método e caminho | Corpo | Resposta de sucesso |
| --- | --- | --- |
| `GET /api/integrantes` | — | `200` com `{ "integrantes": [...] }`, ordenados por nome e ID. Lista vazia retorna `[]` dentro de `integrantes`. |
| `GET /api/integrantes/:id` | — | `200` com `{ "integrante": {...} }` |
| `POST /api/integrantes` | `nome`, `email`, `senha` | `201` com `{ "integrante": {...} }` e `Location: /api/integrantes/<id>` |
| `PUT /api/integrantes/:id` | `nome`, `email` | `200` com `{ "integrante": {...} }` |

Todas as rotas exigem sessão de diretoria. As gravações exigem JSON da mesma origem. A API aceita apenas os campos listados na tabela para cada operação. Campos extras no corpo e parâmetros de consulta produzem `400`. Consulta e edição só encontram contas `INTEGRANTE`. O próprio usuário autenticado pode consultar sua identidade em `GET /api/auth/me`.

Exemplo do objeto devolvido dentro de `integrante` ou de `integrantes`:

```json
{
  "id": 12,
  "nome": "Ana de Demonstração",
  "email": "ana@bateria.example",
  "perfil": "INTEGRANTE"
}
```

## Erros para a interface

O formato é `{ "error": { "code": "...", "message": "..." } }`, como no [contrato de autenticação](autenticacao.md).

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | Campos ausentes ou inválidos, ID fora do formato, corpo incompatível ou parâmetros extras |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, expirada ou revogada |
| `403` | `ACESSO_NEGADO` | Sessão de integrante em uma rota administrativa |
| `403` | `ORIGEM_INVALIDA` | Gravação a partir de origem incompatível |
| `404` | `INTEGRANTE_NAO_ENCONTRADO` | O ID é válido, mas não identifica uma conta `INTEGRANTE` |
| `409` | `EMAIL_DUPLICADO` | O e-mail normalizado pertence a outra conta, inclusive de diretoria |
| `415` | `JSON_OBRIGATORIO` | Cadastro ou edição sem `Content-Type: application/json` |

No conflito de e-mail, a interface pode destacar o campo usando `EMAIL_DUPLICADO`. A restrição única do PostgreSQL decide a duplicidade também em cadastros simultâneos. Em falhas de validação, o formulário preserva os campos e exibe a mensagem retornada. Depois de uma gravação confirmada, a interface consulta novamente a lista.

## Integração com cadastro e empréstimos

- **Pedro, na tela de integrantes:** usar `session.request('/integrantes')` para a listagem e os métodos da tabela para gravar. A senha aparece apenas no formulário de cadastro. A listagem e o formulário de empréstimos usam os IDs da API.
- **Pedro e Lucas, em empréstimos:** a diretoria consulta `GET /api/integrantes`. O seletor mostra o `nome` e usa `id` como valor. O backend de empréstimos valida no banco, na gravação, que o ID aponta para uma conta `INTEGRANTE`. Ambos usam a referência `usuarios.id`.

Na validação da entrega, conferir cadastro, edição, recarga, login da nova conta, conflito de e-mail, recusa para integrante e uso do mesmo ID no seletor de empréstimos.

## Executar e testar a API (SCRUM-40)

A API utiliza a estrutura já aplicada pelos scripts `001-criar-usuarios.sql` e `002-criar-sessoes.sql`. A partir de `backend/`, use `npm run dev` com a conexão configurada no `.env`. O preparo do banco e as contas de demonstração estão no [guia de autenticação](autenticacao.md#preparar-e-testar).

Rode `npm test` em `backend/` para executar a suíte padrão. Para conferir as rotas com PostgreSQL, crie um banco vazio e descartável com prefixo `bateria_integrantes_test_` e configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` no ambiente ou em `backend/.env.test`. O teste aplica as tabelas e os dados de demonstração nesse banco. Use outro banco vazio para repetir.

Em `backend/`, no PowerShell:

```powershell
$env:NODE_ENV = 'test'
$env:INTEGRANTES_PG_INTEGRATION = '1'
try {
  node --env-file-if-exists=.env.test --test tests/integrantes.postgres.test.js
} finally {
  Remove-Item Env:INTEGRANTES_PG_INTEGRATION
}
```

A integração cobre as quatro rotas, as recusas por sessão e perfil, o cadastro e a edição com login real, e-mails duplicados e duas requisições simultâneas para o mesmo e-mail.
