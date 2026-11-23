import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/AuthService.js';
import { SenhaService } from '../src/services/SenhaService.js';
import { UsuarioRepository } from '../src/repositories/UsuarioRepository.js';
import { SessaoRepository } from '../src/repositories/SessaoRepository.js';
import { criarDemandaService } from '../src/config/demanda.js';
import { env } from '../src/config/env.js';

// Confere a consulta real da demanda com os scripts 001 a 005. Confirmações e movimentações são
// preparadas diretamente no banco: as rotas de confirmação (SCRUM-41) e de empréstimos (SCRUM-42)
// têm seus próprios testes, e aqui interessa o efeito delas na próxima consulta.
test('demanda com PostgreSQL descartável', { skip: process.env.DEMANDA_PG_INTEGRATION !== '1' }, async t => {
  assert.match(env.db.database, /^bateria_demanda_test_[a-z0-9_]+$/, 'Use um banco novo e descartável com prefixo bateria_demanda_test_.');
  const banco = new pg.Pool(env.db);
  t.after(() => banco.end());
  for (const caminho of [
    '001-criar-usuarios.sql', '002-criar-sessoes.sql', '003-criar-ensaios.sql', '004-criar-instrumentos.sql',
    '005-criar-confirmacoes.sql', 'seeds/001-usuarios-desenvolvimento.sql',
  ]) {
    await banco.query(await readFile(new URL(`../../database/${caminho}`, import.meta.url), 'utf8'));
  }

  const authService = new AuthService({
    usuarios: new UsuarioRepository(banco), sessoes: new SessaoRepository(banco), senhas: new SenhaService(),
  });
  const app = createApp({ authService, demandaService: criarDemandaService(banco) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const entrar = async (email, senha) => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }),
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  const diretoria = await entrar('diretoria@bateria.example', 'DiretoriaDemo!2026');
  const integrante = await entrar('integrante@bateria.example', 'IntegranteDemo!2026');
  const consultar = async (ensaioId, cookie = diretoria) => {
    const response = await fetch(`${base}/api/ensaios/${ensaioId}/demanda`, { headers: { Cookie: cookie } });
    return { status: response.status, corpo: await response.json() };
  };
  const sql = async (texto, parametros = []) => (await banco.query(texto, parametros)).rows;
  const linhas = async ensaioId => {
    const resposta = await consultar(ensaioId);
    assert.equal(resposta.status, 200);
    return Object.fromEntries(resposta.corpo.demanda.tipos.map(({ nome, ...resto }) => [nome, resto]));
  };

  // Dados fictícios: três tipos, unidades em todas as situações, três ensaios e seis integrantes.
  const [caixa, repinique, surdo] = await Promise.all(['Caixa', 'Repinique', 'Surdo'].map(async nome =>
    (await sql('INSERT INTO tipos_instrumentos (nome) VALUES ($1) RETURNING id', [nome]))[0].id));
  const unidades = [
    ['CAIXA-001', caixa, 'DISPONIVEL'], ['CAIXA-002', caixa, 'DISPONIVEL'], ['CAIXA-003', caixa, 'DISPONIVEL'],
    ['CAIXA-004', caixa, 'EMPRESTADO'], ['CAIXA-005', caixa, 'EM_MANUTENCAO'],
    ['REPIQUE-001', repinique, 'DISPONIVEL'], ['REPIQUE-002', repinique, 'DISPONIVEL'],
  ];
  for (const [identificacao, tipo, situacao] of unidades) {
    await sql('INSERT INTO instrumentos (tipo_instrumento_id, identificacao, situacao) VALUES ($1, $2, $3)', [tipo, identificacao, situacao]);
  }
  const criarEnsaio = async situacao => (await sql(
    `INSERT INTO ensaios (inicio_em, local, situacao) VALUES ('2026-11-25T19:00:00-03:00', 'Quadra do campus', $1) RETURNING id`,
    [situacao],
  ))[0].id;
  const ensaio = await criarEnsaio('AGENDADO');
  const outroEnsaio = await criarEnsaio('AGENDADO');
  const ensaioCancelado = await criarEnsaio('CANCELADO');
  const usuarios = [];
  for (let i = 1; i <= 6; i++) {
    usuarios.push((await sql(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       SELECT $1, $2, senha_hash, 'INTEGRANTE' FROM usuarios WHERE email = 'integrante@bateria.example'
       RETURNING id`,
      [`Integrante Demanda ${i}`, `demanda${i}@bateria.example`],
    ))[0].id);
  }
  const confirmar = async (ensaioId, usuarioId, tipo) => (await sql(
    'INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id) VALUES ($1, $2, $3) RETURNING id',
    [ensaioId, usuarioId, tipo],
  ))[0].id;
  const confirmacoesCaixa = [];
  for (const usuarioId of usuarios.slice(0, 5)) confirmacoesCaixa.push(await confirmar(ensaio, usuarioId, caixa));
  const surdoCancelado = await confirmar(ensaio, usuarios[5], surdo);
  await sql('UPDATE confirmacoes SET cancelado_em = clock_timestamp() WHERE id = $1', [surdoCancelado]);
  await confirmar(outroEnsaio, usuarios[0], caixa);
  await confirmar(ensaioCancelado, usuarios[1], caixa);

  await t.test('cinco confirmações e três caixas disponíveis indicam falta de duas', async () => {
    const resposta = await consultar(ensaio);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.corpo.demanda.ensaioId, ensaio);
    assert.match(resposta.corpo.demanda.calculadoEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.deepEqual(resposta.corpo.demanda.tipos, [
      { tipoInstrumentoId: caixa, nome: 'Caixa', confirmados: 5, disponiveis: 3, falta: 2 },
      { tipoInstrumentoId: repinique, nome: 'Repinique', confirmados: 0, disponiveis: 2, falta: 0 },
      { tipoInstrumentoId: surdo, nome: 'Surdo', confirmados: 0, disponiveis: 0, falta: 0 },
    ], 'Emprestada, em manutenção, confirmação cancelada e outros ensaios ficam fora da contagem.');
  });

  await t.test('confirmações de outro ensaio são contadas separadamente', async () => {
    assert.deepEqual((await linhas(outroEnsaio)).Caixa, { tipoInstrumentoId: caixa, confirmados: 1, disponiveis: 3, falta: 0 });
  });

  await t.test('cancelar, reativar e trocar o tipo aparecem na próxima consulta', async () => {
    await sql('UPDATE confirmacoes SET cancelado_em = clock_timestamp(), atualizado_em = clock_timestamp() WHERE id = $1', [confirmacoesCaixa[0]]);
    assert.deepEqual((await linhas(ensaio)).Caixa, { tipoInstrumentoId: caixa, confirmados: 4, disponiveis: 3, falta: 1 });

    await sql('UPDATE confirmacoes SET cancelado_em = NULL, atualizado_em = clock_timestamp() WHERE id = $1', [surdoCancelado]);
    assert.deepEqual((await linhas(ensaio)).Surdo, { tipoInstrumentoId: surdo, confirmados: 1, disponiveis: 0, falta: 1 });

    await sql('UPDATE confirmacoes SET tipo_instrumento_id = $2, atualizado_em = clock_timestamp() WHERE id = $1', [confirmacoesCaixa[1], repinique]);
    const depois = await linhas(ensaio);
    assert.deepEqual(depois.Caixa, { tipoInstrumentoId: caixa, confirmados: 3, disponiveis: 3, falta: 0 });
    assert.deepEqual(depois.Repinique, { tipoInstrumentoId: repinique, confirmados: 1, disponiveis: 2, falta: 0 });
  });

  await t.test('retirada e devolução alteram a disponibilidade na próxima consulta', async () => {
    await sql(`UPDATE instrumentos SET situacao = 'EMPRESTADO' WHERE identificacao IN ('CAIXA-001', 'CAIXA-002')`);
    assert.deepEqual((await linhas(ensaio)).Caixa, { tipoInstrumentoId: caixa, confirmados: 3, disponiveis: 1, falta: 2 });
    await sql(`UPDATE instrumentos SET situacao = 'DISPONIVEL' WHERE identificacao IN ('CAIXA-001', 'CAIXA-002')`);
    assert.deepEqual((await linhas(ensaio)).Caixa, { tipoInstrumentoId: caixa, confirmados: 3, disponiveis: 3, falta: 0 });
  });

  await t.test('erros e permissões com sessões reais', async () => {
    let resposta = await consultar(ensaio, integrante);
    assert.equal(resposta.status, 403);
    assert.equal(resposta.corpo.error.code, 'ACESSO_NEGADO');
    resposta = await consultar(ensaioCancelado);
    assert.equal(resposta.status, 409);
    assert.equal(resposta.corpo.error.code, 'ENSAIO_CANCELADO');
    resposta = await consultar(2147483647);
    assert.equal(resposta.status, 404);
    assert.equal(resposta.corpo.error.code, 'ENSAIO_NAO_ENCONTRADO');
  });

  await t.test('a consulta não altera estoque nem confirmações', async () => {
    const estado = () => sql(
      `SELECT (SELECT json_agg(i ORDER BY id) FROM instrumentos i) AS instrumentos,
              (SELECT json_agg(c ORDER BY id) FROM confirmacoes c) AS confirmacoes`,
    );
    const antes = await estado();
    await consultar(ensaio);
    await consultar(outroEnsaio);
    assert.deepEqual(await estado(), antes);
  });
});
