import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/AuthService.js';
import { SenhaService } from '../src/services/SenhaService.js';
import { UsuarioRepository } from '../src/repositories/UsuarioRepository.js';
import { SessaoRepository } from '../src/repositories/SessaoRepository.js';
import { criarServicosEstoque } from '../src/config/estoque.js';
import { env } from '../src/config/env.js';

test('estoque completo com PostgreSQL descartável', { skip: process.env.ESTOQUE_PG_INTEGRATION !== '1' }, async t => {
  assert.match(env.db.database, /^bateria_estoque_test_[a-z0-9_]+$/, 'Use um banco novo e descartável com prefixo bateria_estoque_test_.');
  const banco = new pg.Pool(env.db);
  t.after(() => banco.end());
  for (const caminho of ['001-criar-usuarios.sql', '002-criar-sessoes.sql', '004-criar-instrumentos.sql', 'seeds/001-usuarios-desenvolvimento.sql']) {
    await banco.query(await readFile(new URL(`../../database/${caminho}`, import.meta.url), 'utf8'));
  }
  const authService = new AuthService({
    usuarios: new UsuarioRepository(banco), sessoes: new SessaoRepository(banco), senhas: new SenhaService(),
  });
  const app = createApp({ authService, estoque: criarServicosEstoque(banco) });
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
  const chamar = async (metodo, caminho, corpo, cookie = diretoria) => {
    const response = await fetch(base + caminho, {
      method: metodo,
      headers: { Cookie: cookie, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: response.status, location: response.headers.get('location'), corpo: await response.json() };
  };
  const contar = async tabela => (await banco.query(`SELECT count(*)::integer AS total FROM ${tabela}`)).rows[0].total;

  await t.test('tipos: persistência e unicidade sem diferenciar caixa, inclusive com acentos', async () => {
    const agogo = await chamar('POST', '/api/tipos-instrumentos', { nome: ' AGOGÔ ' });
    assert.equal(agogo.status, 201);
    assert.equal(agogo.corpo.tipoInstrumento.nome, 'AGOGÔ', 'A grafia com acento é preservada.');
    assert.equal(agogo.location, `/api/tipos-instrumentos/${agogo.corpo.tipoInstrumento.id}`);
    for (const nome of ['agogô', 'Agogô', 'AGOGÔ']) {
      const duplicado = await chamar('POST', '/api/tipos-instrumentos', { nome });
      assert.equal(duplicado.status, 409, nome);
      assert.equal(duplicado.corpo.error.code, 'TIPO_INSTRUMENTO_DUPLICADO');
    }
    const semAcento = await chamar('POST', '/api/tipos-instrumentos', { nome: 'agogo' });
    assert.equal(semAcento.status, 201, 'Acentos não são removidos: "agogo" é outro nome.');
    const caixa = await chamar('POST', '/api/tipos-instrumentos', { nome: 'Caixa' });
    const renomearParaExistente = await chamar('PUT', `/api/tipos-instrumentos/${caixa.corpo.tipoInstrumento.id}`, { nome: 'agogô' });
    assert.equal(renomearParaExistente.status, 409);
    assert.equal(renomearParaExistente.corpo.error.code, 'TIPO_INSTRUMENTO_DUPLICADO');
    const mudarCaixa = await chamar('PUT', `/api/tipos-instrumentos/${agogo.corpo.tipoInstrumento.id}`, { nome: 'Agogô' });
    assert.equal(mudarCaixa.status, 200);
    assert.deepEqual((await banco.query('SELECT nome FROM tipos_instrumentos WHERE id = $1', [agogo.corpo.tipoInstrumento.id])).rows[0], { nome: 'Agogô' });
    assert.equal(await contar('tipos_instrumentos'), 3);
    const consulta = await chamar('GET', `/api/tipos-instrumentos/${caixa.corpo.tipoInstrumento.id}`, undefined, integrante);
    assert.deepEqual(consulta.corpo, caixa.corpo);
  });

  const ids = {};
  await t.test('unidades: cadastro, identificação única entre tipos e tipo inexistente', async () => {
    for (const nome of ['Repinique', 'Surdo']) {
      ids[nome] = (await chamar('POST', '/api/tipos-instrumentos', { nome })).corpo.tipoInstrumento.id;
    }
    ids.Caixa = (await chamar('GET', '/api/tipos-instrumentos')).corpo.tiposInstrumentos.find(tipo => tipo.nome === 'Caixa').id;
    const criado = await chamar('POST', '/api/instrumentos', { tipoInstrumentoId: ids.Caixa, identificacao: 'caixa-001', observacoes: 'Pele revisada' });
    assert.equal(criado.status, 201);
    const { id } = criado.corpo.instrumento;
    assert.equal(criado.location, `/api/instrumentos/${id}`);
    assert.deepEqual(criado.corpo.instrumento, { id, tipoInstrumentoId: ids.Caixa, identificacao: 'CAIXA-001', situacao: 'DISPONIVEL', observacoes: 'Pele revisada' });
    assert.deepEqual((await banco.query('SELECT identificacao, situacao FROM instrumentos WHERE id = $1', [id])).rows[0], { identificacao: 'CAIXA-001', situacao: 'DISPONIVEL' });

    const duplicada = await chamar('POST', '/api/instrumentos', { tipoInstrumentoId: ids.Surdo, identificacao: 'Caixa-001' });
    assert.equal(duplicada.status, 409);
    assert.equal(duplicada.corpo.error.code, 'IDENTIFICACAO_DUPLICADA');
    const tipoInexistente = await chamar('POST', '/api/instrumentos', { tipoInstrumentoId: 2147483647, identificacao: 'NOVA-001' });
    assert.equal(tipoInexistente.status, 400);
    assert.equal(tipoInexistente.corpo.error.code, 'TIPO_INSTRUMENTO_INVALIDO');
    const tipoInexistenteEDuplicada = await chamar('POST', '/api/instrumentos', { tipoInstrumentoId: 2147483647, identificacao: 'CAIXA-001' });
    assert.equal(tipoInexistenteEDuplicada.corpo.error.code, 'TIPO_INSTRUMENTO_INVALIDO');
    const comSituacao = await chamar('POST', '/api/instrumentos', { tipoInstrumentoId: ids.Caixa, identificacao: 'CAIXA-050', situacao: 'EMPRESTADO' });
    assert.equal(comSituacao.status, 400);
    assert.equal(await contar('instrumentos'), 1, 'Cadastros recusados não salvam unidades.');

    for (const [tipo, identificacao] of [['Caixa', 'CAIXA-002'], ['Caixa', 'CAIXA-003'], ['Caixa', 'CAIXA-004'], ['Surdo', 'SURDO-001']]) {
      const resposta = await chamar('POST', '/api/instrumentos', { tipoInstrumentoId: ids[tipo], identificacao });
      assert.equal(resposta.status, 201);
      ids[identificacao] = resposta.corpo.instrumento.id;
    }
    ids['CAIXA-001'] = id;
    // Dados fictícios: as situações indisponíveis são preparadas diretamente no banco de testes.
    await banco.query("UPDATE instrumentos SET situacao = 'EMPRESTADO' WHERE identificacao = 'CAIXA-002'");
    await banco.query("UPDATE instrumentos SET situacao = 'EM_MANUTENCAO' WHERE identificacao IN ('CAIXA-003', 'SURDO-001')");
  });

  await t.test('unidades: edição, troca de tipo condicionada à situação e duplicidade', async () => {
    const editar = (identificacao, corpo) => chamar('PUT', `/api/instrumentos/${ids[identificacao]}`, corpo);
    const emprestada = await editar('CAIXA-002', { tipoInstrumentoId: ids.Repinique, identificacao: 'CAIXA-002' });
    assert.equal(emprestada.status, 409);
    assert.equal(emprestada.corpo.error.code, 'INSTRUMENTO_INDISPONIVEL');
    const manutencao = await editar('SURDO-001', { tipoInstrumentoId: ids.Caixa, identificacao: 'SURDO-001' });
    assert.equal(manutencao.corpo.error.code, 'INSTRUMENTO_INDISPONIVEL');
    assert.deepEqual((await banco.query('SELECT tipo_instrumento_id FROM instrumentos WHERE id = $1', [ids['CAIXA-002']])).rows[0], { tipo_instrumento_id: ids.Caixa });

    const mesmoTipo = await editar('CAIXA-002', { tipoInstrumentoId: ids.Caixa, identificacao: 'caixa-002', observacoes: 'Aro trocado' });
    assert.equal(mesmoTipo.status, 200);
    assert.equal(mesmoTipo.corpo.instrumento.situacao, 'EMPRESTADO');
    assert.equal(mesmoTipo.corpo.instrumento.observacoes, 'Aro trocado');
    const semObservacoes = await editar('CAIXA-002', { tipoInstrumentoId: ids.Caixa, identificacao: 'CAIXA-002' });
    assert.equal(semObservacoes.corpo.instrumento.observacoes, null, 'PUT substitui: observação omitida vira null.');

    const disponivel = await editar('CAIXA-004', { tipoInstrumentoId: ids.Repinique, identificacao: 'rep-001' });
    assert.equal(disponivel.status, 200);
    assert.equal(disponivel.corpo.instrumento.tipoInstrumentoId, ids.Repinique);
    assert.equal(disponivel.corpo.instrumento.identificacao, 'REP-001');
    const volta = await editar('CAIXA-004', { tipoInstrumentoId: ids.Caixa, identificacao: 'CAIXA-004' });
    assert.equal(volta.status, 200);

    assert.equal((await editar('CAIXA-004', { tipoInstrumentoId: ids.Caixa, identificacao: 'SURDO-001' })).corpo.error.code, 'IDENTIFICACAO_DUPLICADA');
    assert.equal((await editar('CAIXA-004', { tipoInstrumentoId: 999999, identificacao: 'CAIXA-004' })).corpo.error.code, 'TIPO_INSTRUMENTO_INVALIDO');
    assert.equal((await editar('CAIXA-004', { tipoInstrumentoId: ids.Caixa, identificacao: 'CAIXA-004', situacao: 'DISPONIVEL' })).status, 400);
    const inexistente = await chamar('PUT', '/api/instrumentos/2147483647', { tipoInstrumentoId: ids.Caixa, identificacao: 'X-1' });
    assert.equal(inexistente.status, 404);
    assert.equal(inexistente.corpo.error.code, 'INSTRUMENTO_NAO_ENCONTRADO');
    const consulta = await chamar('GET', `/api/instrumentos/${ids['CAIXA-004']}`, undefined, integrante);
    assert.deepEqual(consulta.corpo.instrumento, {
      id: ids['CAIXA-004'], tipoInstrumentoId: ids.Caixa, identificacao: 'CAIXA-004', situacao: 'DISPONIVEL', observacoes: null,
    });
  });

  await t.test('unidades: troca de tipo espera uma mudança de situação concorrente', async () => {
    const outra = await banco.connect();
    try {
      await outra.query('BEGIN');
      await outra.query("UPDATE instrumentos SET situacao = 'EMPRESTADO' WHERE id = $1", [ids['CAIXA-004']]);
      const pendente = chamar('PUT', `/api/instrumentos/${ids['CAIXA-004']}`, { tipoInstrumentoId: ids.Repinique, identificacao: 'CAIXA-004' });
      await new Promise(resolve => setTimeout(resolve, 300));
      await outra.query('COMMIT');
      const resposta = await pendente;
      assert.equal(resposta.status, 409);
      assert.equal(resposta.corpo.error.code, 'INSTRUMENTO_INDISPONIVEL');
    } finally {
      outra.release();
    }
    assert.deepEqual((await banco.query('SELECT tipo_instrumento_id, situacao FROM instrumentos WHERE id = $1', [ids['CAIXA-004']])).rows[0],
      { tipo_instrumento_id: ids.Caixa, situacao: 'EMPRESTADO' });
    await banco.query("UPDATE instrumentos SET situacao = 'DISPONIVEL' WHERE id = $1", [ids['CAIXA-004']]);
  });

  await t.test('unidades: filtros por tipo e situação consultados no banco', async () => {
    const listar = async query => {
      const resposta = await chamar('GET', `/api/instrumentos${query}`, undefined, integrante);
      assert.equal(resposta.status, 200, query);
      return resposta.corpo.instrumentos.map(i => i.identificacao);
    };
    assert.deepEqual(await listar(''), ['CAIXA-001', 'CAIXA-002', 'CAIXA-003', 'CAIXA-004', 'SURDO-001']);
    assert.deepEqual(await listar(`?tipoInstrumentoId=${ids.Caixa}`), ['CAIXA-001', 'CAIXA-002', 'CAIXA-003', 'CAIXA-004']);
    assert.deepEqual(await listar('?situacao=EM_MANUTENCAO'), ['CAIXA-003', 'SURDO-001']);
    assert.deepEqual(await listar(`?tipoInstrumentoId=${ids.Caixa}&situacao=DISPONIVEL`), ['CAIXA-001', 'CAIXA-004']);
    assert.deepEqual(await listar(`?situacao=EMPRESTADO&tipoInstrumentoId=${ids.Caixa}`), ['CAIXA-002']);
    assert.deepEqual(await listar(`?tipoInstrumentoId=${ids.Repinique}`), []);
    assert.deepEqual(await listar('?tipoInstrumentoId=2147483647'), []);
    assert.equal((await chamar('GET', '/api/instrumentos?situacao=QUEBRADO')).status, 400);
  });

  await t.test('estoque: contagens por situação, tipos sem unidades e números JSON', async () => {
    const resposta = await chamar('GET', '/api/estoque', undefined, integrante);
    assert.equal(resposta.status, 200);
    const porNome = Object.fromEntries(resposta.corpo.estoque.map(({ nome, ...resto }) => [nome, resto]));
    assert.deepEqual(Object.keys(porNome), (await chamar('GET', '/api/tipos-instrumentos')).corpo.tiposInstrumentos.map(tipo => tipo.nome),
      'Inclui todos os tipos, na mesma ordem por nome.');
    assert.deepEqual(porNome.Caixa, { tipoInstrumentoId: ids.Caixa, total: 4, disponiveis: 2, emprestados: 1, emManutencao: 1 });
    assert.deepEqual(porNome.Surdo, { tipoInstrumentoId: ids.Surdo, total: 1, disponiveis: 0, emprestados: 0, emManutencao: 1 });
    assert.deepEqual(porNome.Repinique, { tipoInstrumentoId: ids.Repinique, total: 0, disponiveis: 0, emprestados: 0, emManutencao: 0 });
    for (const item of resposta.corpo.estoque) {
      for (const campo of ['tipoInstrumentoId', 'total', 'disponiveis', 'emprestados', 'emManutencao']) {
        assert.equal(Number.isInteger(item[campo]), true, `${item.nome}.${campo}`);
      }
      assert.equal(item.total, item.disponiveis + item.emprestados + item.emManutencao);
    }
    const renomeado = await chamar('PUT', `/api/tipos-instrumentos/${ids.Caixa}`, { nome: 'Caixa de guerra' });
    assert.equal(renomeado.status, 200);
    const depois = await chamar('GET', '/api/estoque');
    assert.equal(depois.corpo.estoque.find(item => item.tipoInstrumentoId === ids.Caixa).nome, 'Caixa de guerra', 'Usa o nome atual do tipo.');
  });

  await t.test('entrada: caractere nulo e parâmetros desconhecidos retornam 400 sem gravar', async () => {
    const instrumentosAntes = (await banco.query('SELECT * FROM instrumentos ORDER BY id')).rows;
    const tiposAntes = (await banco.query('SELECT * FROM tipos_instrumentos ORDER BY id')).rows;
    const tentativas = [
      ['POST', '/api/tipos-instrumentos', { nome: 'Cuí\u0000ca' }],
      ['PUT', `/api/tipos-instrumentos/${ids.Surdo}`, { nome: 'Surdo\u0000' }],
      ['POST', '/api/instrumentos', { tipoInstrumentoId: ids.Surdo, identificacao: 'SURDO-009', observacoes: 'Pele\u0000nova' }],
      ['PUT', `/api/instrumentos/${ids['SURDO-001']}`, { tipoInstrumentoId: ids.Surdo, identificacao: 'SURDO-001', observacoes: '\u0000' }],
      ['GET', `/api/instrumentos/${ids['CAIXA-001']}?outro=1`],
      ['GET', `/api/tipos-instrumentos/${ids.Surdo}?outro=1`],
      ['POST', '/api/instrumentos?outro=1', { tipoInstrumentoId: ids.Surdo, identificacao: 'SURDO-009' }],
      ['PUT', `/api/tipos-instrumentos/${ids.Surdo}?outro=1`, { nome: 'Surdo de primeira' }],
    ];
    for (const [metodo, caminho, corpo] of tentativas) {
      const resposta = await chamar(metodo, caminho, corpo);
      assert.equal(resposta.status, 400, `${metodo} ${caminho}`);
      assert.equal(resposta.corpo.error.code, 'DADOS_INVALIDOS', `${metodo} ${caminho}`);
    }
    assert.deepEqual((await banco.query('SELECT * FROM instrumentos ORDER BY id')).rows, instrumentosAntes);
    assert.deepEqual((await banco.query('SELECT * FROM tipos_instrumentos ORDER BY id')).rows, tiposAntes);
  });

  await t.test('permissões: integrante consulta e não altera o banco', async () => {
    const antes = (await banco.query('SELECT * FROM instrumentos ORDER BY id')).rows;
    const tiposAntes = (await banco.query('SELECT * FROM tipos_instrumentos ORDER BY id')).rows;
    const tentativas = [
      ['POST', '/api/tipos-instrumentos', { nome: 'Cuíca' }],
      ['PUT', `/api/tipos-instrumentos/${ids.Surdo}`, { nome: 'Surdo de primeira' }],
      ['POST', '/api/instrumentos', { tipoInstrumentoId: ids.Surdo, identificacao: 'SURDO-002' }],
      ['PUT', `/api/instrumentos/${ids['CAIXA-001']}`, { tipoInstrumentoId: ids.Surdo, identificacao: 'CAIXA-001' }],
    ];
    for (const [metodo, caminho, corpo] of tentativas) {
      const resposta = await chamar(metodo, caminho, corpo, integrante);
      assert.equal(resposta.status, 403, `${metodo} ${caminho}`);
      assert.equal(resposta.corpo.error.code, 'ACESSO_NEGADO');
    }
    assert.deepEqual((await banco.query('SELECT * FROM instrumentos ORDER BY id')).rows, antes);
    assert.deepEqual((await banco.query('SELECT * FROM tipos_instrumentos ORDER BY id')).rows, tiposAntes);
    await banco.query("UPDATE usuarios SET perfil = 'INTEGRANTE' WHERE email = 'diretoria@bateria.example'");
    assert.equal((await chamar('POST', '/api/tipos-instrumentos', { nome: 'Cuíca' })).status, 403, 'O perfil atual do banco é respeitado.');
    assert.equal((await chamar('GET', '/api/estoque', undefined, 'bateria_sessao=' + 'z'.repeat(43))).status, 401);
  });
});
