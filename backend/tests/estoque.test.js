import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { Usuario } from '../src/entities/Usuario.js';
import { Instrumento } from '../src/entities/Instrumento.js';
import { TipoInstrumento } from '../src/entities/TipoInstrumento.js';
import { ErroAplicacao } from '../src/errors/ErroAplicacao.js';
import { TipoInstrumentoService } from '../src/services/TipoInstrumentoService.js';
import { InstrumentoService } from '../src/services/InstrumentoService.js';
import { EstoqueService } from '../src/services/EstoqueService.js';

// Repositórios em memória para conferir o contrato HTTP sem PostgreSQL. As regras de
// unicidade com acentos, chave estrangeira e atomicidade são verificadas em estoque.postgres.test.js.
const seed = await readFile(new URL('../../database/seeds/001-usuarios-desenvolvimento.sql', import.meta.url), 'utf8');
const hashes = [...seed.matchAll(/scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}/g)].map(([hash]) => hash);
const COOKIE_DIRETORIA = `bateria_sessao=${'d'.repeat(43)}`;
const COOKIE_INTEGRANTE = `bateria_sessao=${'i'.repeat(43)}`;

class TiposEmMemoria {
  dados = new Map();
  proximoId = 1;
  listar = async () => [...this.dados.values()].sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id);
  buscarPorId = async id => this.dados.get(id) ?? null;
  #conferirNome(nome, id = null) {
    if ([...this.dados.values()].some(t => t.id !== id && t.nome.toLowerCase() === nome.toLowerCase())) {
      throw new ErroAplicacao(409, 'TIPO_INSTRUMENTO_DUPLICADO', 'Já existe um tipo de instrumento com este nome.');
    }
  }
  criar = async tipo => {
    this.#conferirNome(tipo.nome);
    const criado = new TipoInstrumento({ id: this.proximoId++, nome: tipo.nome });
    this.dados.set(criado.id, criado);
    return criado;
  };
  atualizar = async (id, tipo) => {
    if (!this.dados.has(id)) return null;
    this.#conferirNome(tipo.nome, id);
    const atualizado = new TipoInstrumento({ id, nome: tipo.nome });
    this.dados.set(id, atualizado);
    return atualizado;
  };
}

class InstrumentosEmMemoria {
  dados = new Map();
  proximoId = 1;
  constructor(tipos) { this.tipos = tipos; }
  listar = async ({ tipoInstrumentoId, situacao }) => [...this.dados.values()]
    .filter(i => (tipoInstrumentoId === null || i.tipoInstrumentoId === tipoInstrumentoId) && (situacao === null || i.situacao === situacao))
    .sort((a, b) => a.identificacao.localeCompare(b.identificacao) || a.id - b.id);
  buscarPorId = async id => this.dados.get(id) ?? null;
  #gravar(id, instrumento, situacao) {
    if (!this.tipos.dados.has(instrumento.tipoInstrumentoId)) {
      throw new ErroAplicacao(400, 'TIPO_INSTRUMENTO_INVALIDO', 'O tipo de instrumento informado não existe.');
    }
    if ([...this.dados.values()].some(i => i.id !== id && i.identificacao === instrumento.identificacao)) {
      throw new ErroAplicacao(409, 'IDENTIFICACAO_DUPLICADA', 'Já existe um instrumento com esta identificação.');
    }
    const gravado = new Instrumento({
      id, tipoInstrumentoId: instrumento.tipoInstrumentoId, identificacao: instrumento.identificacao,
      observacoes: instrumento.observacoes, situacao,
    });
    this.dados.set(id, gravado);
    return gravado;
  }
  criar = async instrumento => this.#gravar(this.proximoId++, instrumento, 'DISPONIVEL');
  atualizar = async (id, instrumento) => {
    const atual = this.dados.get(id);
    if (!atual) return null;
    if (atual.tipoInstrumentoId !== instrumento.tipoInstrumentoId && this.tipos.dados.has(instrumento.tipoInstrumentoId) && !atual.estaDisponivel()) {
      throw new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'Só é possível trocar o tipo de uma unidade disponível.');
    }
    return this.#gravar(id, instrumento, atual.situacao);
  };
  definirSituacao(id, situacao) {
    const atual = this.dados.get(id);
    this.dados.set(id, new Instrumento({ ...atual.toJSON(), situacao }));
  }
  // Simula o driver devolvendo agregações como texto, para conferir a conversão do serviço.
  resumirPorTipo = async () => (await this.tipos.listar()).map(tipo => {
    const unidades = [...this.dados.values()].filter(i => i.tipoInstrumentoId === tipo.id);
    const contar = s => String(unidades.filter(i => i.situacao === s).length);
    return {
      tipoInstrumentoId: tipo.id, nome: tipo.nome, total: String(unidades.length),
      disponiveis: contar('DISPONIVEL'), emprestados: contar('EMPRESTADO'), emManutencao: contar('EM_MANUTENCAO'),
    };
  });
}

