import pg from 'pg';

export function createDatabasePool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('Configure DATABASE_URL no .env da raiz antes de acessar o banco.');
  }
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
}
