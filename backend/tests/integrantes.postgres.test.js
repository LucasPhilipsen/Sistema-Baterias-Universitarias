import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { dbPool } from '../src/config/database.js';
import { env } from '../src/config/env.js';

test('API de integrantes com PostgreSQL descartável', { skip: process.env.INTEGRANTES_PG_INTEGRATION !== '1' }, async t => {
  assert.equal(env.nodeEnv, 'test');
  assert.match(env.db.database, /^bateria_integrantes_test_[a-z0-9_]+$/);
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

  const { rowCount } = await dbPool.query("SELECT 1 FROM pg_tables WHERE schemaname = 'public'");
  assert.equal(rowCount, 0, 'Use um banco de teste vazio.');
  for (const arquivo of ['001-criar-usuarios.sql', '002-criar-sessoes.sql', 'seeds/001-usuarios-desenvolvimento.sql']) {
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
  const loginIntegrante = await entrar('integrante@bateria.example', 'IntegranteDemo!2026');
  assert.equal(loginDiretoria.status, 200);
  assert.equal(loginIntegrante.status, 200);
  const diretoria = cookieDe(loginDiretoria);
  const membro = cookieDe(loginIntegrante);
  const idDiretoria = loginDiretoria.dados.usuario.id;
  const idMembro = loginIntegrante.dados.usuario.id;
  const senha = '  Demo de integrante  ';
  const cadastro = { nome: '  Ana Teste  ', email: '  ANA@BATERIA.EXAMPLE  ', senha };
  const salvar = body => chamar('/integrantes', { method: 'POST', cookie: diretoria, body });

  await t.test('somente a diretoria acessa as quatro rotas e escreve com JSON da mesma origem', async () => {
    for (const [method, caminho, body] of [
      ['GET', '/integrantes'], ['GET', `/integrantes/${idMembro}`],
      ['POST', '/integrantes', cadastro], ['PUT', `/integrantes/${idMembro}`, { nome: 'Teste', email: 'teste@bateria.example' }],
    ]) {
      const semSessao = await chamar(caminho, { method, body });
      assert.equal(semSessao.status, 401);
      const semPermissao = await chamar(caminho, { method, body, cookie: membro });
      assert.equal(semPermissao.status, 403);
      assert.equal(semPermissao.dados.error.code, 'ACESSO_NEGADO');
    }
    const origem = await chamar('/integrantes', { method: 'POST', body: cadastro, cookie: diretoria, headers: { Origin: 'https://outro.example' } });
    assert.equal(origem.status, 403);
    assert.equal(origem.dados.error.code, 'ORIGEM_INVALIDA');
    const texto = await chamar('/integrantes', { method: 'POST', body: cadastro, cookie: diretoria, headers: { 'Content-Type': 'text/plain' } });
    assert.equal(texto.status, 415);
  });

  await t.test('recusa dados inválidos, campos extras, filtros e IDs fora do contrato', async () => {
    for (const body of [[], {}, { ...cadastro, nome: ' ' }, { ...cadastro, nome: 'Ana\u0000' },
      { ...cadastro, email: 'invalido' }, { ...cadastro, email: 'a\u0000@bateria.example' },
      { ...cadastro, senha: '🎵'.repeat(11) }, { ...cadastro, senha: '🎵'.repeat(257) },
      { ...cadastro, perfil: 'DIRETORIA' }, { ...cadastro, id: 1 }]) {
      const r = await salvar(body);
      assert.equal(r.status, 400);
      assert.equal(r.dados.error.code, 'DADOS_INVALIDOS');
    }
    for (const caminho of ['/integrantes?email=test', '/integrantes/1e0', '/integrantes/2147483648', `/integrantes/${idMembro}?nome=test`]) {
      assert.equal((await chamar(caminho, { cookie: diretoria })).status, 400);
    }
    const editarSenha = await chamar(`/integrantes/${idMembro}`, {
      method: 'PUT', cookie: diretoria, body: { nome: 'Teste', email: 'teste@bateria.example', senha },
    });
    assert.equal(editarSenha.status, 400);
    assert.equal((await chamar(`/integrantes/${idDiretoria}`, { cookie: diretoria })).status, 404);
    assert.equal((await chamar(`/integrantes/${idDiretoria}`, {
      method: 'PUT', cookie: diretoria, body: { nome: 'Troca', email: 'troca@bateria.example' },
    })).status, 404);
    assert.equal((await chamar('/integrantes/2147483647', { cookie: diretoria })).dados.error.code, 'INTEGRANTE_NAO_ENCONTRADO');
  });

  await t.test('persiste cadastro e edição, protege credenciais e integra com login e listagem', async () => {
    const criada = await salvar(cadastro);
    assert.equal(criada.status, 201);
    const id = criada.dados.integrante.id;
    const caminho = `/integrantes/${id}`;
    assert.equal(criada.headers.get('location'), `/api${caminho}`);
    const ana = { id, nome: 'Ana Teste', email: 'ana@bateria.example', perfil: 'INTEGRANTE' };
    assert.ok(Number.isInteger(id) && id > 0);
    assert.deepEqual(criada.dados, { integrante: ana });
    const consulta = await chamar(caminho, { cookie: diretoria });
    assert.deepEqual(consulta.dados, { integrante: ana });
    const lista = await chamar('/integrantes', { cookie: diretoria });
    assert.deepEqual(lista.dados.integrantes, [ana, loginIntegrante.dados.usuario]);
    assert.equal(lista.headers.get('cache-control'), 'no-store');
    const hash = async () => (await dbPool.query('SELECT senha_hash FROM usuarios WHERE id = $1', [id])).rows[0].senha_hash;
    const hashOriginal = await hash();
    assert.match(hashOriginal, /^scrypt\$131072\$8\$1\$/);
    assert.equal((await entrar(ana.email, senha.trim())).status, 401);
    assert.deepEqual((await entrar(ana.email, senha)).dados, { usuario: ana });

    const editar = (nome, email) => chamar(caminho, { method: 'PUT', cookie: diretoria, body: { nome, email } });
    const emailDiretoria = loginDiretoria.dados.usuario.email;
    const conflito = await editar('Ana Teste', ` ${emailDiretoria.toUpperCase()} `);
    assert.equal(conflito.status, 409);
    assert.equal(conflito.dados.error.code, 'EMAIL_DUPLICADO');
    assert.deepEqual((await chamar(caminho, { cookie: diretoria })).dados, { integrante: ana });
    const alterada = { ...ana, nome: 'Ana Atualizada', email: 'atualizada@bateria.example' };
    const edicao = await editar(' Ana Atualizada ', ' ATUALIZADA@BATERIA.EXAMPLE ');
    assert.equal(edicao.status, 200);
    assert.deepEqual(edicao.dados, { integrante: alterada });
    assert.deepEqual((await chamar(caminho, { cookie: diretoria })).dados, { integrante: alterada });
    assert.equal(await hash(), hashOriginal);
    assert.equal((await entrar(ana.email, senha)).status, 401);
    assert.deepEqual((await entrar(alterada.email, senha)).dados, { usuario: alterada });
  });

  await t.test('restrição de unicidade resolve cadastro concorrente com e-mail normalizado', async () => {
    const resultados = await Promise.all([
      salvar({ ...cadastro, email: 'concorrencia@bateria.example' }),
      salvar({ ...cadastro, email: ' CONCORRENCIA@BATERIA.EXAMPLE ' }),
    ]);
    assert.deepEqual(resultados.map(r => r.status).sort(), [201, 409]);
    assert.equal(resultados.find(r => r.status === 409).dados.error.code, 'EMAIL_DUPLICADO');
    const { rowCount } = await dbPool.query('SELECT 1 FROM usuarios WHERE email = $1', ['concorrencia@bateria.example']);
    assert.equal(rowCount, 1);
  });
});
