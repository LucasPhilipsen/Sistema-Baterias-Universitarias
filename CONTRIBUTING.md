# Como contribuir

## Ambiente comum

Usar Node.js 24.x e instalar as dependências na raiz com `npm ci`. Não criar lockfiles dentro de `frontend` ou `backend`: o repositório usa npm workspaces e um único `package-lock.json`.

Ao adicionar dependências de um módulo, executar na raiz, por exemplo: `npm install --workspace backend <pacote>` ou `npm install --workspace frontend <pacote>`. Versionar o manifesto alterado e o lockfile.

O override de `minimatch` usa a versão corrigida 11.0.1 ou superior para a dependência transitiva do ESLint (GHSA-g3hv-75wg-m249). Reavaliar esse override ao atualizar o ESLint; não executar `npm audit fix --force` para resolver esse alerta por downgrade do linter.

## Fluxo de trabalho

1. Selecionar a história no planejamento da Sprint e criar suas subtarefas no Jira: modelagem/contrato, backend, frontend e validação, conforme necessário. As etiquetas `previsao-sprint-*` são previsões, não compromissos de execução.
2. Atualizar a `main` e criar uma branch curta ligada ao ticket, por exemplo `feature/SCRUM-12-ensaios`.
3. Trabalhar no módulo correspondente. Combinar alterações em entidades compartilhadas, autenticação e banco com os demais responsáveis antes da integração.
4. Executar `npm run check` e os testes adicionais relevantes à história. Para mudanças na persistência, testar também com PostgreSQL e dados exclusivos de teste.
5. Abrir pull request com o ticket, o comportamento entregue e os resultados dos testes. Integrar após revisão e verificações aprovadas.
6. Atualizar Jira e Wiki com o resultado real. Uma história só é concluída quando seus critérios de aceite e a integração necessária estiverem atendidos.

Não versionar `.env`, credenciais, `node_modules`, builds ou dados pessoais reais. Usar dados fictícios para testes e apresentação.

## Limites da base inicial

A API de saúde confirma apenas que o servidor HTTP está respondendo. Ela não comprova autenticação, conexão com o banco ou implementação dos módulos. `npm run db:check` verifica a conexão separadamente. As pastas de módulos estão preparadas para desenvolvimento e não representam funcionalidades concluídas.
