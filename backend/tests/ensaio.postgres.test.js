import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/AuthService.js';
import { SenhaService } from '../src/services/SenhaService.js';
import { UsuarioRepository } from '../src/repositories/UsuarioRepository.js';
import { SessaoRepository } from '../src/repositories/SessaoRepository.js';
import { EnsaioRepository } from '../src/repositories/EnsaioRepository.js';
import { EnsaioService } from '../src/services/EnsaioService.js';
import { env } from '../src/config/env.js';

const habilitado = process.env.ENSAIO_PG_INTEGRATION === '1' || process.env.PG_INTEGRATION === '1';

test('persistência e regras de ensaios com PostgreSQL descartável', { skip: !habilitado }, async t => {
  const dbSuffix = randomBytes(4).toString('hex');
  const nomeBancoDescartavel = `bateria_ensaios_test_${dbSuffix}`;

  // Conexão administrativa para criar o banco de teste descartável
  const adminConfig = {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password || process.env.DB_PASSWORD || '1234',
    database: 'postgres',
  };

  const adminPool = new pg.Pool(adminConfig);
  await adminPool.query(`CREATE DATABASE ${nomeBancoDescartavel}`);

  const testDbConfig = {
    ...adminConfig,
    database: nomeBancoDescartavel,
  };

  const banco = new pg.Pool(testDbConfig);

  t.after(async () => {
    await banco.end();
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS ${nomeBancoDescartavel} WITH (FORCE)`);
    } finally {
      await adminPool.end();
    }
  });

  // Aplicar os scripts de estrutura e sementes de desenvolvimento
  for (const caminho of [
    '001-criar-usuarios.sql',
    '002-criar-sessoes.sql',
    '003-criar-ensaios.sql',
    'seeds/001-usuarios-desenvolvimento.sql',
  ]) {
    const sql = await readFile(new URL(`../../database/${caminho}`, import.meta.url), 'utf8');
    await banco.query(sql);
  }

  // Instanciar repositórios e serviços reais apontando para o banco descartável
  const usuarioRepo = new UsuarioRepository(banco);
  const sessaoRepo = new SessaoRepository(banco);
  const authService = new AuthService({
    usuarios: usuarioRepo,
    sessoes: sessaoRepo,
    senhas: new SenhaService(),
  });

  const ensaioRepo = new EnsaioRepository(banco);
  const ensaioService = new EnsaioService({ ensaios: ensaioRepo });

  const app = createApp({ authService, ensaioService });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  const login = async (email, senha) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    assert.equal(res.status, 200);
    return res.headers.get('set-cookie').split(';')[0];
  };

  const cookieDiretoria = await login('diretoria@bateria.example', 'DiretoriaDemo!2026');
  const cookieIntegrante = await login('integrante@bateria.example', 'IntegranteDemo!2026');

  // 1. Diretoria cadastra ensaio via HTTP
  const postRes = await fetch(`${base}/api/ensaios`, {
    method: 'POST',
    headers: {
      Cookie: cookieDiretoria,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inicioEm: '2026-11-10T19:00:00-03:00',
      local: 'Quadra do campus',
      descricao: 'Ensaio geral de integração',
    }),
  });
  assert.equal(postRes.status, 201);
  assert.equal(postRes.headers.get('Location'), '/api/ensaios/1');
  const { ensaio: ensaioCriado } = await postRes.json();
  assert.equal(ensaioCriado.id, 1);
  assert.equal(ensaioCriado.inicioEm, '2026-11-10T22:00:00.000Z');
  assert.equal(ensaioCriado.situacao, 'AGENDADO');

  // Conferência direta no banco de dados (persistência e timestamptz)
  const dbCheck = await banco.query('SELECT id, inicio_em, local, descricao, situacao FROM ensaios WHERE id = 1');
  assert.equal(dbCheck.rows.length, 1);
  const row = dbCheck.rows[0];
  assert.equal(row.id, 1);
  assert.equal(row.local, 'Quadra do campus');
  assert.equal(row.descricao, 'Ensaio geral de integração');
  assert.equal(row.situacao, 'AGENDADO');
  assert.equal(row.inicio_em.toISOString(), '2026-11-10T22:00:00.000Z');

  // 2. Validações adicionais contra caractere nulo \u0000 e ano 0000 não geram erro 500 no PostgreSQL
  const postNulo = await fetch(`${base}/api/ensaios`, {
    method: 'POST',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Local\u0000Invalido' }),
  });
  assert.equal(postNulo.status, 400);
  assert.equal((await postNulo.json()).error.code, 'DADOS_INVALIDOS');

  const postAnoZero = await fetch(`${base}/api/ensaios`, {
    method: 'POST',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inicioEm: '0000-01-01T00:00:00Z', local: 'Quadra' }),
  });
  assert.equal(postAnoZero.status, 400);
  assert.equal((await postAnoZero.json()).error.code, 'DADOS_INVALIDOS');

  // 3. Integrante pode consultar o ensaio criado
  const getRes = await fetch(`${base}/api/ensaios/1`, {
    headers: { Cookie: cookieIntegrante },
  });
  assert.equal(getRes.status, 200);
  assert.deepEqual(await getRes.json(), { ensaio: ensaioCriado });

  // Consulta por ID recusando query params desconhecidos
  const getComQuery = await fetch(`${base}/api/ensaios/1?outro=1`, {
    headers: { Cookie: cookieIntegrante },
  });
  assert.equal(getComQuery.status, 400);
  assert.equal((await getComQuery.json()).error.code, 'DADOS_INVALIDOS');

  // 4. Integrante tenta alterar via HTTP e recebe 403 ACESSO_NEGADO
  const putProibido = await fetch(`${base}/api/ensaios/1`, {
    method: 'PUT',
    headers: {
      Cookie: cookieIntegrante,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inicioEm: '2026-11-10T20:00:00-03:00',
      local: 'Alteração Indevida',
    }),
  });
  assert.equal(putProibido.status, 403);
  assert.equal((await putProibido.json()).error.code, 'ACESSO_NEGADO');

  // 5. Diretoria cadastra segundo ensaio com data anterior para testar ordenação do banco
  await fetch(`${base}/api/ensaios`, {
    method: 'POST',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inicioEm: '2026-11-09T18:00:00-03:00',
      local: 'Galpão de ensaios',
    }),
  });

  const listaRes = await fetch(`${base}/api/ensaios`, {
    headers: { Cookie: cookieIntegrante },
  });
  assert.equal(listaRes.status, 200);
  const { ensaios } = await listaRes.json();
  assert.equal(ensaios.length, 2);
  assert.equal(ensaios[0].id, 2); // 2026-11-09 vem antes de 2026-11-10
  assert.equal(ensaios[1].id, 1);

  // 6. Diretoria edita ensaio 1
  const putRes = await fetch(`${base}/api/ensaios/1`, {
    method: 'PUT',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inicioEm: '2026-11-10T20:00:00-03:00',
      local: 'Quadra Central Renovada',
      descricao: null,
    }),
  });
  assert.equal(putRes.status, 200);
  const { ensaio: ensaioEditado } = await putRes.json();
  assert.equal(ensaioEditado.id, 1);
  assert.equal(ensaioEditado.inicioEm, '2026-11-10T23:00:00.000Z');
  assert.equal(ensaioEditado.local, 'Quadra Central Renovada');
  assert.equal(ensaioEditado.descricao, null);
  assert.equal(ensaioEditado.situacao, 'AGENDADO');

  // 7. Diretoria cancela ensaio 1
  const cancelRes1 = await fetch(`${base}/api/ensaios/1/cancelamento`, {
    method: 'PATCH',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(cancelRes1.status, 200);
  const { ensaio: ensaioCancelado } = await cancelRes1.json();
  assert.equal(ensaioCancelado.id, 1);
  assert.equal(ensaioCancelado.situacao, 'CANCELADO');

  // Idempotência no PostgreSQL: repetir cancelamento mantém CANCELADO e responde 200
  const cancelRes2 = await fetch(`${base}/api/ensaios/1/cancelamento`, {
    method: 'PATCH',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(cancelRes2.status, 200);
  assert.deepEqual(await cancelRes2.json(), { ensaio: ensaioCancelado });

  // 8. Proteção de concorrência / integridade no banco: tentar editar ensaio cancelado retorna 409
  const putCancelado = await fetch(`${base}/api/ensaios/1`, {
    method: 'PUT',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inicioEm: '2026-11-10T21:00:00-03:00',
      local: 'Tentativa em cancelado',
    }),
  });
  assert.equal(putCancelado.status, 409);
  assert.equal((await putCancelado.json()).error.code, 'ENSAIO_CANCELADO');

  // 9. Filtro no banco
  const filtroAgendados = await fetch(`${base}/api/ensaios?situacao=AGENDADO`, {
    headers: { Cookie: cookieIntegrante },
  });
  const agendados = (await filtroAgendados.json()).ensaios;
  assert.equal(agendados.length, 1);
  assert.equal(agendados[0].id, 2);

  const filtroCancelados = await fetch(`${base}/api/ensaios?situacao=CANCELADO`, {
    headers: { Cookie: cookieIntegrante },
  });
  const cancelados = (await filtroCancelados.json()).ensaios;
  assert.equal(cancelados.length, 1);
  assert.equal(cancelados[0].id, 1);
});