async function preparar(t) {
  const usuarios = {
    [COOKIE_DIRETORIA.split('=')[1]]: new Usuario({ id: 1, nome: 'Diretoria', email: 'diretoria@bateria.example', senhaHash: hashes[0], perfil: 'DIRETORIA' }),
    [COOKIE_INTEGRANTE.split('=')[1]]: new Usuario({ id: 2, nome: 'Integrante', email: 'integrante@bateria.example', senhaHash: hashes[1], perfil: 'INTEGRANTE' }),
  };
  const authService = {
    autenticar: async token => {
      if (!usuarios[token]) throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema para continuar.');
      return usuarios[token];
    },
  };
  const tipos = new TiposEmMemoria();
  const instrumentos = new InstrumentosEmMemoria(tipos);
  const app = createApp({
    authService,
    estoque: {
      tipos: new TipoInstrumentoService(tipos),
      instrumentos: new InstrumentoService(instrumentos),
      estoque: new EstoqueService(instrumentos),
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const chamar = async (metodo, caminho, { corpo, cookie = COOKIE_DIRETORIA, headers = {}, bruto } = {}) => {
    const response = await fetch(base + caminho, {
      method: metodo,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(corpo !== undefined || bruto !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: bruto ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
    });
    const texto = await response.text();
    return { status: response.status, headers: response.headers, corpo: texto ? JSON.parse(texto) : null };
  };
  return { chamar, tipos, instrumentos, base };
}

const codigo = resposta => resposta.corpo?.error?.code;

test('tipos: cadastro, consulta, edição e lista seguem o contrato', async t => {
  const { chamar } = await preparar(t);
  const criado = await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: '  Caixa  ' } });
  assert.equal(criado.status, 201);
  assert.deepEqual(criado.corpo, { tipoInstrumento: { id: 1, nome: 'Caixa' } });
  assert.equal(criado.headers.get('location'), '/api/tipos-instrumentos/1');
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Agogô' } });

  const consulta = await chamar('GET', '/api/tipos-instrumentos/1', { cookie: COOKIE_INTEGRANTE });
  assert.equal(consulta.status, 200);
  assert.deepEqual(consulta.corpo, { tipoInstrumento: { id: 1, nome: 'Caixa' } });

  const editado = await chamar('PUT', '/api/tipos-instrumentos/1', { corpo: { nome: 'Caixa de guerra' } });
  assert.equal(editado.status, 200);
  assert.deepEqual(editado.corpo, { tipoInstrumento: { id: 1, nome: 'Caixa de guerra' } });
  const mesmaGrafiaOutraCaixa = await chamar('PUT', '/api/tipos-instrumentos/1', { corpo: { nome: 'CAIXA DE GUERRA' } });
  assert.equal(mesmaGrafiaOutraCaixa.status, 200, 'O próprio tipo pode mudar a caixa do nome.');

  const lista = await chamar('GET', '/api/tipos-instrumentos', { cookie: COOKIE_INTEGRANTE });
  assert.equal(lista.status, 200);
  assert.deepEqual(lista.corpo.tiposInstrumentos.map(tipo => tipo.nome), ['Agogô', 'CAIXA DE GUERRA']);
});

test('tipos: validações, duplicidade e inexistência', async t => {
  const { chamar } = await preparar(t);
  assert.deepEqual((await chamar('GET', '/api/tipos-instrumentos')).corpo, { tiposInstrumentos: [] });
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Caixa' } });

  const invalidos = [
    {}, { nome: '' }, { nome: '   ' }, { nome: 'x'.repeat(81) }, { nome: 12 }, { nome: null },
    { nome: 'Surdo', id: 5 }, { nome: 'Surdo', extra: true }, [], ['Surdo'],
  ];
  for (const corpo of invalidos) {
    const resposta = await chamar('POST', '/api/tipos-instrumentos', { corpo });
    assert.equal(resposta.status, 400, JSON.stringify(corpo));
    assert.equal(codigo(resposta), 'DADOS_INVALIDOS');
  }
  assert.equal((await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'ô'.repeat(80) } })).status, 201, '80 caracteres acentuados são aceitos.');
  for (const bruto of ['null', '1', '"Surdo"', '{"nome":']) {
    assert.equal((await chamar('POST', '/api/tipos-instrumentos', { bruto })).status, 400, bruto);
  }

  const duplicado = await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: ' cAIXA ' } });
  assert.equal(duplicado.status, 409);
  assert.equal(codigo(duplicado), 'TIPO_INSTRUMENTO_DUPLICADO');

  for (const id of ['0', '-1', '1.5', 'abc', '2147483648', '1e3', ' 1']) {
    const resposta = await chamar('GET', `/api/tipos-instrumentos/${encodeURIComponent(id)}`);
    assert.equal(resposta.status, 400, id);
    assert.equal(codigo(resposta), 'DADOS_INVALIDOS');
  }
  for (const [metodo, corpo] of [['GET'], ['PUT', { nome: 'Surdo' }]]) {
    const resposta = await chamar(metodo, '/api/tipos-instrumentos/2147483647', { corpo });
    assert.equal(resposta.status, 404);
    assert.equal(codigo(resposta), 'TIPO_INSTRUMENTO_NAO_ENCONTRADO');
  }
  assert.equal((await chamar('PUT', '/api/tipos-instrumentos/1', { corpo: {} })).status, 400, 'PUT exige o nome.');
  assert.equal(codigo(await chamar('GET', '/api/tipos-instrumentos?nome=Caixa')), 'DADOS_INVALIDOS');
});

