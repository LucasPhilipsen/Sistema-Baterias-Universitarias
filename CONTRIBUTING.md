# Como contribuir

## Organização do trabalho

O Jira é a fonte de acompanhamento das histórias, subtarefas, responsáveis e estados. Cada Sprint reúne as histórias selecionadas no planejamento; os demais itens permanecem no backlog até sua seleção.

Antes de iniciar uma história selecionada, criar subtarefas verificáveis de modelagem/contrato, backend, frontend e validação, conforme necessário. A equipe deve acordar estimativas, dependências e capacidade no planejamento da Sprint.

Pedro desenvolve o frontend dos módulos. Cada responsável pelo backend combina os contratos com ele, acompanha a integração e corrige sua área. Giovani coordena a integração e organiza a Wiki com as contribuições de todos. A divisão completa está no [README](README.md#equipe), e os responsáveis por cada subtarefa estão no Jira.

## Git e revisão

1. Atualizar a `main` antes de iniciar o trabalho.
2. Criar uma branch associada ao ticket, por exemplo `feature/SCRUM-12-ensaios`.
3. Trabalhar no módulo correspondente e combinar alterações compartilhadas de autenticação, banco e contratos da API com os demais responsáveis.
4. Fazer commits que descrevam o resultado da alteração.
5. Abrir pull request com o ticket, as mudanças e as verificações realizadas. Integrar após revisão.
6. Atualizar o Jira e contribuir com o relatório na Wiki usando evidências reais do trabalho.

Não versionar credenciais, arquivos `.env`, `node_modules`, builds ou dados pessoais reais. Usar dados fictícios nos testes e apresentações.

## Próximas Sprints

A configuração de dependências, execução e testes será registrada quando a implementação correspondente for selecionada. Uma funcionalidade será concluída quando seus critérios de aceite, integração, persistência e permissões necessárias estiverem verificados.
