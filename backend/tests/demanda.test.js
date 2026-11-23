import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { Usuario } from '../src/entities/Usuario.js';
import { Ensaio } from '../src/entities/Ensaio.js';
import { ItemDemanda } from '../src/entities/ItemDemanda.js';
import { ErroAplicacao } from '../src/errors/ErroAplicacao.js';
import { DemandaRepository, SQL_DEMANDA_POR_TIPO } from '../src/repositories/DemandaRepository.js';
import { DemandaService } from '../src/services/DemandaService.js';

// Repositórios em memória para conferir a regra e o contrato HTTP da SCRUM-39 sem PostgreSQL.
// A consulta real depende da tabela de confirmações da SCRUM-37 e é verificada com banco descartável.
const COOKIE_DIRETORIA = `bateria_sessao=${'d'.repeat(43)}`;
const COOKIE_INTEGRANTE = `bateria_sessao=${'i'.repeat(43)}`;
const HASH = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
const AGORA = new Date('2026-11-20T21:30:00.000Z');

class EnsaiosEmMemoria {
  dados = new Map();
  proximoId = 1;
  adicionar(situacao = 'AGENDADO') {
    const ensaio = new Ensaio({ id: this.proximoId++, inicioEm: '2026-11-25T19:00:00-03:00', local: 'Quadra do campus', situacao });
    this.dados.set(ensaio.id, ensaio);
    return ensaio;
  }
  buscarPorId = async id => this.dados.get(id) ?? null;
}

// Reproduz a consulta: todos os tipos, confirmações ATIVA do ensaio e unidades DISPONIVEL.
// Devolve as contagens como texto, como o driver pode fazer, para conferir a conversão do serviço.
class DemandaEmMemoria {
  tipos = [];
  unidades = [];
  confirmacoes = [];
  consultas = 0;
  adicionarTipo(nome) {
    const tipo = { id: this.tipos.length + 1, nome };
    this.tipos.push(tipo);
    return tipo;
  }
  adicionarUnidades(tipo, quantidade, situacao = 'DISPONIVEL') {
    for (let i = 0; i < quantidade; i++) this.unidades.push({ tipoInstrumentoId: tipo.id, situacao });
  }
  confirmar(ensaio, usuarioId, tipo) {
    const confirmacao = { ensaioId: ensaio.id, usuarioId, tipoInstrumentoId: tipo.id, situacao: 'ATIVA' };
    this.confirmacoes.push(confirmacao);
    return confirmacao;
  }
  contarPorTipo = async ensaioId => {
    this.consultas++;
    return [...this.tipos]
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id)
      .map(tipo => ({
        tipoInstrumentoId: tipo.id,
        nome: tipo.nome,
        confirmados: String(this.confirmacoes.filter(c => c.ensaioId === ensaioId && c.situacao === 'ATIVA' && c.tipoInstrumentoId === tipo.id).length),
        disponiveis: String(this.unidades.filter(u => u.tipoInstrumentoId === tipo.id && u.situacao === 'DISPONIVEL').length),
      }));
  };
}

