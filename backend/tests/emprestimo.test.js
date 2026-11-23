import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { Emprestimo } from '../src/entities/Emprestimo.js';
import { ErroAplicacao } from '../src/errors/ErroAplicacao.js';
import { EmprestimoService } from '../src/services/EmprestimoService.js';

const TOKEN_DIRETORIA = 'd'.repeat(43);
const TOKEN_ANA = 'a'.repeat(43);
const TOKEN_BIA = 'b'.repeat(43);
const COOKIE_DIRETORIA = `bateria_sessao=${TOKEN_DIRETORIA}`;
const COOKIE_ANA = `bateria_sessao=${TOKEN_ANA}`;
const COOKIE_BIA = `bateria_sessao=${TOKEN_BIA}`;

function criarUsuario(id, nome, perfil) {
  return { id, nome, perfil, ehDiretoria: () => perfil === 'DIRETORIA' };
}

class EmprestimosEmMemoria {
  integrantes = new Map([
    [2, { id: 2, nome: 'Ana' }],
    [3, { id: 3, nome: 'Bia' }],
  ]);
  instrumentos = new Map([
    [10, { id: 10, identificacao: 'CAIXA-010', situacao: 'DISPONIVEL' }],
    [11, { id: 11, identificacao: 'CAIXA-011', situacao: 'DISPONIVEL' }],
    [12, { id: 12, identificacao: 'CAIXA-012', situacao: 'EM_MANUTENCAO' }],
  ]);
  registros = [];
  proximaId = 1;
  fila = Promise.resolve();

  async listar({ usuarioId = null } = {}) {
    return this.registros
      .filter(item => usuarioId === null || item.integrante.id === usuarioId)
      .sort((a, b) => b.retiradaEm - a.retiradaEm || b.id - a.id);
  }

  async criar({ integranteId, instrumentoId }) {
    return this.#serializar(async () => {
      const integrante = this.integrantes.get(integranteId);
      if (!integrante) throw new ErroAplicacao(404, 'INTEGRANTE_NAO_ENCONTRADO', 'Integrante não encontrado.');
      const instrumento = this.instrumentos.get(instrumentoId);
      if (!instrumento) throw new ErroAplicacao(404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado.');
      if (instrumento.situacao !== 'DISPONIVEL' || this.registros.some(item => item.instrumento.id === instrumentoId && item.devolucaoEm === null)) {
        throw new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'O instrumento não está disponível para empréstimo.');
      }
      const emprestimo = new Emprestimo({
        id: this.proximaId++,
        integrante,
        instrumento: { id: instrumento.id, identificacao: instrumento.identificacao },
        retiradaEm: new Date(),
      });
      this.registros.push(emprestimo);
      instrumento.situacao = 'EMPRESTADO';
      return emprestimo;
    });
  }

  async devolver(id) {
    return this.#serializar(async () => {
      const atual = this.registros.find(item => item.id === id);
      if (!atual) throw new ErroAplicacao(404, 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo não encontrado.');
      if (atual.devolucaoEm !== null) return atual;
      const instrumento = this.instrumentos.get(atual.instrumento.id);
      if (instrumento.situacao !== 'EMPRESTADO') throw new Error('Situação de estoque inconsistente.');
      const devolvido = new Emprestimo({
        id: atual.id,
        integrante: atual.integrante,
        instrumento: atual.instrumento,
        retiradaEm: atual.retiradaEm,
        devolucaoEm: new Date(),
      });
      this.registros[this.registros.indexOf(atual)] = devolvido;
      instrumento.situacao = 'DISPONIVEL';
      return devolvido;
    });
  }

  #serializar(operacao) {
    const resultado = this.fila.then(operacao, operacao);
    this.fila = resultado.catch(() => {});
    return resultado;
  }
}