test('unidades: cadastro normaliza, começa disponível e não aceita situação', async t => {
  const { chamar } = await preparar(t);
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Caixa' } });
  const criado = await chamar('POST', '/api/instrumentos', {
    corpo: { tipoInstrumentoId: 1, identificacao: ' caixa-001 ', observacoes: ' Pele revisada ' },
  });
  assert.equal(criado.status, 201);
  assert.equal(criado.headers.get('location'), '/api/instrumentos/1');
  assert.deepEqual(criado.corpo, {
    instrumento: { id: 1, tipoInstrumentoId: 1, identificacao: 'CAIXA-001', situacao: 'DISPONIVEL', observacoes: 'Pele revisada' },
  });
  for (const [indice, observacoes] of [undefined, null, '', '   '].entries()) {
    const corpo = { tipoInstrumentoId: 1, identificacao: `obs_${indice}` };
    if (observacoes !== undefined) corpo.observacoes = observacoes;
    const resposta = await chamar('POST', '/api/instrumentos', { corpo });
    assert.equal(resposta.status, 201, JSON.stringify(corpo));
    assert.equal(resposta.corpo.instrumento.observacoes, null);
  }

  const comSituacao = await chamar('POST', '/api/instrumentos', {
    corpo: { tipoInstrumentoId: 1, identificacao: 'CAIXA-009', situacao: 'EMPRESTADO' },
  });
  assert.equal(comSituacao.status, 400);
  assert.equal(codigo(comSituacao), 'DADOS_INVALIDOS');
});