async function preparar(t) {
  const usuarios = {
    [COOKIE_DIRETORIA.split('=')[1]]: new Usuario({ id: 1, nome: 'Diretoria', email: 'diretoria@bateria.example', senhaHash: HASH, perfil: 'DIRETORIA' }),
    [COOKIE_INTEGRANTE.split('=')[1]]: new Usuario({ id: 2, nome: 'Integrante', email: 'integrante@bateria.example', senhaHash: HASH, perfil: 'INTEGRANTE' }),
  };
  const authService = {
    autenticar: async token => {
      if (!usuarios[token]) throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema para continuar.');
      return usuarios[token];
    },
  };
  const ensaios = new EnsaiosEmMemoria();
  const demanda = new DemandaEmMemoria();
  const app = createApp({
    authService,
    demandaService: new DemandaService({ ensaios, demanda, agora: () => AGORA }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const consultar = async (caminho, { cookie = COOKIE_DIRETORIA, metodo = 'GET' } = {}) => {
    const response = await fetch(base + caminho, { method: metodo, headers: cookie ? { Cookie: cookie } : {} });
    // O 404 padrão do Express, para métodos sem rota, responde HTML.
    const json = response.headers.get('content-type')?.includes('application/json');
    return { status: response.status, corpo: json ? await response.json() : null };
  };
  return { consultar, ensaios, demanda };
}

const codigo = resposta => resposta.corpo?.error?.code;
const linha = (resposta, nome) => resposta.corpo.demanda.tipos.find(tipo => tipo.nome === nome);

test('ItemDemanda calcula falta = max(0, confirmados - disponiveis)', () => {
  const item = (confirmados, disponiveis) => new ItemDemanda({ tipoInstrumentoId: 1, nome: 'Caixa', confirmados, disponiveis });
  assert.equal(item(5, 3).falta, 2);
  assert.equal(item(3, 5).falta, 0);
  assert.equal(item(4, 4).falta, 0);
  assert.equal(item(2, 0).falta, 2);
  assert.equal(item(0, 0).falta, 0);
  assert.deepEqual(item(5, 3).toJSON(), { tipoInstrumentoId: 1, nome: 'Caixa', confirmados: 5, disponiveis: 3, falta: 2 });
});

test('ItemDemanda recusa quantidades e vínculos inválidos', () => {
  const base = { tipoInstrumentoId: 1, nome: 'Caixa', confirmados: 0, disponiveis: 0 };
  for (const invalido of [
    { confirmados: -1 }, { disponiveis: -1 }, { confirmados: 1.5 }, { disponiveis: '3' }, { confirmados: NaN },
    { tipoInstrumentoId: 0 }, { tipoInstrumentoId: 2147483648 }, { nome: '' }, { nome: null },
  ]) {
    assert.throws(() => new ItemDemanda({ ...base, ...invalido }), TypeError, JSON.stringify(invalido));
  }
});

test('cinco confirmações e três unidades disponíveis indicam falta de duas', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();
  const caixa = demanda.adicionarTipo('Caixa');
  demanda.adicionarUnidades(caixa, 3);
  for (let usuarioId = 10; usuarioId < 15; usuarioId++) demanda.confirmar(ensaio, usuarioId, caixa);

  const resposta = await consultar(`/api/ensaios/${ensaio.id}/demanda`);
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.corpo, {
    demanda: {
      ensaioId: ensaio.id,
      calculadoEm: '2026-11-20T21:30:00.000Z',
      tipos: [{ tipoInstrumentoId: caixa.id, nome: 'Caixa', confirmados: 5, disponiveis: 3, falta: 2 }],
    },
  });
});

test('inclui todos os tipos, com zero, ordenados por nome e com números inteiros', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();
  const surdo = demanda.adicionarTipo('Surdo');
  const caixa = demanda.adicionarTipo('Caixa');
  const repinique = demanda.adicionarTipo('Repinique');
  demanda.adicionarUnidades(repinique, 2);
  demanda.confirmar(ensaio, 10, surdo);
  demanda.confirmar(ensaio, 11, surdo);

  const { corpo } = await consultar(`/api/ensaios/${ensaio.id}/demanda`);
  assert.deepEqual(corpo.demanda.tipos, [
    { tipoInstrumentoId: caixa.id, nome: 'Caixa', confirmados: 0, disponiveis: 0, falta: 0 },
    { tipoInstrumentoId: repinique.id, nome: 'Repinique', confirmados: 0, disponiveis: 2, falta: 0 },
    { tipoInstrumentoId: surdo.id, nome: 'Surdo', confirmados: 2, disponiveis: 0, falta: 2 },
  ]);
  for (const tipo of corpo.demanda.tipos) {
    for (const campo of ['confirmados', 'disponiveis', 'falta']) assert.equal(typeof tipo[campo], 'number');
  }
});