async function preparar(t) {
  const usuarios = new Map([
    [TOKEN_DIRETORIA, criarUsuario(1, 'Diretoria', 'DIRETORIA')],
    [TOKEN_ANA, criarUsuario(2, 'Ana', 'INTEGRANTE')],
    [TOKEN_BIA, criarUsuario(3, 'Bia', 'INTEGRANTE')],
  ]);
  const authService = {
    autenticar: async token => {
      const usuario = usuarios.get(token);
      if (!usuario) throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema para continuar.');
      return usuario;
    },
  };
  const repositorio = new EmprestimosEmMemoria();
  const usuarioRepository = { buscarIntegrantePorId: async id => repositorio.integrantes.get(id) ?? null };
  const emprestimoService = new EmprestimoService(repositorio, usuarioRepository);
  const app = createApp({ authService, emprestimoService });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  const base = `http://127.0.0.1:${server.address().port}/api/emprestimos`;
  const chamar = async (caminho = '', { metodo = 'GET', cookie = COOKIE_DIRETORIA, corpo, headers = {} } = {}) => {
    const resposta = await fetch(base + caminho, {
      method: metodo,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: resposta.status, headers: resposta.headers, corpo: await resposta.json() };
  };
  return { chamar, repositorio };
}

const codigo = resposta => resposta.corpo?.error?.code;

test('histórico exige sessão, recusa filtros e aplica o escopo por perfil', async t => {
  const { chamar } = await preparar(t);
  assert.equal((await chamar('', { cookie: null })).status, 401);
  assert.equal(codigo(await chamar('?usuarioId=2')), 'DADOS_INVALIDOS');
  assert.deepEqual((await chamar('', { cookie: COOKIE_ANA })).corpo, { emprestimos: [] });
  assert.equal((await chamar('', { cookie: COOKIE_ANA })).headers.get('cache-control'), 'no-store');
});

test('somente diretoria retira; IDs e campos extras seguem o contrato', async t => {
  const { chamar } = await preparar(t);
  const corpo = { integranteId: 2, instrumentoId: 10 };
  assert.equal((await chamar('', { metodo: 'POST', cookie: COOKIE_ANA, corpo })).status, 403);
  assert.equal(codigo(await chamar('', { metodo: 'POST', corpo: { ...corpo, retiradaEm: '2026-01-01T00:00:00Z' } })), 'DADOS_INVALIDOS');
  assert.equal(codigo(await chamar('', { metodo: 'POST', corpo: { integranteId: '2', instrumentoId: 10 } })), 'DADOS_INVALIDOS');
  assert.equal(codigo(await chamar('', { metodo: 'POST', corpo, headers: { 'Sec-Fetch-Site': 'cross-site' } })), 'ORIGEM_INVALIDA');
  assert.equal(codigo(await chamar('', { metodo: 'POST', corpo, headers: { 'Content-Type': 'text/plain' } })), 'JSON_OBRIGATORIO');

  const criada = await chamar('', { metodo: 'POST', corpo });
  assert.equal(criada.status, 201);
  assert.deepEqual(criada.corpo.emprestimo, {
    id: 1,
    integrante: { id: 2, nome: 'Ana' },
    instrumento: { id: 10, identificacao: 'CAIXA-010' },
    retiradaEm: criada.corpo.emprestimo.retiradaEm,
    devolucaoEm: null,
    situacao: 'ATIVO',
  });
  assert.match(criada.corpo.emprestimo.retiradaEm, /^\d{4}-\d\d-\d\dT.*Z$/);
});

test('diretoria consulta tudo e integrante recebe somente seus registros', async t => {
  const { chamar } = await preparar(t);
  await chamar('', { metodo: 'POST', corpo: { integranteId: 2, instrumentoId: 10 } });
  await chamar('', { metodo: 'POST', corpo: { integranteId: 3, instrumentoId: 11 } });
  assert.equal((await chamar('', { cookie: COOKIE_DIRETORIA })).corpo.emprestimos.length, 2);
  const ana = await chamar('', { cookie: COOKIE_ANA });
  assert.equal(ana.corpo.emprestimos.length, 1);
  assert.equal(ana.corpo.emprestimos[0].integrante.id, 2);
  assert.equal((await chamar('', { cookie: COOKIE_BIA })).corpo.emprestimos[0].integrante.id, 3);
});

test('recusa integrantes e unidades inexistentes ou unidades indisponíveis', async t => {
  const { chamar } = await preparar(t);
  assert.equal(codigo(await chamar('', { metodo: 'POST', corpo: { integranteId: 99, instrumentoId: 10 } })), 'INTEGRANTE_NAO_ENCONTRADO');
  assert.equal(codigo(await chamar('', { metodo: 'POST', corpo: { integranteId: 2, instrumentoId: 99 } })), 'INSTRUMENTO_NAO_ENCONTRADO');
  assert.equal(codigo(await chamar('', { metodo: 'POST', corpo: { integranteId: 2, instrumentoId: 12 } })), 'INSTRUMENTO_INDISPONIVEL');
});

test('requisições concorrentes não emprestam duas vezes a mesma unidade', async t => {
  const { chamar } = await preparar(t);
  const respostas = await Promise.all([
    chamar('', { metodo: 'POST', corpo: { integranteId: 2, instrumentoId: 10 } }),
    chamar('', { metodo: 'POST', corpo: { integranteId: 3, instrumentoId: 10 } }),
  ]);
  assert.deepEqual(respostas.map(r => r.status).sort(), [201, 409]);
  assert.equal((await chamar('')).corpo.emprestimos.length, 1);
});

test('devolução é idempotente inclusive após novo empréstimo da unidade', async t => {
  const { chamar, repositorio } = await preparar(t);
  const primeiro = await chamar('', { metodo: 'POST', corpo: { integranteId: 2, instrumentoId: 10 } });
  const idPrimeiro = primeiro.corpo.emprestimo.id;
  const devolucao = await chamar(`/${idPrimeiro}/devolucao`, { metodo: 'PUT', corpo: {} });
  assert.equal(devolucao.status, 200);
  assert.equal(devolucao.corpo.emprestimo.situacao, 'DEVOLVIDO');
  const dataOriginal = devolucao.corpo.emprestimo.devolucaoEm;

  const segundo = await chamar('', { metodo: 'POST', corpo: { integranteId: 3, instrumentoId: 10 } });
  const repetir = await chamar(`/${idPrimeiro}/devolucao`, { metodo: 'PUT', corpo: {} });
  assert.equal(repetir.corpo.emprestimo.devolucaoEm, dataOriginal);
  assert.equal(repositorio.instrumentos.get(10).situacao, 'EMPRESTADO');
  assert.equal((await chamar('')).corpo.emprestimos.find(item => item.id === segundo.corpo.emprestimo.id).situacao, 'ATIVO');
  assert.equal((await chamar(`/${idPrimeiro}/devolucao`, { metodo: 'PUT', corpo: { motivo: 'extra' } })).status, 400);
});

test('domínio calcula situação e protege datas', () => {
  const base = {
    id: 1,
    integrante: { id: 2, nome: ' Ana ' },
    instrumento: { id: 10, identificacao: ' CAIXA-010 ' },
    retiradaEm: '2026-11-20T21:30:00.000Z',
  };
  assert.equal(new Emprestimo(base).situacao, 'ATIVO');
  assert.equal(new Emprestimo({ ...base, devolucaoEm: '2026-11-20T21:30:00.000Z' }).situacao, 'DEVOLVIDO');
  assert.throws(() => new Emprestimo({ ...base, devolucaoEm: '2026-11-20T20:30:00.000Z' }), TypeError);
});