test('unidades: validações, tipo inexistente e identificação única em todo o estoque', async t => {
  const { chamar, instrumentos } = await preparar(t);
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Caixa' } });
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Surdo' } });
  await chamar('POST', '/api/instrumentos', { corpo: { tipoInstrumentoId: 1, identificacao: 'CAIXA-001' } });

  const base = { tipoInstrumentoId: 1, identificacao: 'CAIXA-002' };
  const invalidos = [
    { ...base, tipoInstrumentoId: '1' }, { ...base, tipoInstrumentoId: 1.5 }, { ...base, tipoInstrumentoId: 0 },
    { ...base, tipoInstrumentoId: 2147483648 }, { ...base, tipoInstrumentoId: null }, { identificacao: 'CAIXA-002' },
    { tipoInstrumentoId: 1 }, { ...base, identificacao: '' }, { ...base, identificacao: '-CAIXA' },
    { ...base, identificacao: 'CAIXA 002' }, { ...base, identificacao: 'CAIXA-Ç' }, { ...base, identificacao: 'ı' },
    { ...base, identificacao: 'A'.repeat(41) }, { ...base, identificacao: 2 }, { ...base, observacoes: 5 },
    { ...base, observacoes: 'x'.repeat(501) }, { ...base, id: 9 }, { ...base, desconhecido: 1 },
  ];
  for (const corpo of invalidos) {
    const resposta = await chamar('POST', '/api/instrumentos', { corpo });
    assert.equal(resposta.status, 400, JSON.stringify(corpo));
    assert.equal(codigo(resposta), 'DADOS_INVALIDOS', JSON.stringify(corpo));
  }
  assert.equal((await chamar('POST', '/api/instrumentos', { corpo: { ...base, identificacao: `${'A'.repeat(39)}_` } })).status, 201);

  const tipoInexistente = await chamar('POST', '/api/instrumentos', { corpo: { ...base, tipoInstrumentoId: 99 } });
  assert.equal(tipoInexistente.status, 400);
  assert.equal(codigo(tipoInexistente), 'TIPO_INSTRUMENTO_INVALIDO');

  const duplicadaOutroTipo = await chamar('POST', '/api/instrumentos', { corpo: { tipoInstrumentoId: 2, identificacao: 'caixa-001' } });
  assert.equal(duplicadaOutroTipo.status, 409);
  assert.equal(codigo(duplicadaOutroTipo), 'IDENTIFICACAO_DUPLICADA');
  assert.equal(instrumentos.dados.size, 2, 'Cadastros recusados não salvam unidades.');
});

