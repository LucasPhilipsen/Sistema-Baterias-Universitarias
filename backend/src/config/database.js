import pkg from 'pg';
import { env } from './env.js';

const { Pool } = pkg;

export const dbPool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
});

dbPool.on('connect', () => {
  console.log('Pool do PostgreSQL conectado com sucesso.');
});

dbPool.on('error', (err) => {
  console.error('Erro inesperado no Pool do PostgreSQL:', err);
});