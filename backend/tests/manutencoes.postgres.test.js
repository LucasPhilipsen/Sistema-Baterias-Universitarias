import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { dbPool } from '../src/config/database.js';
import { env } from '../src/config/env.js';

test('API de manutenção com PostgreSQL descartável', { skip: process.env.MANUTENCOES_PG_INTEGRATION !== '1' }, async t => {
  assert.equal(env.nodeEnv, 'test');
  assert.match(env.db.database, /^bateria_manutencoes_test_[a-z0-9_]+$/);
  let server;
  t.after(async () => {
    if (server?.listening) {
      const fechado = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await fechado;
    }
    await dbPool.end();
  });

  const tabelas = await dbPool.query("SELECT 1 FROM pg_tables WHERE schemaname = 'public'");
  assert.equal(tabelas.rowCount, 0, 'Use um banco de teste vazio.');
  for (const arquivo of [
    '001-criar-usuarios.sql', '002-criar-sessoes.sql', '004-criar-instrumentos.sql',
    '006-criar-emprestimos.sql', '008-criar-manutencoes.sql', 'seeds/001-usuarios-desenvolvimento.sql',
  ]) {
    await dbPool.query(await readFile(new URL(`../../database/${arquivo}`, import.meta.url), 'utf8'));
  }

  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function chamar(path, { method = 'GET', cookie, body, headers } = {}) {
    const resposta = await fetch(base + path, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: resposta.status, headers: resposta.headers, dados: await resposta.json() };
  }
  const entrar = (email, senha) => chamar('/auth/login', { method: 'POST', body: { email, senha } });
  const cookieDe = resposta => resposta.headers?.get('set-cookie')?.split(';')[0];
  const loginDiretoria = await entrar('diretoria@bateria.example', 'DiretoriaDemo!2026');
  const loginIntegrante = await entrar('integrante@bateria.example', 'IntegranteDemo!2026');
  assert.equal(loginDiretoria.status, 200);
  assert.equal(loginIntegrante.status, 200);
  const diretoria = cookieDe(loginDiretoria);
  const integrante = cookieDe(loginIntegrante);
  const tipo = await dbPool.query("INSERT INTO tipos_instrumentos (nome) VALUES ('Caixa') RETURNING id");
  const caixaTipoId = tipo.rows[0].id;
  const unidade = async (identificacao, situacao = 'DISPONIVEL') => (await dbPool.query(
    `INSERT INTO instrumentos (tipo_instrumento_id, identificacao, situacao)
     VALUES ($1, $2, $3) RETURNING id`, [caixaTipoId, identificacao, situacao],
  )).rows[0].id;
  const disponivel = await unidade('MANUT-DISP');
  const emprestado = await unidade('MANUT-EMPR', 'EMPRESTADO');
  const manutencaoAtiva = (instrumentoId, method = 'POST', body = { motivo: 'Revisar pele' }, cookie = diretoria) =>
    chamar(`/instrumentos/${instrumentoId}/manutencoes`, { method, cookie, body });
  const query = async (sql, params = []) => (await dbPool.query(sql, params)).rows;

  await t.test('perfis, validação, unidade emprestada e abertura atômica', async () => {
    assert.equal((await chamar(`/instrumentos/${disponivel}/manutencoes`)).status, 401);
    assert.equal((await manutencaoAtiva(disponivel, 'POST', { motivo: 'Revisar' }, integrante)).dados.error.code, 'ACESSO_NEGADO');
    assert.equal((await manutencaoAtiva(emprestado)).dados.error.code, 'INSTRUMENTO_INDISPONIVEL');
    assert.equal((await manutencaoAtiva(disponivel, 'POST', { motivo: '   ' })).dados.error.code, 'DADOS_INVALIDOS');
    assert.equal((await manutencaoAtiva(disponivel, 'POST', { motivo: 'x'.repeat(501) })).dados.error.code, 'DADOS_INVALIDOS');
    const aberta = await manutencaoAtiva(disponivel);
    assert.equal(aberta.status, 201);
    assert.deepEqual(aberta.dados.manutencao, {
      id: 1, instrumentoId: disponivel, motivo: 'Revisar pele',
      abertaEm: aberta.dados.manutencao.abertaEm, encerradaEm: null, situacao: 'ABERTA',
    });
    assert.equal((await query('SELECT situacao FROM instrumentos WHERE id = $1', [disponivel]))[0].situacao, 'EM_MANUTENCAO');
    const historico = await chamar(`/instrumentos/${disponivel}/manutencoes`, { cookie: diretoria });
    assert.equal(historico.status, 200);
    assert.equal(historico.dados.manutencoes.length, 1);
    assert.equal(historico.dados.manutencoes[0].id, aberta.dados.manutencao.id);
    assert.equal((await manutencaoAtiva(disponivel, 'POST')).dados.error.code, 'INSTRUMENTO_INDISPONIVEL');
  });

  await t.test('encerramento transacional, histórico e repetição após uma retirada nova', async () => {
    const registro = (await query('SELECT id FROM manutencoes WHERE instrumento_id = $1 AND encerrada_em IS NULL', [disponivel]))[0];
    const encerrar = id => chamar(`/instrumentos/${disponivel}/manutencoes/${id}/encerramento`, { method: 'PUT', cookie: diretoria, body: {} });
    const primeira = await encerrar(registro.id);
    assert.equal(primeira.status, 200);
    assert.equal(primeira.dados.manutencao.situacao, 'ENCERRADA');
    const dataOriginal = primeira.dados.manutencao.encerradaEm;
    assert.equal((await query('SELECT situacao FROM instrumentos WHERE id = $1', [disponivel]))[0].situacao, 'DISPONIVEL');

    const integranteId = loginIntegrante.dados.usuario.id;
    const emprestimo = await chamar('/emprestimos', { method: 'POST', cookie: diretoria, body: { integranteId, instrumentoId: disponivel } });
    assert.equal(emprestimo.status, 201);
    const repetida = await encerrar(registro.id);
    assert.equal(repetida.status, 200);
    assert.equal(repetida.dados.manutencao.encerradaEm, dataOriginal);
    assert.equal((await query('SELECT situacao FROM instrumentos WHERE id = $1', [disponivel]))[0].situacao, 'EMPRESTADO');
    assert.equal((await query('SELECT count(*)::integer AS total FROM manutencoes WHERE instrumento_id = $1', [disponivel]))[0].total, 1);
  });

  await t.test('encerramento exige unidade e manutenção correspondentes', async () => {
    assert.equal((await chamar('/instrumentos/2147483647/manutencoes/1/encerramento', { method: 'PUT', cookie: diretoria, body: {} })).dados.error.code, 'INSTRUMENTO_NAO_ENCONTRADO');
    assert.equal((await chamar(`/instrumentos/${disponivel}/manutencoes/2147483647/encerramento`, { method: 'PUT', cookie: diretoria, body: {} })).dados.error.code, 'MANUTENCAO_NAO_ENCONTRADA');
  });

  await t.test('aberturas concorrentes preservam um único histórico ativo', async () => {
    const concorrente = await unidade('MANUT-CONC');
    const respostas = await Promise.all([
      manutencaoAtiva(concorrente), manutencaoAtiva(concorrente, 'POST', { motivo: 'Ajustar aro' }),
    ]);
    assert.deepEqual(respostas.map(item => item.status).sort(), [201, 409]);
    assert.equal((await query('SELECT count(*)::integer AS total FROM manutencoes WHERE instrumento_id = $1 AND encerrada_em IS NULL', [concorrente]))[0].total, 1);
    assert.equal((await query('SELECT situacao FROM instrumentos WHERE id = $1', [concorrente]))[0].situacao, 'EM_MANUTENCAO');
  });

  await t.test('abertura e retirada concorrentes não deixam estoque e histórico divergentes', async () => {
    const concorrente = await unidade('MANUT-EMPREST-CONC');
    const integranteId = loginIntegrante.dados.usuario.id;
    const resultados = await Promise.all([
      manutencaoAtiva(concorrente),
      chamar('/emprestimos', { method: 'POST', cookie: diretoria, body: { integranteId, instrumentoId: concorrente } }),
    ]);
    assert.deepEqual(resultados.map(item => item.status).sort(), [201, 409]);
    const [estado] = await query(
      `SELECT i.situacao,
              (SELECT count(*)::integer FROM manutencoes m WHERE m.instrumento_id = i.id AND m.encerrada_em IS NULL) AS manutencoes_abertas,
              (SELECT count(*)::integer FROM emprestimos e WHERE e.instrumento_id = i.id AND e.devolucao_em IS NULL) AS emprestimos_ativos
       FROM instrumentos i WHERE i.id = $1`, [concorrente],
    );
    assert.ok(
      (estado.situacao === 'EM_MANUTENCAO' && estado.manutencoes_abertas === 1 && estado.emprestimos_ativos === 0)
      || (estado.situacao === 'EMPRESTADO' && estado.manutencoes_abertas === 0 && estado.emprestimos_ativos === 1),
    );
  });
});
