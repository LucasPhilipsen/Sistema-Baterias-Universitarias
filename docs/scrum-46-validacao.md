# SCRUM-46 — Formulários e histórico de empréstimos

Conferência de 23/11/2026, na branch `feature/SCRUM-46-emprestimos`, baseada na
`origin/main` em `ef8b711`. Contrato: [SCRUM-38](contrato-emprestimos.md).

## Implementação

O módulo `/emprestimos` reutiliza a estrutura, identidade visual, introdução,
botões, mensagens, carregamento e sessão existentes. O acesso fica nos cards da
página inicial e da diretoria. Ambos os perfis consultam o histórico; apenas a
diretoria recebe formulário e ações administrativas.

A retirada usa integrantes e unidades disponíveis consultados na API e envia
somente `integranteId` e `instrumentoId`. A devolução mostra unidade e responsável
antes de enviar `{}` à rota do empréstimo escolhido. Nenhum ID de negócio, data
ou situação é fixado na interface. O histórico mostra responsável, unidade,
retirada, devolução e situação, com datas em `America/Sao_Paulo`.

As consultas usam `session.request()` e `cache: no-store`. Depois de uma operação,
histórico e opções são consultados novamente, inclusive em resposta incerta ou
conflito. A unidade que deixa de estar disponível sai das opções; o integrante
continua selecionado quando ainda existe. Novos integrantes aparecem ao abrir o
formulário ou atualizar as consultas.

Os leitores recusam respostas inconsistentes e mantêm apenas campos públicos.
Não se anuncia sucesso sem uma confirmação válida que corresponda ao registro
enviado. O envio é bloqueado enquanto pendente; devoluções de registros já
devolvidos não são oferecidas. Consultas e operações são canceladas ao sair ou
trocar a identidade; um resultado anterior não ocupa o histórico de outra sessão.

## Critérios e evidência

| Critério | Resultado nesta entrega |
| --- | --- |
| Retirada com integrante e unidade existentes | Interface e payload conferidos pelo contrato; seletores também conferidos com APIs existentes e repositórios em memória. |
| Consultar histórico e confirmar devolução | Conferido no navegador com respostas de empréstimos simuladas. |
| Permissões por perfil | Ações e consultas administrativas ausentes para integrante; expiração e revogação de perfil conferidas com respostas simuladas. Restrição dos registros no servidor pendente da SCRUM-42. |
| Atualização depois de salvar e recarregar | Novas consultas e renderização conferidas com estado simulado mantido pelo teste; persistência PostgreSQL pendente. |
| Validação, conflito, falha e vazio | Conferidos por testes unitários e no navegador, com mensagens próprias, nova consulta e sem detalhes internos. |
| Identidade visual e acessibilidade | Conferência visual de desktop e 320 px; campos rotulados, erros associados, foco na validação e confirmação, operação por teclado e ausência de rolagem horizontal. |
| Integração com API real e banco | **Pendente da SCRUM-42. A tarefa não está concluída como fluxo integrado.** |

## Testes executados

Ambiente: Windows, Node.js `26.13.0`, npm `11.20.0`, Chrome instalado e
Playwright nos projetos desktop e Pixel 7. O projeto declara Node.js 24 LTS;
esta rodada não comprova execução no Node 24.

Em `frontend/`:

```powershell
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:E2E_PORT = '5178'
try {
  npm run test:e2e -- emprestimos
} finally {
  Remove-Item Env:PLAYWRIGHT_CHANNEL, Env:E2E_PORT
}
```

- 46 testes unitários passaram, incluindo cinco novos cenários de contrato,
  validação, datas e mensagens de empréstimos, e a autorização da nova rota.
- Compilação de produção passou.
- 22 testes de navegador passaram: 11 cenários em desktop e celular.
- A regressão de autenticação, navegação, integrantes e estoque teve 49 cenários
  aprovados e um ignorado por ser específico do menu móvel. O cenário de novo
  contexto de integrantes foi ajustado para usar a URL configurada, em vez de
  fixar a porta 5174, e passou nos dois projetos na repetição com porta 5178.
- A rodada final repetiu os 22 testes de empréstimos e esses dois cenários de
  integrantes: **24 aprovados**, incluindo identificação de 40 caracteres em
  320 px e datas equivalentes com ou sem milissegundos na devolução.
- Capturas locais ficam em `frontend/test-results/` e em
  `frontend/node_modules/.cache/scrum46-final-results/`, fora do Git.

Comandos adicionais de regressão e repetição, com as mesmas variáveis acima:

```powershell
npm run test:e2e -- auth navigation integrantes-api instrumentos-api --output=node_modules/.cache/scrum46-regression-results
npm run test:e2e -- emprestimos integrantes-api --grep 'emprestimos.spec|cadastro, consulta atualizada' --output=node_modules/.cache/scrum46-final-results
```

A autenticação usa scrypt, cookies e rotas reais com repositórios em memória.
Os testes de empréstimos interceptam HTTP explicitamente. O cenário de seletores
cadastra integrante, tipo e unidade pelas APIs existentes sem interceptar essas
rotas, mas também usa persistência em memória. Não foi executada integração de
empréstimos com PostgreSQL.

## Conferência pendente com o backend

Na base desta entrega, `backend/src/app.js` não registra as rotas de empréstimos.
O script `006-criar-emprestimos.sql` e o contrato estão disponíveis, mas não são
suficientes para validar o fluxo real.

Quando a SCRUM-42 estiver disponível, executar com banco descartável e sem
interceptar empréstimos:

1. Aplicar a estrutura compatível, cadastrar um integrante e uma unidade e
   registrar a retirada pela interface. Conferir no banco o vínculo, instante e
   situação `EMPRESTADO`; recarregar histórico e estoque.
2. Entrar como esse integrante e como outro; verificar que cada GET retorna
   somente registros do usuário da sessão e que POST/PUT administrativos são recusados.
3. Registrar a devolução; conferir instante, situação `DEVOLVIDO`, unidade
   `DISPONIVEL` e disponibilidade atualizada também no painel de demanda.
4. Com SCRUM-50, disputar a mesma unidade em duas retiradas e tentar retirar
   unidade em manutenção; conferir `409`, ausência de empréstimos ativos
   duplicados e atualização das opções da interface.
5. Repetir a devolução, inclusive depois de um novo empréstimo da mesma unidade;
   conferir idempotência, instante original e preservação do novo empréstimo.
6. Executar no Node.js 24 LTS e registrar os resultados reais antes de concluir
   a tarefa no Jira.