test('unidades: edição corrige dados e só troca o tipo de unidade disponível', async t => {
  const { chamar, instrumentos } = await preparar(t);
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Caixa' } });
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Repinique' } });
  await chamar('POST', '/api/instrumentos', { corpo: { tipoInstrumentoId: 1, identificacao: 'CAIXA-001', observacoes: 'Antiga' } });
  await chamar('POST', '/api/instrumentos', { corpo: { tipoInstrumentoId: 1, identificacao: 'CAIXA-002' } });

  const editado = await chamar('PUT', '/api/instrumentos/1', { corpo: { tipoInstrumentoId: 2, identificacao: 'rep-001' } });
  assert.equal(editado.status, 200);
  assert.deepEqual(editado.corpo, {
    instrumento: { id: 1, tipoInstrumentoId: 2, identificacao: 'REP-001', situacao: 'DISPONIVEL', observacoes: null },
  });

  instrumentos.definirSituacao(2, 'EMPRESTADO');
  const trocaIndisponivel = await chamar('PUT', '/api/instrumentos/2', { corpo: { tipoInstrumentoId: 2, identificacao: 'CAIXA-002' } });
  assert.equal(trocaIndisponivel.status, 409);
  assert.equal(codigo(trocaIndisponivel), 'INSTRUMENTO_INDISPONIVEL');
  const mesmoTipo = await chamar('PUT', '/api/instrumentos/2', { corpo: { tipoInstrumentoId: 1, identificacao: 'CAIXA-002B', observacoes: 'Pele nova' } });
  assert.equal(mesmoTipo.status, 200);
  assert.equal(mesmoTipo.corpo.instrumento.situacao, 'EMPRESTADO', 'A edição preserva a situação.');

  const comSituacao = await chamar('PUT', '/api/instrumentos/2', { corpo: { tipoInstrumentoId: 1, identificacao: 'CAIXA-002B', situacao: 'DISPONIVEL' } });
  assert.equal(codigo(comSituacao), 'DADOS_INVALIDOS');
  assert.equal(codigo(await chamar('PUT', '/api/instrumentos/2', { corpo: { tipoInstrumentoId: 1, identificacao: 'REP-001' } })), 'IDENTIFICACAO_DUPLICADA');
  assert.equal(codigo(await chamar('PUT', '/api/instrumentos/2', { corpo: { tipoInstrumentoId: 77, identificacao: 'CAIXA-002B' } })), 'TIPO_INSTRUMENTO_INVALIDO');
  const inexistente = await chamar('PUT', '/api/instrumentos/50', { corpo: { tipoInstrumentoId: 1, identificacao: 'X' } });
  assert.equal(inexistente.status, 404);
  assert.equal(codigo(inexistente), 'INSTRUMENTO_NAO_ENCONTRADO');
  assert.equal(codigo(await chamar('GET', '/api/instrumentos/50')), 'INSTRUMENTO_NAO_ENCONTRADO');
  assert.equal(codigo(await chamar('GET', '/api/instrumentos/abc')), 'DADOS_INVALIDOS');
});

test('unidades: filtros por tipo e situação, combinados e inválidos', async t => {
  const { chamar, instrumentos } = await preparar(t);
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Caixa' } });
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Surdo' } });
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Tamborim' } });
  for (const [tipoInstrumentoId, identificacao] of [[1, 'CAIXA-002'], [1, 'CAIXA-001'], [2, 'SURDO-001']]) {
    await chamar('POST', '/api/instrumentos', { corpo: { tipoInstrumentoId, identificacao } });
  }
  instrumentos.definirSituacao(1, 'EM_MANUTENCAO');
  const ids = async query => (await chamar('GET', `/api/instrumentos${query}`, { cookie: COOKIE_INTEGRANTE })).corpo.instrumentos.map(i => i.identificacao);
  assert.deepEqual(await ids(''), ['CAIXA-001', 'CAIXA-002', 'SURDO-001']);
  assert.deepEqual(await ids('?tipoInstrumentoId=1'), ['CAIXA-001', 'CAIXA-002']);
  assert.deepEqual(await ids('?situacao=DISPONIVEL'), ['CAIXA-001', 'SURDO-001']);
  assert.deepEqual(await ids('?tipoInstrumentoId=1&situacao=EM_MANUTENCAO'), ['CAIXA-002']);
  assert.deepEqual(await ids('?tipoInstrumentoId=3'), [], 'Tipo sem unidades retorna lista vazia.');
  assert.deepEqual(await ids('?tipoInstrumentoId=999'), [], 'Tipo inexistente no filtro retorna lista vazia.');
  for (const query of ['?situacao=disponivel', '?situacao=', '?situacao=PERDIDO', '?tipoInstrumentoId=0', '?tipoInstrumentoId=abc',
    '?tipoInstrumentoId=1&tipoInstrumentoId=2', '?tipo=1', '?tipoInstrumentoId=-1']) {
    const resposta = await chamar('GET', `/api/instrumentos${query}`);
    assert.equal(resposta.status, 400, query);
    assert.equal(codigo(resposta), 'DADOS_INVALIDOS', query);
  }
});

