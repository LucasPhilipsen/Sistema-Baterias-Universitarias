import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { ErroAplicacao } from '../src/errors/ErroAplicacao.js';
import { Manutencao } from '../src/entities/Manutencao.js';
import { ManutencaoService } from '../src/services/ManutencaoService.js';

const TOKEN_DIRETORIA = 'd'.repeat(43);
const TOKEN_INTEGRANTE = 'i'.repeat(43);
const COOKIE_DIRETORIA = `bateria_sessao=${TOKEN_DIRETORIA}`;
const COOKIE_INTEGRANTE = `bateria_sessao=${TOKEN_INTEGRANTE}`;
function criarUsuario(id, perfil) {
  return { id, perfil, ehDiretoria: () => perfil === 'DIRETORIA' };
}

class ManutencoesEmMemoria {
  instrumentos = new Map([[10, { id: 10, situacao: 'DISPONIVEL' }], [11, { id: 11, situacao: 'EMPRESTADO' }]]);
  registros = [];
  emprestimosAtivos = new Set();
  sequencia = 1;
  fila = Promise.resolve();

  async listarPorInstrumento(instrumentoId) {
    if (!this.instrumentos.has(instrumentoId)) throw new ErroAplicacao(404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado.');
    return this.registros.filter(item => item.instrumentoId === instrumentoId).sort((a, b) => b.abertaEm - a.abertaEm || b.id - a.id);
  }

  async abrir(instrumentoId, motivo) {
    return this.serializar(async () => {
      const instrumento = this.instrumentos.get(instrumentoId);
      if (!instrumento) throw new ErroAplicacao(404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado.');
      if (instrumento.situacao !== 'DISPONIVEL' || this.emprestimosAtivos.has(instrumentoId)
        || this.registros.some(item => item.instrumentoId === instrumentoId && item.encerradaEm === null)) {
        throw new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'O instrumento não está disponível.');
      }
      const manutencao = new Manutencao({ id: this.sequencia++, instrumentoId, motivo, abertaEm: new Date() });
      this.registros.push(manutencao);
      instrumento.situacao = 'EM_MANUTENCAO';
      return manutencao;
    });
  }

  async encerrar(instrumentoId, manutencaoId) {
    return this.serializar(async () => {
      if (!this.instrumentos.has(instrumentoId)) throw new ErroAplicacao(404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado.');
      const atual = this.registros.find(item => item.id === manutencaoId && item.instrumentoId === instrumentoId);
      if (!atual) throw new ErroAplicacao(404, 'MANUTENCAO_NAO_ENCONTRADA', 'Manutenção não encontrada.');
      if (atual.encerradaEm !== null) return atual;
      const instrumento = this.instrumentos.get(instrumentoId);
      if (instrumento.situacao !== 'EM_MANUTENCAO' || this.emprestimosAtivos.has(instrumentoId)) {
        throw new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'O instrumento não está disponível.');
      }
      const encerrada = new Manutencao({
        id: atual.id, instrumentoId: atual.instrumentoId, motivo: atual.motivo,
        abertaEm: atual.abertaEm, encerradaEm: new Date(),
      });
      this.registros[this.registros.indexOf(atual)] = encerrada;
      instrumento.situacao = 'DISPONIVEL';
      return encerrada;
    });
  }

  serializar(operacao) {
    const resultado = this.fila.then(operacao, operacao);
    this.fila = resultado.catch(() => {});
    return resultado;
  }
}

async function preparar(t) {
  const authService = {
    autenticar: async token => {
      if (token === TOKEN_DIRETORIA) return criarUsuario(1, 'DIRETORIA');
      if (token === TOKEN_INTEGRANTE) return criarUsuario(2, 'INTEGRANTE');
      throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema.');
    },
  };
  const repositorio = new ManutencoesEmMemoria();
  const app = createApp({ authService, manutencaoService: new ManutencaoService(repositorio) });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/instrumentos`;
  const chamar = async (caminho, { metodo = 'GET', cookie = COOKIE_DIRETORIA, corpo, headers = {} } = {}) => {
    const resposta = await fetch(base + caminho, {
      method: metodo,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: resposta.status, headers: resposta.headers, corpo: await resposta.json() };
  };
  const path = (instrumentoId = 10, manutencaoId) => `/${instrumentoId}/manutencoes${manutencaoId === undefined ? '' : `/${manutencaoId}/encerramento`}`;
  return { chamar, path, repositorio };
}

test('manutenção exige diretoria, JSON da mesma origem e rejeita consultas/corpos fora do contrato', async t => {
  const { chamar, path } = await preparar(t);
  assert.equal((await chamar(path(), { cookie: null })).status, 401);
  assert.equal((await chamar(path(), { cookie: COOKIE_INTEGRANTE })).status, 403);
  assert.equal((await chamar(path() + '?foo=bar')).corpo.error.code, 'DADOS_INVALIDOS');
  assert.equal((await chamar(path(), { metodo: 'POST', corpo: { motivo: '   ' } })).corpo.error.code, 'DADOS_INVALIDOS');
  assert.equal((await chamar(path(), { metodo: 'POST', corpo: { motivo: 'x'.repeat(501) } })).corpo.error.code, 'DADOS_INVALIDOS');
  assert.equal((await chamar(path(), { metodo: 'POST', corpo: { motivo: 'reparo', extra: true } })).corpo.error.code, 'DADOS_INVALIDOS');
  assert.equal((await chamar(path(), { metodo: 'POST', corpo: { motivo: 'reparo' }, headers: { 'Content-Type': 'text/plain' } })).corpo.error.code, 'JSON_OBRIGATORIO');
  assert.equal((await chamar(path(), { metodo: 'POST', corpo: { motivo: 'reparo' }, headers: { 'Sec-Fetch-Site': 'cross-site' } })).corpo.error.code, 'ORIGEM_INVALIDA');
});

test('abertura grava histórico e muda estoque; encerramento preserva histórico e restaura disponibilidade', async t => {
  const { chamar, path, repositorio } = await preparar(t);
  const aberta = await chamar(path(), { metodo: 'POST', corpo: { motivo: '  Trocar a pele  ' } });
  assert.equal(aberta.status, 201);
  assert.deepEqual(aberta.corpo.manutencao, {
    id: 1, instrumentoId: 10, motivo: 'Trocar a pele', abertaEm: aberta.corpo.manutencao.abertaEm,
    encerradaEm: null, situacao: 'ABERTA',
  });
  assert.equal(repositorio.instrumentos.get(10).situacao, 'EM_MANUTENCAO');
  assert.equal((await chamar(path(), { cookie: COOKIE_DIRETORIA })).corpo.manutencoes.length, 1);
  const encerrada = await chamar(path(10, 1), { metodo: 'PUT', corpo: {} });
  assert.equal(encerrada.status, 200);
  assert.equal(encerrada.corpo.manutencao.situacao, 'ENCERRADA');
  assert.ok(encerrada.corpo.manutencao.encerradaEm >= aberta.corpo.manutencao.abertaEm);
  assert.equal(repositorio.instrumentos.get(10).situacao, 'DISPONIVEL');
  assert.equal((await chamar(path())).corpo.manutencoes.length, 1);
});

test('recusa unidades emprestadas, manutenção duplicada e IDs que não correspondem à unidade', async t => {
  const { chamar, path } = await preparar(t);
  assert.equal((await chamar(path(11), { metodo: 'POST', corpo: { motivo: 'Revisão' } })).corpo.error.code, 'INSTRUMENTO_INDISPONIVEL');
  const aberta = await chamar(path(), { metodo: 'POST', corpo: { motivo: 'Revisão' } });
  assert.equal((await chamar(path(), { metodo: 'POST', corpo: { motivo: 'Outra revisão' } })).corpo.error.code, 'INSTRUMENTO_INDISPONIVEL');
  assert.equal((await chamar(path(11, aberta.corpo.manutencao.id), { metodo: 'PUT', corpo: {} })).corpo.error.code, 'MANUTENCAO_NAO_ENCONTRADA');
  assert.equal((await chamar(path(999), { metodo: 'GET' })).corpo.error.code, 'INSTRUMENTO_NAO_ENCONTRADO');
});

test('repetir encerramento não muda a unidade após ela ser emprestada de novo', async t => {
  const { chamar, path, repositorio } = await preparar(t);
  const aberta = await chamar(path(), { metodo: 'POST', corpo: { motivo: 'Revisão' } });
  const encerrada = await chamar(path(10, aberta.corpo.manutencao.id), { metodo: 'PUT', corpo: {} });
  const dataOriginal = encerrada.corpo.manutencao.encerradaEm;
  repositorio.instrumentos.get(10).situacao = 'EMPRESTADO';
  repositorio.emprestimosAtivos.add(10);
  const repetida = await chamar(path(10, aberta.corpo.manutencao.id), { metodo: 'PUT', corpo: {} });
  assert.equal(repetida.corpo.manutencao.encerradaEm, dataOriginal);
  assert.equal(repositorio.instrumentos.get(10).situacao, 'EMPRESTADO');
});

test('duas aberturas concorrentes não criam manutenções duplicadas', async t => {
  const { chamar, path } = await preparar(t);
  const resultados = await Promise.all([
    chamar(path(), { metodo: 'POST', corpo: { motivo: 'Trocar cabo' } }),
    chamar(path(), { metodo: 'POST', corpo: { motivo: 'Trocar conector' } }),
  ]);
  assert.deepEqual(resultados.map(item => item.status).sort(), [201, 409]);
  assert.equal((await chamar(path())).corpo.manutencoes.length, 1);
});

test('entidade normaliza texto, converte datas a UTC e valida período', () => {
  const base = { id: 1, instrumentoId: 2, motivo: ' Revisão ', abertaEm: '2026-11-20T21:30:00Z' };
  assert.equal(new Manutencao(base).motivo, 'Revisão');
  assert.equal(new Manutencao(base).situacao, 'ABERTA');
  assert.equal(new Manutencao({ ...base, encerradaEm: '2026-11-20T21:30:00Z' }).situacao, 'ENCERRADA');
  assert.throws(() => new Manutencao({ ...base, encerradaEm: '2026-11-20T20:30:00Z' }), TypeError);
  assert.throws(() => new Manutencao({ ...base, motivo: 'x'.repeat(501) }), TypeError);
});
