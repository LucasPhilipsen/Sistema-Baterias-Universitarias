import { readFile } from 'node:fs/promises';
import { dbPool } from '../../../backend/src/config/database.js';
import { env } from '../../../backend/src/config/env.js';
import { authService } from '../../../backend/src/config/autenticacao.js';
import { integranteService } from '../../../backend/src/config/integrantes.js';

export async function postgresIntegrantes() {
  if (process.env.NODE_ENV !== 'test' || !/^bateria_frontend_integrantes_test_[a-z0-9_]+$/.test(env.db.database)) throw new Error('Use NODE_ENV=test e banco vazio bateria_frontend_integrantes_test_*.');
  const { rows } = await dbPool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  if (rows.length) throw new Error('O banco de integração precisa estar vazio.');
  for (const file of ['001-criar-usuarios.sql', '002-criar-sessoes.sql', '003-criar-ensaios.sql', 'seeds/001-usuarios-desenvolvimento.sql']) {
    await dbPool.query(await readFile(new URL(`../../../database/${file}`, import.meta.url), 'utf8'));
  }
  await dbPool.query('ALTER SEQUENCE usuarios_id_seq RESTART WITH 73');
  return { authService, integranteService, close: () => dbPool.end() };
}
