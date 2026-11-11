// Opt-in de integração: recusa bancos existentes ou fora do prefixo descartável.
import { readFile } from 'node:fs/promises';
import { dbPool } from '../../../backend/src/config/database.js';
import { env } from '../../../backend/src/config/env.js';
import { authService } from '../../../backend/src/config/autenticacao.js';
import { ensaioService } from '../../../backend/src/config/ensaios.js';

export async function postgresServices() {
  if (process.env.NODE_ENV !== 'test' || !/^bateria_frontend_test_[a-z0-9_]+$/.test(env.db.database)) {
    throw new Error('A integração exige NODE_ENV=test e banco descartável bateria_frontend_test_*.');
  }
  const { rows } = await dbPool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  if (rows.length) throw new Error('Use um banco vazio para a integração do frontend.');
  for (const file of ['001-criar-usuarios.sql', '002-criar-sessoes.sql', '003-criar-ensaios.sql', 'seeds/001-usuarios-desenvolvimento.sql']) {
    await dbPool.query(await readFile(new URL(`../../../database/${file}`, import.meta.url), 'utf8'));
  }
  return { authService, ensaioService, close: () => dbPool.end() };
}
