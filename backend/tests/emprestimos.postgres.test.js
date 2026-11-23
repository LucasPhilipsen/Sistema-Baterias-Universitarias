import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { dbPool } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { EmprestimoRepository } from '../src/repositories/EmprestimoRepository.js';

test('API de empréstimos com PostgreSQL descartável', { skip: process.env.EMPRESTIMOS_PG_INTEGRATION !== '1' }, async t => {
  assert.equal(env.nodeEnv, 'test');
  assert.match(env.db.database, /^bateria_emprestimos_test_[a-z0-9_]+$/);
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
    '006-criar-emprestimos.sql', 'seeds/001-usuarios-desenvolvimento.sql',
  ]) {
    await dbPool.query(await readFile(new URL(`../../database/${arquivo}`, import.meta.url), 'utf8'));
  }

  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function chamar(caminho, { method = 'GET', cookie, body, headers } = {}) {
    const resposta = await fetch(base + caminho, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: resposta.status, headers: resposta.headers, dados: await resposta.json() };
  }
  const entrar = (email, senha) => chamar('/auth/login', { method: 'POST', body: { email, senha } });
  const cookieDe = resposta => resposta.headers.get('set-cookie').split(';')[0];
  const loginDiretoria = await entrar('diretoria@bateria.example', 'DiretoriaDemo!2026');
  const loginAna = await entrar('integrante@bateria.example', 'IntegranteDemo!2026');
  assert.equal(loginDiretoria.status, 200);
  assert.equal(loginAna.status, 200);
  const diretoria = cookieDe(loginDiretoria);
  const ana = cookieDe(loginAna);
  const bia = await dbPool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil)
     SELECT 'Bia de Teste', 'bia.emprestimo@bateria.example', senha_hash, 'INTEGRANTE'
     FROM usuarios WHERE email = 'integrante@bateria.example' RETURNING id`,
  );
  const biaId = bia.rows[0].id;
  const tipo = await dbPool.query("INSERT INTO tipos_instrumentos (nome) VALUES ('Caixa') RETURNING id");
  const caixaTipoId = tipo.rows[0].id;
  const unidade = async (identificacao, situacao = 'DISPONIVEL') => (await dbPool.query(
    `INSERT INTO instrumentos (tipo_instrumento_id, identificacao, situacao)
     VALUES ($1, $2, $3) RETURNING id`,
    [caixaTipoId, identificacao, situacao],
  )).rows[0].id;
  const caixaAtiva = await unidade('CAIXA-ATIVA');
  const caixaManutencao = await unidade('CAIXA-MANUT', 'EM_MANUTENCAO');
  const postEmprestimo = (integranteId, instrumentoId, cookie = diretoria) => chamar('/emprestimos', {
    method: 'POST', cookie, body: { integranteId, instrumentoId },
  });
  const sql = async (query, params = []) => (await dbPool.query(query, params)).rows;

  await t.test('autorização, validação da entrada e recusas por situação', async () => {
    assert.equal((await chamar('/emprestimos')).status, 401);
    assert.equal((await chamar('/emprestimos', { cookie: ana, method: 'POST', body: { integranteId: loginAna.dados.usuario.id, instrumentoId: caixaAtiva } })).status, 403);
    assert.equal((await chamar('/emprestimos?usuarioId=1', { cookie: diretoria })).dados.error.code, 'DADOS_INVALIDOS');
    assert.equal((await postEmprestimo(999999, caixaAtiva)).dados.error.code, 'INTEGRANTE_NAO_ENCONTRADO');
    assert.equal((await postEmprestimo(loginAna.dados.usuario.id, 999999)).dados.error.code, 'INSTRUMENTO_NAO_ENCONTRADO');
    assert.equal((await postEmprestimo(loginAna.dados.usuario.id, caixaManutencao)).dados.error.code, 'INSTRUMENTO_INDISPONIVEL');
    assert.equal((await postEmprestimo(loginAna.dados.usuario.id, caixaAtiva, ana)).dados.error.code, 'ACESSO_NEGADO');
  });

  await t.test('retirada persiste, atualiza a mesma unidade e restringe o histórico por perfil', async () => {
    const resposta = await postEmprestimo(loginAna.dados.usuario.id, caixaAtiva);
    assert.equal(resposta.status, 201);
    const emprestimo = resposta.dados.emprestimo;
    assert.deepEqual(emprestimo.integrante, { id: loginAna.dados.usuario.id, nome: 'Integrante de Demonstração' });
    assert.deepEqual(emprestimo.instrumento, { id: caixaAtiva, identificacao: 'CAIXA-ATIVA' });
    assert.match(emprestimo.retiradaEm, /^\d{4}-\d\d-\d\dT.*Z$/);
    assert.equal(emprestimo.devolucaoEm, null);
    assert.equal(emprestimo.situacao, 'ATIVO');
    assert.equal((await sql('SELECT situacao FROM instrumentos WHERE id = $1', [caixaAtiva]))[0].situacao, 'EMPRESTADO');
    assert.equal((await chamar('/emprestimos', { cookie: diretoria })).dados.emprestimos.length, 1);
    assert.equal((await chamar('/emprestimos', { cookie: ana })).dados.emprestimos[0].integrante.id, loginAna.dados.usuario.id);
    assert.equal((await chamar('/emprestimos', { cookie: cookieDe(await entrar('bia.emprestimo@bateria.example', 'IntegranteDemo!2026')) })).dados.emprestimos.length, 0);
    assert.equal((await postEmprestimo(biaId, caixaAtiva)).dados.error.code, 'INSTRUMENTO_INDISPONIVEL');
  });

  await t.test('devolução repetida não libera uma unidade emprestada novamente', async () => {
    const atual = (await sql('SELECT id FROM emprestimos WHERE instrumento_id = $1 AND devolucao_em IS NULL', [caixaAtiva]))[0];
    const primeira = await chamar(`/emprestimos/${atual.id}/devolucao`, { method: 'PUT', cookie: diretoria, body: {} });
    assert.equal(primeira.status, 200);
    assert.equal(primeira.dados.emprestimo.situacao, 'DEVOLVIDO');
    const dataDevolucao = primeira.dados.emprestimo.devolucaoEm;
    assert.equal((await sql('SELECT situacao FROM instrumentos WHERE id = $1', [caixaAtiva]))[0].situacao, 'DISPONIVEL');

    const novo = await postEmprestimo(biaId, caixaAtiva);
    assert.equal(novo.status, 201);
    const repetida = await chamar(`/emprestimos/${atual.id}/devolucao`, { method: 'PUT', cookie: diretoria, body: {} });
    assert.equal(repetida.status, 200);
    assert.equal(repetida.dados.emprestimo.devolucaoEm, dataDevolucao);
    assert.equal((await sql('SELECT situacao FROM instrumentos WHERE id = $1', [caixaAtiva]))[0].situacao, 'EMPRESTADO');
    assert.equal((await sql('SELECT count(*)::integer AS quantidade FROM emprestimos WHERE instrumento_id = $1 AND devolucao_em IS NULL', [caixaAtiva]))[0].quantidade, 1);
    assert.equal((await chamar(`/emprestimos/${atual.id}/devolucao`, { method: 'PUT', cookie: diretoria, body: { devolucaoEm: null } })).dados.error.code, 'DADOS_INVALIDOS');
  });

  await t.test('retiradas concorrentes preservam a unicidade ativa', async () => {
    const concorrente = await unidade('CAIXA-CONCORRENTE');
    const resultados = await Promise.all([
      postEmprestimo(loginAna.dados.usuario.id, concorrente),
      postEmprestimo(biaId, concorrente),
    ]);
    assert.deepEqual(resultados.map(item => item.status).sort(), [201, 409]);
    assert.equal((await sql('SELECT count(*)::integer AS quantidade FROM emprestimos WHERE instrumento_id = $1 AND devolucao_em IS NULL', [concorrente]))[0].quantidade, 1);
    assert.equal((await sql('SELECT situacao FROM instrumentos WHERE id = $1', [concorrente]))[0].situacao, 'EMPRESTADO');
  });

  await t.test('retirada iniciada primeiro registra horário posterior à devolução que liberou a unidade', async () => {
    const instrumentoId = await unidade('CAIXA-DATAS');
    const anterior = await postEmprestimo(loginAna.dados.usuario.id, instrumentoId);
    assert.equal(anterior.status, 201);
    const anteriorId = anterior.dados.emprestimo.id;
    const iniciou = Promise.withResolvers();
    const continuar = Promise.withResolvers();
    const repositorioAtrasado = new EmprestimoRepository({
      async connect() {
        const conexao = await dbPool.connect();
        return {
          async query(texto, params) {
            const resultado = await conexao.query(texto, params);
            if (texto === 'BEGIN') {
              iniciou.resolve();
              await continuar.promise;
            }
            return resultado;
          },
          release: () => conexao.release(),
        };
      },
    });

    const novaRetirada = repositorioAtrasado.criar({ integranteId: biaId, instrumentoId });
    const devolverAnterior = async () => {
      try {
        await Promise.race([iniciou.promise, novaRetirada]);
        await dbPool.query('SELECT pg_sleep(0.025)');
        const resposta = await chamar(`/emprestimos/${anteriorId}/devolucao`, {
          method: 'PUT', cookie: diretoria, body: {},
        });
        assert.equal(resposta.status, 200);
      } finally {
        continuar.resolve();
      }
    };
    const [novo] = await Promise.all([novaRetirada, devolverAnterior()]);
    const [datas] = await sql(
      `SELECT novo.retirada_em >= anterior.devolucao_em AS retirada_apos_devolucao
       FROM emprestimos novo, emprestimos anterior
       WHERE novo.id = $1 AND anterior.id = $2`,
      [novo.id, anteriorId],
    );
    assert.equal(datas.retirada_apos_devolucao, true);
  });
});
