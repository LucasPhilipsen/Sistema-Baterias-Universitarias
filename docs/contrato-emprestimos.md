# Contrato de empréstimos — SCRUM-38

Contrato da história [Controlar empréstimos e devoluções (SCRUM-16)](https://pds20262-g14.atlassian.net/browse/SCRUM-16). Lucas usa este contrato na [API (SCRUM-42)](https://pds20262-g14.atlassian.net/browse/SCRUM-42), Pedro nos [formulários e no histórico (SCRUM-46)](https://pds20262-g14.atlassian.net/browse/SCRUM-46) e Felipe na [validação de concorrência e estoque (SCRUM-50)](https://pds20262-g14.atlassian.net/browse/SCRUM-50).

## Modelagem

A tabela `emprestimos` é criada por [`006-criar-emprestimos.sql`](../database/006-criar-emprestimos.sql). O script pode ser aplicado uma vez em um banco que já tenha as tabelas criadas pelos scripts `001-criar-usuarios.sql` e `004-criar-instrumentos.sql`.

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `integer` | Chave primária gerada pelo banco |
| `usuario_id` | `integer` | Obrigatório, referencia `usuarios.id`. Na retirada, a API exige uma conta `INTEGRANTE`. |
| `instrumento_id` | `integer` | Obrigatório, referencia `instrumentos.id` |
| `retirada_em` | `timestamptz` | Obrigatório, registrado pelo servidor na retirada |
| `devolucao_em` | `timestamptz` | Nulo enquanto ativo. Na devolução, deve ser igual ou posterior à retirada. |

O índice único parcial em `instrumento_id` vale para empréstimos com `devolucao_em IS NULL`. Assim, a mesma unidade pode aparecer várias vezes no histórico, com no máximo um empréstimo ativo. O histórico guarda os IDs e exibe o nome e a identificação atuais dos registros vinculados.

## Rotas

| Método e caminho | Quem pode usar | Corpo | Resposta |
| --- | --- | --- | --- |
| `GET /api/emprestimos` | Diretoria vê todos. Integrante vê os próprios, usando o ID da sessão. | — | `200` com `{ "emprestimos": [...] }`, em ordem decrescente de `retiradaEm` e `id`. Lista vazia retorna `[]` em `emprestimos`. |
| `POST /api/emprestimos` | Diretoria | `{ "integranteId": 12, "instrumentoId": 4 }` | `201` com `{ "emprestimo": {...} }` |
| `PUT /api/emprestimos/:id/devolucao` | Diretoria | `{}` | `200` com `{ "emprestimo": {...} }`. Repetir devolve o mesmo registro, com a data original. |

Os IDs no JSON são números inteiros de 1 a 2147483647. O `:id` na URL usa os mesmos limites e aceita apenas dígitos. As rotas recusam parâmetros de consulta e as gravações aceitam somente o corpo indicado, em JSON da mesma origem. Datas e situação são definidas pelo servidor.

Exemplo do objeto em `emprestimo` ou em `emprestimos`:

```json
{
  "id": 7,
  "integrante": { "id": 12, "nome": "Ana de Demonstração" },
  "instrumento": { "id": 4, "identificacao": "CX-004" },
  "retiradaEm": "2026-11-20T21:30:00.000Z",
  "devolucaoEm": null,
  "situacao": "ATIVO"
}
```

Depois da devolução, `devolucaoEm` recebe um instante e `situacao` passa a `DEVOLVIDO`. As datas da API usam UTC em ISO 8601 com `Z`. A interface usa `America/Sao_Paulo` na exibição, como a agenda de ensaios.

### Erros

Usar o formato `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| `400` | `DADOS_INVALIDOS` | ID, corpo ou parâmetro fora do contrato |
| `401` | `SESSAO_INVALIDA` | Sessão ausente, expirada ou revogada |
| `403` | `ACESSO_NEGADO` | Integrante tentando registrar retirada ou devolução |
| `403` | `ORIGEM_INVALIDA` | Gravação de origem incompatível |
| `404` | `INTEGRANTE_NAO_ENCONTRADO` | ID de retirada sem conta `INTEGRANTE` correspondente |
| `404` | `INSTRUMENTO_NAO_ENCONTRADO` | ID de unidade inexistente na retirada |
| `404` | `EMPRESTIMO_NAO_ENCONTRADO` | ID de empréstimo inexistente na devolução |
| `409` | `INSTRUMENTO_INDISPONIVEL` | Unidade emprestada, em manutenção ou já associada a um empréstimo ativo |
| `415` | `JSON_OBRIGATORIO` | Gravação sem `Content-Type: application/json` |

## Integração com estoque

- **Retirada.** Em uma transação, bloquear a linha da unidade com `SELECT ... FOR UPDATE`, conferir `DISPONIVEL`, validar o integrante, inserir o empréstimo e mudar a situação da unidade para `EMPRESTADO`. O índice único também protege a regra de um empréstimo ativo. Se houver conflito, reverter a transação e devolver `409`.
- **Devolução.** Identificar a unidade do empréstimo, bloquear a mesma linha de `instrumentos` e reler o empréstimo dentro da transação. Se já estiver devolvido, devolver o registro gravado sem atualizar a unidade. Senão, registrar a devolução e mudar a situação para `DISPONIVEL`, confirmando as duas mudanças juntas.
- **Estoque e demanda.** O bloqueio usa a mesma linha que a edição de tipo no estoque. A disponibilidade continua vindo de `instrumentos.situacao`. Depois da transação, as consultas de estoque e de demanda enxergam a situação atualizada.

## Integração com a interface

- O formulário de retirada usa `session.request('/integrantes')` para exibir o nome e enviar o `id` de cada integrante. Para a unidade, usa `session.request('/instrumentos?situacao=DISPONIVEL')` e exibe a `identificacao`.
- A diretoria pode abrir o formulário e devolver empréstimos ativos. O integrante acessa o mesmo histórico com os próprios registros. A API restringe o histórico pelo usuário da sessão.
- Após retirada ou devolução, atualizar histórico e unidades disponíveis. Se a lista do formulário estiver desatualizada, exibir a mensagem do `409` e consultar as unidades novamente.

## Conferência da integração

Na SCRUM-42 e na SCRUM-50, conferir retirada simultânea da mesma unidade, devolução repetida mesmo após um novo empréstimo da unidade, retirada recusada em manutenção, histórico por perfil e disponibilidade após cada operação. Na [SCRUM-48](https://pds20262-g14.atlassian.net/browse/SCRUM-48), conferir que o seletor do formulário usa os integrantes recém-cadastrados retornados pela API.