test('estoque: inclui tipos sem unidades e conta como números', async t => {
  const { chamar, instrumentos } = await preparar(t);
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Repinique' } });
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Caixa' } });
  for (const identificacao of ['C1', 'C2', 'C3', 'C4']) {
    await chamar('POST', '/api/instrumentos', { corpo: { tipoInstrumentoId: 2, identificacao } });
  }
  instrumentos.definirSituacao(2, 'EMPRESTADO');
  instrumentos.definirSituacao(3, 'EM_MANUTENCAO');
  const resposta = await chamar('GET', '/api/estoque', { cookie: COOKIE_INTEGRANTE });
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.corpo, {
    estoque: [
      { tipoInstrumentoId: 2, nome: 'Caixa', total: 4, disponiveis: 2, emprestados: 1, emManutencao: 1 },
      { tipoInstrumentoId: 1, nome: 'Repinique', total: 0, disponiveis: 0, emprestados: 0, emManutencao: 0 },
    ],
  });
  assert.equal(codigo(await chamar('GET', '/api/estoque?tipoInstrumentoId=1')), 'DADOS_INVALIDOS');
});

test('permissões: consultas exigem sessão e alterações exigem diretoria, JSON e mesma origem', async t => {
  const { chamar, tipos, instrumentos, base } = await preparar(t);
  await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Caixa' } });
  await chamar('POST', '/api/instrumentos', { corpo: { tipoInstrumentoId: 1, identificacao: 'CAIXA-001' } });

  const consultas = ['/api/tipos-instrumentos', '/api/tipos-instrumentos/1', '/api/instrumentos', '/api/instrumentos/1', '/api/estoque'];
  for (const caminho of consultas) {
    for (const cookie of [null, `bateria_sessao=${'x'.repeat(43)}`]) {
      const resposta = await chamar('GET', caminho, { cookie });
      assert.equal(resposta.status, 401, caminho);
      assert.equal(codigo(resposta), 'SESSAO_INVALIDA');
    }
    assert.equal((await chamar('GET', caminho, { cookie: COOKIE_INTEGRANTE })).status, 200, caminho);
  }

  const alteracoes = [
    ['POST', '/api/tipos-instrumentos', { nome: 'Surdo' }],
    ['PUT', '/api/tipos-instrumentos/1', { nome: 'Surdo' }],
    ['POST', '/api/instrumentos', { tipoInstrumentoId: 1, identificacao: 'CAIXA-002' }],
    ['PUT', '/api/instrumentos/1', { tipoInstrumentoId: 1, identificacao: 'CAIXA-009' }],
  ];
  for (const [metodo, caminho, corpo] of alteracoes) {
    assert.equal((await chamar(metodo, caminho, { corpo, cookie: null })).status, 401, `${metodo} ${caminho}`);
    const negado = await chamar(metodo, caminho, { corpo, cookie: COOKIE_INTEGRANTE });
    assert.equal(negado.status, 403, `${metodo} ${caminho}`);
    assert.equal(codigo(negado), 'ACESSO_NEGADO');
    const semJson = await chamar(metodo, caminho, { cookie: COOKIE_DIRETORIA, headers: { 'Content-Type': 'text/plain' }, bruto: JSON.stringify(corpo) });
    assert.equal(semJson.status, 415);
    assert.equal(codigo(semJson), 'JSON_OBRIGATORIO');
    const externo = await chamar(metodo, caminho, { corpo, headers: { Origin: 'https://externo.example' } });
    assert.equal(externo.status, 403);
    assert.equal(codigo(externo), 'ORIGEM_INVALIDA');
  }
  // Integrante recebe 403 antes da verificação de existência do recurso.
  assert.equal((await chamar('PUT', '/api/instrumentos/999', { corpo: {}, cookie: COOKIE_INTEGRANTE })).status, 403);
  assert.deepEqual([...tipos.dados.values()].map(tipo => tipo.nome), ['Caixa']);
  assert.deepEqual([...instrumentos.dados.values()].map(i => i.identificacao), ['CAIXA-001']);

  const mesmaOrigem = await chamar('POST', '/api/tipos-instrumentos', { corpo: { nome: 'Surdo' }, headers: { Origin: base } });
  assert.equal(mesmaOrigem.status, 201);
});
