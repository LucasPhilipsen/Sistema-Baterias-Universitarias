// Opt-in exclusivo de teste. Nunca usa banco existente nem o banco manual da aplicação.
import { readFile } from 'node:fs/promises';
import { dbPool } from '../../../backend/src/config/database.js';
import { env } from '../../../backend/src/config/env.js';
import { authService } from '../../../backend/src/config/autenticacao.js';
import { criarServicosEstoque } from '../../../backend/src/config/estoque.js';

export async function postgresEstoque() {
  if (process.env.NODE_ENV !== 'test' || !/^bateria_frontend_estoque_test_[a-z0-9_]+$/.test(env.db.database)) throw new Error('Use NODE_ENV=test e banco descartável bateria_frontend_estoque_test_*.');
  const { rows } = await dbPool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  if (rows.length) throw new Error('O banco de integração precisa estar vazio.');
  for (const file of ['001-criar-usuarios.sql', '002-criar-sessoes.sql', '003-criar-ensaios.sql', '004-criar-instrumentos.sql', 'seeds/001-usuarios-desenvolvimento.sql']) {
    await dbPool.query(await readFile(new URL(`../../../database/${file}`, import.meta.url), 'utf8'));
  }
  await dbPool.query('ALTER SEQUENCE tipos_instrumentos_id_seq RESTART WITH 73');
  const { rows: [caixa] } = await dbPool.query('INSERT INTO tipos_instrumentos(nome) VALUES ($1) RETURNING id', ['Caixa de teste']);
  await dbPool.query('INSERT INTO tipos_instrumentos(nome) VALUES ($1)', ['Tipo sem unidades']);
  for (const [identificacao, situacao] of [['E2E-DISPONIVEL', 'DISPONIVEL'], ['E2E-EMPRESTADO', 'EMPRESTADO'], ['E2E-MANUTENCAO', 'EM_MANUTENCAO']]) {
    await dbPool.query('INSERT INTO instrumentos(tipo_instrumento_id, identificacao, situacao) VALUES ($1, $2, $3)', [caixa.id, identificacao, situacao]);
  }
  return { authService, estoque: criarServicosEstoque(dbPool), close: () => dbPool.end() };
}
