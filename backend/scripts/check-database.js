import { createDatabasePool } from '../src/config/database.js';

let pool;
try {
  pool = createDatabasePool();
  await pool.query('SELECT 1 AS conectado');
  console.log('Conexão com PostgreSQL verificada. Nenhuma tabela foi criada ou alterada.');
} catch (error) {
  console.error(`Falha na conexão com PostgreSQL (${error.code ?? 'configuração ausente ou inválida'}). Confira DATABASE_URL e o serviço do banco.`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
