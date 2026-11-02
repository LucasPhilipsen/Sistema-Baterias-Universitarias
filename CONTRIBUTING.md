# Como vamos trabalhar

## Organização do trabalho

Vamos acompanhar as histórias, as tarefas e o andamento das Sprints pelo Jira. No planejamento, escolhemos o que vamos desenvolver, dividimos o trabalho em subtarefas e definimos os responsáveis e os pontos.

Cada um fica responsável por atualizar suas tarefas conforme o trabalho avança. As histórias que ainda não entraram em uma Sprint continuam no backlog.

Dividimos o trabalho com Pedro no frontend e os demais integrantes no backend dos seus módulos, como está no [README](README.md#equipe). Antes de desenvolver uma tela ou uma rota, vamos combinar os dados que ela recebe e devolve. Cada um acompanha a integração da sua parte com Pedro e resolve os problemas do seu módulo.

Giovani acompanha a integração entre os módulos e organiza a Wiki. Todos vamos contribuir com a documentação das nossas partes ao longo das Sprints.

## Git e revisão

Vamos usar uma branch para cada tarefa ou entrega, partindo da `main` atualizada. O nome deve ajudar a identificar o trabalho, por exemplo `feature/SCRUM-26-modelo-ensaios`.

Quando uma alteração envolver autenticação, configuração ou scripts do banco usados por mais de um módulo, vamos combinar com os outros responsáveis antes de mexer nesses arquivos.

Antes de abrir um pull request, cada um confere o que alterou e testa o que conseguiu implementar. Na descrição, vamos informar o ticket, o que mudou e como foi testado. Depois da revisão, podemos juntar a alteração à `main`.

## Testes e arquivos do projeto

Vamos considerar uma história pronta quando a interface estiver integrada ao backend e ao banco, com os critérios de aceite conferidos. Também precisamos testar as permissões e verificar se os dados continuam corretos depois de uma nova consulta.

Conforme implementarmos a aplicação, vamos registrar os comandos de instalação, execução e testes para que todos consigam rodar o projeto.

Senhas e configurações locais ficam fora do repositório. Não vamos enviar arquivos `.env`, `node_modules`, builds ou dados pessoais reais. Nos testes e nas apresentações, vamos usar dados fictícios.