test('sem tipos cadastrados, a lista vem vazia', async t => {
  const { consultar, ensaios } = await preparar(t);
  const ensaio = ensaios.adicionar();
  const resposta = await consultar(`/api/ensaios/${ensaio.id}/demanda`);
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.corpo.demanda.tipos, []);
});

test('disponibilidade exclui unidades emprestadas e em manutenção', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();
  const caixa = demanda.adicionarTipo('Caixa');
  demanda.adicionarUnidades(caixa, 2);
  demanda.adicionarUnidades(caixa, 1, 'EMPRESTADO');
  demanda.adicionarUnidades(caixa, 1, 'EM_MANUTENCAO');
  for (let usuarioId = 10; usuarioId < 14; usuarioId++) demanda.confirmar(ensaio, usuarioId, caixa);

  const resposta = await consultar(`/api/ensaios/${ensaio.id}/demanda`);
  assert.deepEqual(linha(resposta, 'Caixa'), { tipoInstrumentoId: caixa.id, nome: 'Caixa', confirmados: 4, disponiveis: 2, falta: 2 });
});

test('cancelamento, troca de tipo e movimentações aparecem na próxima consulta', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();
  const caixa = demanda.adicionarTipo('Caixa');
  const surdo = demanda.adicionarTipo('Surdo');
  demanda.adicionarUnidades(caixa, 1);
  const primeira = demanda.confirmar(ensaio, 10, caixa);
  const segunda = demanda.confirmar(ensaio, 11, caixa);
  const caminho = `/api/ensaios/${ensaio.id}/demanda`;

  assert.equal(linha(await consultar(caminho), 'Caixa').falta, 1);

  primeira.situacao = 'CANCELADA';
  assert.deepEqual(linha(await consultar(caminho), 'Caixa'), { tipoInstrumentoId: caixa.id, nome: 'Caixa', confirmados: 1, disponiveis: 1, falta: 0 });

  segunda.tipoInstrumentoId = surdo.id;
  let resposta = await consultar(caminho);
  assert.equal(linha(resposta, 'Caixa').confirmados, 0);
  assert.equal(linha(resposta, 'Surdo').confirmados, 1);
  assert.equal(linha(resposta, 'Surdo').falta, 1);

  // Retirada e devolução alteram a situação da unidade; a próxima consulta reflete as duas.
  const unidade = demanda.unidades.find(u => u.tipoInstrumentoId === caixa.id);
  unidade.situacao = 'EMPRESTADO';
  assert.equal(linha(await consultar(caminho), 'Caixa').disponiveis, 0);
  unidade.situacao = 'DISPONIVEL';
  resposta = await consultar(caminho);
  assert.equal(linha(resposta, 'Caixa').disponiveis, 1);
});

test('confirmações de outro ensaio não entram na contagem', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();
  const outro = ensaios.adicionar();
  const caixa = demanda.adicionarTipo('Caixa');
  demanda.confirmar(ensaio, 10, caixa);
  demanda.confirmar(outro, 11, caixa);
  demanda.confirmar(outro, 12, caixa);

  assert.equal(linha(await consultar(`/api/ensaios/${ensaio.id}/demanda`), 'Caixa').confirmados, 1);
  assert.equal(linha(await consultar(`/api/ensaios/${outro.id}/demanda`), 'Caixa').confirmados, 2);
});

test('consultar a demanda não altera estoque nem confirmações', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();
  const caixa = demanda.adicionarTipo('Caixa');
  demanda.adicionarUnidades(caixa, 1);
  demanda.confirmar(ensaio, 10, caixa);
  demanda.confirmar(ensaio, 11, caixa);
  const antes = JSON.stringify({ unidades: demanda.unidades, confirmacoes: demanda.confirmacoes });

  await consultar(`/api/ensaios/${ensaio.id}/demanda`);
  assert.equal(JSON.stringify({ unidades: demanda.unidades, confirmacoes: demanda.confirmacoes }), antes);
});

