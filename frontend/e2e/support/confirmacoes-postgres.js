// Opt-in de integração: usa a aplicação publicada da SCRUM-41 e seus repositórios reais.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function postgresConfirmacoes(root) {
  if (process.env.NODE_ENV !== 'test' || !root || !/^bateria_frontend_confirmacoes_test_[a-z0-9_]+$/.test(process.env.DB_NAME ?? '')) {
    throw new Error('Use NODE_ENV=test, checkout da SCRUM-41 e banco vazio bateria_frontend_confirmacoes_test_*.');
  }
  const load = file => import(pathToFileURL(resolve(root, 'backend/src', file)).href);
  const [{ createApp }, { dbPool }, { authService }] = await Promise.all([load('app.js'), load('config/database.js'), load('config/autenticacao.js')]);
  try {
    if ((await dbPool.query("SELECT 1 FROM pg_tables WHERE schemaname = 'public'")).rowCount) throw new Error('Use outro banco vazio para repetir os testes.');
    for (const file of ['001-criar-usuarios.sql', '002-criar-sessoes.sql', '003-criar-ensaios.sql', '004-criar-instrumentos.sql', '005-criar-confirmacoes.sql', 'seeds/001-usuarios-desenvolvimento.sql']) {
      await dbPool.query(await readFile(new URL(`../../../database/${file}`, import.meta.url), 'utf8'));
    }
    await dbPool.query('ALTER SEQUENCE tipos_instrumentos_id_seq RESTART WITH 73');
    for (const nome of ['Caixa de participação', 'Repinique de participação']) {
      await dbPool.query('INSERT INTO tipos_instrumentos(nome) VALUES ($1)', [nome]);
    }
    const { rows: [tipo] } = await dbPool.query('SELECT id FROM tipos_instrumentos ORDER BY id LIMIT 1');
    for (const [index, situacao] of ['DISPONIVEL', 'EMPRESTADO', 'EM_MANUTENCAO'].entries()) {
      await dbPool.query('INSERT INTO instrumentos(tipo_instrumento_id, identificacao, situacao) VALUES ($1, $2, $3)', [tipo.id, `PART-PG-${index}`, situacao]);
    }
    return { app: createApp({ limiteTentativas: 1000 }), authService, close: () => dbPool.end() };
  } catch (error) { await dbPool.end(); throw error; }
}
