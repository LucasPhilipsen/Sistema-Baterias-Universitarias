# Banco de dados

Banco definido: **PostgreSQL 18**. O Compose cria somente o banco e o usuário de desenvolvimento em um volume próprio. A API inicial ainda não persiste dados de negócio.

## Modelagem por módulo

| Módulo | Entidades previstas | Responsável |
| --- | --- | --- |
| Usuários | Usuario e perfis de acesso | Pedro |
| Ensaios | Ensaio, ConfirmacaoEnsaio e Presenca | Giovani |
| Estoque | TipoInstrumento e Instrumento | Felipe |
| Movimentações | Emprestimo e Manutencao | Lucas |
| Dashboard | Consultas sobre confirmações e disponibilidade | Vitor, com os responsáveis pelos dados |

As tabelas, colunas e contratos finais precisam ser revisados em conjunto antes das migrações. Esta lista não é um schema executável.

## Convenções para a implementação

- Colocar migrações SQL versionadas em `database/migrations/`, com nomes ordenados como `20261102_120000_criar_ensaios.sql`, sem editar migrações já aplicadas.
- Documentar a ordem e o comando de aplicação quando o primeiro script existir. A base inicial não contém um executor de migrações nem aplica scripts automaticamente.
- Usar identificadores SQL em `snake_case`, chaves primárias e estrangeiras consistentes entre os módulos.
- Proteger unicidade de integrante/ensaio para confirmações e presença. Definir com a equipe se cancelamento atualiza a linha ou conserva histórico separado.
- Definir explicitamente o tratamento de fuso horário de ensaios no contrato e no banco antes da implementação.
- Controlar operações de disponibilidade com transações e bloqueios/atualizações condicionais adequados; validar somente na interface não evita conflitos.
- Dados de exemplo devem ser fictícios. Nunca apontar testes que apagam ou escrevem dados para o banco pessoal ou de demonstração.

`npm run db:check` realiza somente `SELECT 1` e não aplica migrações nem dados de exemplo.