test('somente a diretoria consulta; sessão é exigida antes da validação do ID', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();

  let resposta = await consultar(`/api/ensaios/${ensaio.id}/demanda`, { cookie: COOKIE_INTEGRANTE });
  assert.equal(resposta.status, 403);
  assert.equal(codigo(resposta), 'ACESSO_NEGADO');

  resposta = await consultar(`/api/ensaios/${ensaio.id}/demanda`, { cookie: null });
  assert.equal(resposta.status, 401);
  assert.equal(codigo(resposta), 'SESSAO_INVALIDA');

  resposta = await consultar('/api/ensaios/abc/demanda', { cookie: null });
  assert.equal(resposta.status, 401);

  resposta = await consultar('/api/ensaios/abc/demanda', { cookie: COOKIE_INTEGRANTE });
  assert.equal(resposta.status, 403);
  assert.equal(demanda.consultas, 0);
});

test('ID inválido ou parâmetros de consulta respondem 400', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const ensaio = ensaios.adicionar();
  for (const caminho of [
    '/api/ensaios/abc/demanda', '/api/ensaios/0/demanda', '/api/ensaios/-1/demanda', '/api/ensaios/1.5/demanda',
    '/api/ensaios/2147483648/demanda', '/api/ensaios/99999999999/demanda',
    `/api/ensaios/${ensaio.id}/demanda?tipoInstrumentoId=1`, `/api/ensaios/${ensaio.id}/demanda?x=`,
  ]) {
    const resposta = await consultar(caminho);
    assert.equal(resposta.status, 400, caminho);
    assert.equal(codigo(resposta), 'DADOS_INVALIDOS', caminho);
  }
  assert.equal(demanda.consultas, 0);
});

test('ensaio inexistente responde 404 e ensaio cancelado responde 409', async t => {
  const { consultar, ensaios, demanda } = await preparar(t);
  const cancelado = ensaios.adicionar('CANCELADO');

  let resposta = await consultar('/api/ensaios/999/demanda');
  assert.equal(resposta.status, 404);
  assert.equal(codigo(resposta), 'ENSAIO_NAO_ENCONTRADO');

  resposta = await consultar(`/api/ensaios/${cancelado.id}/demanda`);
  assert.equal(resposta.status, 409);
  assert.equal(codigo(resposta), 'ENSAIO_CANCELADO');
  assert.equal(demanda.consultas, 0);
});

test('a rota é somente de leitura', async t => {
  const { consultar, ensaios } = await preparar(t);
  const ensaio = ensaios.adicionar();
  for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const resposta = await consultar(`/api/ensaios/${ensaio.id}/demanda`, { metodo });
    assert.equal(resposta.status, 404, metodo);
  }
});

test('DemandaRepository usa SQL parametrizado e devolve as linhas da consulta', async () => {
  const chamadas = [];
  const banco = { query: async (sql, parametros) => { chamadas.push({ sql, parametros }); return { rows: [{ tipoInstrumentoId: 1 }] }; } };
  const linhas = await new DemandaRepository(banco).contarPorTipo(7);

  assert.deepEqual(linhas, [{ tipoInstrumentoId: 1 }]);
  assert.deepEqual(chamadas, [{ sql: SQL_DEMANDA_POR_TIPO, parametros: [7] }]);
  assert.match(SQL_DEMANDA_POR_TIPO, /ensaio_id = \$1/);
  assert.match(SQL_DEMANDA_POR_TIPO, /situacao = 'ATIVA'/);
  assert.match(SQL_DEMANDA_POR_TIPO, /i\.situacao = 'DISPONIVEL'/);
  assert.match(SQL_DEMANDA_POR_TIPO, /FROM tipos_instrumentos t\s+LEFT JOIN instrumentos/);
});
