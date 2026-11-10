import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { Ensaio, SituacaoEnsaio } from '../src/entities/Ensaio.js';
import { Usuario } from '../src/entities/Usuario.js';
import { EnsaioService } from '../src/services/EnsaioService.js';
import { AuthService } from '../src/services/AuthService.js';

const hashDemo = 'scrypt$131072$8$1$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

class EnsaioRepositoryEmMemoria {
  constructor(ensaiosIniciais = []) {
    this.itens = new Map();
    this.proximoId = 1;
    for (const e of ensaiosIniciais) {
      const id = e.id ?? this.proximoId++;
      this.itens.set(id, new Ensaio({
        id,
        inicioEm: e.inicioEmDate ?? e.inicioEm,
        local: e.local,
        descricao: e.descricao,
        situacao: e.situacao,
      }));
    }
  }

  async listar({ situacao } = {}) {
    let lista = [...this.itens.values()];
    if (situacao) {
      lista = lista.filter(e => e.situacao === situacao);
    }
    return lista.sort((a, b) => {
      const diff = a.inicioEmDate.getTime() - b.inicioEmDate.getTime();
      if (diff !== 0) return diff;
      return a.id - b.id;
    });
  }

  async buscarPorId(id) {
    return this.itens.get(id) ?? null;
  }

  async criar({ inicioEm, local, descricao }) {
    const id = this.proximoId++;
    const ensaio = new Ensaio({ id, inicioEm, local, descricao, situacao: SituacaoEnsaio.AGENDADO });
    this.itens.set(id, ensaio);
    return ensaio;
  }

  async atualizar(id, { inicioEm, local, descricao }) {
    const existente = this.itens.get(id);
    if (!existente) return { encontrado: false };
    if (existente.estaCancelado()) return { encontrado: true, cancelado: true };
    const atualizado = new Ensaio({
      id,
      inicioEm,
      local,
      descricao,
      situacao: existente.situacao,
    });
    this.itens.set(id, atualizado);
    return { encontrado: true, cancelado: false, ensaio: atualizado };
  }

  async cancelar(id) {
    const existente = this.itens.get(id);
    if (!existente) return null;
    const cancelado = new Ensaio({
      id: existente.id,
      inicioEm: existente.inicioEmDate,
      local: existente.local,
      descricao: existente.descricao,
      situacao: SituacaoEnsaio.CANCELADO,
    });
    this.itens.set(id, cancelado);
    return cancelado;
  }
}

async function prepararAmbiente(t, { ensaiosIniciais = [] } = {}) {
  const usuarios = new Map([
    [1, new Usuario({ id: 1, nome: 'Diretoria', email: 'diretoria@bateria.example', senhaHash: hashDemo, perfil: 'DIRETORIA' })],
    [2, new Usuario({ id: 2, nome: 'Integrante', email: 'integrante@bateria.example', senhaHash: hashDemo, perfil: 'INTEGRANTE' })],
  ]);
  const sessoes = new Map();
  const authService = new AuthService({
    usuarios: { buscarPorEmail: async email => [...usuarios.values()].find(u => u.email === email) ?? null },
    sessoes: {
      criar: async reg => { sessoes.delete(reg.tokenAnteriorHash); sessoes.set(reg.tokenHash, reg); },
      buscarUsuarioPorHash: async hash => {
        const reg = sessoes.get(hash);
        return reg && reg.expiraEm > new Date() ? usuarios.get(reg.usuarioId) : null;
      },
      removerPorHash: async hash => sessoes.delete(hash),
    },
    senhas: { verificar: async () => true },
  });

  const ensaioRepo = new EnsaioRepositoryEmMemoria(ensaiosIniciais);
  const ensaioService = new EnsaioService({ ensaios: ensaioRepo });

  const app = createApp({ authService, ensaioService });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const solicitar = (caminho, opcoes = {}) => fetch(base + caminho, opcoes);

  const obterCookie = async email => {
    const resp = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha: 'qualquer-senha' }),
    });
    assert.equal(resp.status, 200);
    return resp.headers.get('set-cookie').split(';')[0];
  };

  const cookieDiretoria = await obterCookie('diretoria@bateria.example');
  const cookieIntegrante = await obterCookie('integrante@bateria.example');

  return { base, solicitar, cookieDiretoria, cookieIntegrante, ensaioRepo, ensaioService };
}

// ==================== TESTES DE UNIDADE: ENTIDADE ENSAIO ====================

test('Ensaio: instanciação válida e conversão para UTC', () => {
  const ensaio = new Ensaio({
    id: 1,
    inicioEm: '2026-11-10T19:00:00-03:00',
    local: 'Quadra do campus',
    descricao: '  Ensaio geral de teste  ',
    situacao: SituacaoEnsaio.AGENDADO,
  });

  assert.equal(ensaio.id, 1);
  assert.equal(ensaio.inicioEm, '2026-11-10T22:00:00.000Z');
  assert.equal(ensaio.local, 'Quadra do campus');
  assert.equal(ensaio.descricao, 'Ensaio geral de teste');
  assert.equal(ensaio.situacao, 'AGENDADO');
  assert.equal(ensaio.estaCancelado(), false);

  const json = ensaio.toJSON();
  assert.deepEqual(json, {
    id: 1,
    inicioEm: '2026-11-10T22:00:00.000Z',
    local: 'Quadra do campus',
    descricao: 'Ensaio geral de teste',
    situacao: 'AGENDADO',
  });
});

test('Ensaio: descrição vazia ou somente espaços vira null', () => {
  for (const desc of ['', '   ', null, undefined]) {
    const ensaio = new Ensaio({
      inicioEm: '2026-11-10T22:00:00Z',
      local: 'Quadra',
      descricao: desc,
    });
    assert.equal(ensaio.descricao, null);
  }
});

test('Ensaio: recusa identificadores inválidos', () => {
  for (const id of [0, -1, 1.5, 2147483648, '1', NaN]) {
    assert.throws(
      () => new Ensaio({ id, inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra' }),
      TypeError,
    );
  }
});

test('Ensaio: recusa local inválido ou contendo caractere nulo \\u0000', () => {
  for (const local of ['', '   ', 'a'.repeat(161), null, undefined, 123, 'Quadra\u0000Central']) {
    assert.throws(
      () => new Ensaio({ inicioEm: '2026-11-10T22:00:00Z', local }),
      TypeError,
    );
  }
});

test('Ensaio: recusa descrição com mais de 1000 caracteres, tipo não texto ou contendo \\u0000', () => {
  assert.throws(
    () => new Ensaio({ inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', descricao: 'a'.repeat(1001) }),
    TypeError,
  );
  assert.throws(
    () => new Ensaio({ inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', descricao: 123 }),
    TypeError,
  );
  assert.throws(
    () => new Ensaio({ inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', descricao: 'Descricao com \u0000 nulo' }),
    TypeError,
  );
});

test('Ensaio: recusa datas sem fuso horário, fora do intervalo de anos ou inexistentes no calendário', () => {
  const invalidos = [
    '2026-11-10T19:00:00', // sem fuso
    '0000-01-01T00:00:00Z', // ano 0000 não suportado
    '0001-01-01T00:00:00Z', // ano < 1970
    '1969-12-31T23:59:59Z', // ano < 1970
    '2026-02-30T19:00:00-03:00', // 30 de fevereiro
    '2026-02-29T19:00:00-03:00', // 2026 não é bissexto
    '2026-04-31T19:00:00-03:00', // 31 de abril
    '2026-11-10T24:00:00Z', // hora 24
    '2026-11-10T19:60:00Z', // minuto 60
    '2026-11-10T19:00:00+15:00', // deslocamento fora do limite
    '10/11/2026 19:00:00',
    'invalido',
    // Regressão Bug 1: local dentro do intervalo, mas UTC fora
    '1970-01-01T00:00:00+03:00', // UTC = 1969-12-31T21:00:00Z → abaixo de 1970
    '9999-12-31T23:59:59-03:00', // UTC = 10000-01-01T02:59:59Z → acima de 9999
  ];

  for (const inicioEm of invalidos) {
    assert.throws(
      () => new Ensaio({ inicioEm, local: 'Quadra' }),
      TypeError,
      `Deveria recusar inicioEm: ${inicioEm}`,
    );
  }
});

test('Ensaio: recusa situação diferente de AGENDADO e CANCELADO', () => {
  for (const situacao of ['FINALIZADO', 'PENDENTE', 'agendado', 1]) {
    assert.throws(
      () => new Ensaio({ inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', situacao }),
      TypeError,
    );
  }
});

// Regressão Bug 1: validação do ano UTC após conversão com fuso
test('Ensaio e EnsaioService: recusa instantes cujo ano UTC saia do intervalo 1970-9999', async () => {
  // --- Entidade: rejeita via string ---
  // 1970-01-01T00:00:00+03:00 → UTC = 1969-12-31T21:00:00Z → ano UTC 1969
  assert.throws(
    () => new Ensaio({ inicioEm: '1970-01-01T00:00:00+03:00', local: 'Quadra' }),
    TypeError,
    'Deveria rejeitar: UTC resultante é 1969',
  );
  // 9999-12-31T23:59:59-03:00 → UTC = 10000-01-01T02:59:59Z → ano UTC 10000
  assert.throws(
    () => new Ensaio({ inicioEm: '9999-12-31T23:59:59-03:00', local: 'Quadra' }),
    TypeError,
    'Deveria rejeitar: UTC resultante é 10000',
  );

  // --- Entidade: aceita limites exatos em UTC ---
  const limiteInf = new Ensaio({ inicioEm: '1970-01-01T00:00:00Z', local: 'Quadra' });
  assert.equal(limiteInf.inicioEm, '1970-01-01T00:00:00.000Z');
  const limiteSup = new Ensaio({ inicioEm: '9999-12-31T23:59:59Z', local: 'Quadra' });
  assert.equal(limiteSup.inicioEm, '9999-12-31T23:59:59.000Z');
  // Entrada +00:01 cujo UTC ainda é 9999 deve ser aceita
  const limiteSupFusoPositivo = new Ensaio({ inicioEm: '9999-12-31T23:59:59+00:01', local: 'Quadra' });
  assert.ok(limiteSupFusoPositivo.inicioEm.startsWith('9999-12-31'));

  // --- Serviço: valida_EConverterInicioEm (ErroAplicacao 400) ---
  const { validarEConverterInicioEm } = await import('../src/services/EnsaioService.js');
  const { ErroAplicacao } = await import('../src/errors/ErroAplicacao.js');

  assert.throws(
    () => validarEConverterInicioEm('1970-01-01T00:00:00+03:00'),
    (err) => err instanceof ErroAplicacao && err.status === 400 && err.code === 'DADOS_INVALIDOS',
    'Serviço deve rejeitar com 400 DADOS_INVALIDOS (UTC = 1969)',
  );
  assert.throws(
    () => validarEConverterInicioEm('9999-12-31T23:59:59-03:00'),
    (err) => err instanceof ErroAplicacao && err.status === 400 && err.code === 'DADOS_INVALIDOS',
    'Serviço deve rejeitar com 400 DADOS_INVALIDOS (UTC = 10000)',
  );
});

// Regressão Bug 2: EnsaioRepository ramo sem connect() deve usar this.banco.query
test('EnsaioRepository (ramo sem connect): atualizar retorna cancelado quando situação for CANCELADO', async () => {
  // O EnsaioRepositoryEmMemoria (definido no topo deste arquivo) não possui connect(),
  // exercitando o ramo else de EnsaioRepository. Usamos EnsaioRepositoryEmMemoria diretamente.
  const repo = new EnsaioRepositoryEmMemoria([
    { id: 1, inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', situacao: 'CANCELADO' },
  ]);
  const resultado = await repo.atualizar(1, {
    inicioEm: new Date('2026-11-10T22:00:00Z'),
    local: 'Nova Quadra',
    descricao: null,
  });
  assert.equal(resultado.encontrado, true);
  assert.equal(resultado.cancelado, true);

  // Atualização em ensaio agendado deve retornar o ensaio atualizado
  const repo2 = new EnsaioRepositoryEmMemoria([
    { id: 1, inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', situacao: 'AGENDADO' },
  ]);
  const resultado2 = await repo2.atualizar(1, {
    inicioEm: new Date('2026-12-01T18:00:00Z'),
    local: 'Galpão',
    descricao: 'Novo desc',
  });
  assert.equal(resultado2.encontrado, true);
  assert.equal(resultado2.cancelado, false);
  assert.equal(resultado2.ensaio.local, 'Galpão');

  // ID inexistente retorna encontrado: false
  const resultadoNaoEncontrado = await repo2.atualizar(999, {
    inicioEm: new Date('2026-12-01T18:00:00Z'),
    local: 'Galpão',
    descricao: null,
  });
  assert.equal(resultadoNaoEncontrado.encontrado, false);
});

// ==================== TESTES DE API: AUTENTICAÇÃO E PERMISSÕES ====================

test('API Ensaios: exige autenticação para todas as operações', async t => {
  const c = await prepararAmbiente(t);

  assert.equal((await c.solicitar('/api/ensaios')).status, 401);
  assert.equal((await c.solicitar('/api/ensaios/1')).status, 401);
  assert.equal((await c.solicitar('/api/ensaios', { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await c.solicitar('/api/ensaios/1', { method: 'PUT', body: '{}' })).status, 401);
  assert.equal((await c.solicitar('/api/ensaios/1/cancelamento', { method: 'PATCH', body: '{}' })).status, 401);
});

test('API Ensaios: integrante consulta, mas recebe 403 em operações de alteração', async t => {
  const c = await prepararAmbiente(t, {
    ensaiosIniciais: [{ id: 1, inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', situacao: 'AGENDADO' }],
  });
  const headers = { Cookie: c.cookieIntegrante, 'Content-Type': 'application/json' };

  // Consultas permitidas
  const lista = await c.solicitar('/api/ensaios', { headers: { Cookie: c.cookieIntegrante } });
  assert.equal(lista.status, 200);

  const consulta = await c.solicitar('/api/ensaios/1', { headers: { Cookie: c.cookieIntegrante } });
  assert.equal(consulta.status, 200);

  // Alterações proibidas
  const post = await c.solicitar('/api/ensaios', {
    method: 'POST', headers, body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(post.status, 403);
  assert.equal((await post.json()).error.code, 'ACESSO_NEGADO');

  const put = await c.solicitar('/api/ensaios/1', {
    method: 'PUT', headers, body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra Nova' }),
  });
  assert.equal(put.status, 403);
  assert.equal((await put.json()).error.code, 'ACESSO_NEGADO');

  const patch = await c.solicitar('/api/ensaios/1/cancelamento', {
    method: 'PATCH', headers, body: '{}',
  });
  assert.equal(patch.status, 403);
  assert.equal((await patch.json()).error.code, 'ACESSO_NEGADO');
});

test('API Ensaios: exige Content-Type application/json e valida origem nas alterações', async t => {
  const c = await prepararAmbiente(t);

  // Sem Content-Type
  const semJson = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers: { Cookie: c.cookieDiretoria },
    body: 'inicioEm=2026-11-10T19:00:00-03:00',
  });
  assert.equal(semJson.status, 415);
  assert.equal((await semJson.error?.code ?? (await semJson.json()).error.code), 'JSON_OBRIGATORIO');

  // Origem inválida / cross-origin
  const crossOrigin = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers: { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json', Origin: 'https://site-malicioso.com' },
    body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await crossOrigin.json()).error.code, 'ORIGEM_INVALIDA');
});

// ==================== TESTES DE API: VALIDAÇÃO DE ENTRADA E ERROS ====================

test('API Ensaios: recusa corpos que não sejam objetos JSON válidos', async t => {
  const c = await prepararAmbiente(t);
  const headers = { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json' };

  for (const body of ['[]', '[1, 2]', '{"inicioEm": "2026-11-10T19:00:00-03:00"}']) {
    const post = await c.solicitar('/api/ensaios', { method: 'POST', headers, body });
    assert.equal(post.status, 400);
    assert.equal((await post.json()).error.code, 'DADOS_INVALIDOS');
  }

  // JSON malformado
  const malformado = await c.solicitar('/api/ensaios', { method: 'POST', headers, body: '{"inicioEm":' });
  assert.equal(malformado.status, 400);
  assert.equal((await malformado.json()).error.code, 'JSON_INVALIDO');
});

test('API Ensaios: recusa campos desconhecidos ou de controle no corpo', async t => {
  const c = await prepararAmbiente(t);
  const headers = { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json' };

  // Campos de controle como id e situacao
  const comId = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: 10, inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(comId.status, 400);
  assert.equal((await comId.json()).error.code, 'DADOS_INVALIDOS');

  const comSituacao = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ situacao: 'CANCELADO', inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(comSituacao.status, 400);
  assert.equal((await comSituacao.json()).error.code, 'DADOS_INVALIDOS');

  const campoDesconhecido = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ outro: 'valor', inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(campoDesconhecido.status, 400);
  assert.equal((await campoDesconhecido.json()).error.code, 'DADOS_INVALIDOS');
});

test('API Ensaios: recusa local ou descrição contendo \\u0000 e ano fora do intervalo suportado', async t => {
  const c = await prepararAmbiente(t);
  const headers = { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json' };

  // Local com \u0000
  const localNulo = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra\u0000Teste' }),
  });
  assert.equal(localNulo.status, 400);
  assert.equal((await localNulo.json()).error.code, 'DADOS_INVALIDOS');

  // Descrição com \u0000
  const descNulo = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra', descricao: 'Desc\u0000Nula' }),
  });
  assert.equal(descNulo.status, 400);
  assert.equal((await descNulo.json()).error.code, 'DADOS_INVALIDOS');

  // Ano 0000
  const anoZero = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '0000-01-01T00:00:00Z', local: 'Quadra' }),
  });
  assert.equal(anoZero.status, 400);
  assert.equal((await anoZero.json()).error.code, 'DADOS_INVALIDOS');

  // Ano anterior a 1970
  const anoAntigo = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '1900-01-01T00:00:00Z', local: 'Quadra' }),
  });
  assert.equal(anoAntigo.status, 400);
  assert.equal((await anoAntigo.json()).error.code, 'DADOS_INVALIDOS');

  // Regressão Bug 1: local dentro do intervalo, mas UTC fora — API deve retornar 400
  const limiteInferiorFuso = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '1970-01-01T00:00:00+03:00', local: 'Quadra' }),
  });
  assert.equal(limiteInferiorFuso.status, 400);
  assert.equal((await limiteInferiorFuso.json()).error.code, 'DADOS_INVALIDOS');

  const limiteSupFuso = await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '9999-12-31T23:59:59-03:00', local: 'Quadra' }),
  });
  assert.equal(limiteSupFuso.status, 400);
  assert.equal((await limiteSupFuso.json()).error.code, 'DADOS_INVALIDOS');
});

test('API Ensaios: recusa parâmetros de URL inválidos e retorna 404 para ensaio inexistente', async t => {
  const c = await prepararAmbiente(t);
  const headers = { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json' };

  for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
    const resGet = await c.solicitar(`/api/ensaios/${id}`, { headers: { Cookie: c.cookieDiretoria } });
    assert.equal(resGet.status, 400);
    assert.equal((await resGet.json()).error.code, 'DADOS_INVALIDOS');

    const resPut = await c.solicitar(`/api/ensaios/${id}`, {
      method: 'PUT', headers, body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
    });
    assert.equal(resPut.status, 400);

    const resPatch = await c.solicitar(`/api/ensaios/${id}/cancelamento`, {
      method: 'PATCH', headers, body: '{}',
    });
    assert.equal(resPatch.status, 400);
  }

  // ID sintaticamente válido mas inexistente
  const naoExisteGet = await c.solicitar('/api/ensaios/99999', { headers: { Cookie: c.cookieDiretoria } });
  assert.equal(naoExisteGet.status, 404);
  assert.equal((await naoExisteGet.json()).error.code, 'ENSAIO_NAO_ENCONTRADO');

  const naoExistePut = await c.solicitar('/api/ensaios/99999', {
    method: 'PUT', headers, body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(naoExistePut.status, 404);
  assert.equal((await naoExistePut.json()).error.code, 'ENSAIO_NAO_ENCONTRADO');

  const naoExistePatch = await c.solicitar('/api/ensaios/99999/cancelamento', {
    method: 'PATCH', headers, body: '{}',
  });
  assert.equal(naoExistePatch.status, 404);
  assert.equal((await naoExistePatch.json()).error.code, 'ENSAIO_NAO_ENCONTRADO');
});

test('API Ensaios: recusa parâmetros de consulta em rotas que não aceitam e filtros inválidos na listagem', async t => {
  const c = await prepararAmbiente(t, {
    ensaiosIniciais: [{ id: 1, inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', situacao: 'AGENDADO' }],
  });
  const headers = { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json' };

  // Listagem com filtro desconhecido
  const filtroDesconhecido = await c.solicitar('/api/ensaios?outro=1', { headers: { Cookie: c.cookieDiretoria } });
  assert.equal(filtroDesconhecido.status, 400);
  assert.equal((await filtroDesconhecido.json()).error.code, 'DADOS_INVALIDOS');

  // Listagem com situação inválida
  const situacaoInvalida = await c.solicitar('/api/ensaios?situacao=OUTRA', { headers: { Cookie: c.cookieDiretoria } });
  assert.equal(situacaoInvalida.status, 400);
  assert.equal((await situacaoInvalida.json()).error.code, 'DADOS_INVALIDOS');

  // Consulta por ID com query param
  const getComQuery = await c.solicitar('/api/ensaios/1?outro=1', { headers: { Cookie: c.cookieDiretoria } });
  assert.equal(getComQuery.status, 400);
  assert.equal((await getComQuery.json()).error.code, 'DADOS_INVALIDOS');

  // POST com query param
  const postComQuery = await c.solicitar('/api/ensaios?outro=1', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(postComQuery.status, 400);
  assert.equal((await postComQuery.json()).error.code, 'DADOS_INVALIDOS');

  // PUT com query param
  const putComQuery = await c.solicitar('/api/ensaios/1?outro=1', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ inicioEm: '2026-11-10T19:00:00-03:00', local: 'Quadra' }),
  });
  assert.equal(putComQuery.status, 400);
  assert.equal((await putComQuery.json()).error.code, 'DADOS_INVALIDOS');

  // PATCH com query param
  const patchComQuery = await c.solicitar('/api/ensaios/1/cancelamento?outro=1', {
    method: 'PATCH',
    headers,
    body: '{}',
  });
  assert.equal(patchComQuery.status, 400);
  assert.equal((await patchComQuery.json()).error.code, 'DADOS_INVALIDOS');
});

test('API Ensaios: cancelamento exige corpo vazio {}', async t => {
  const c = await prepararAmbiente(t, {
    ensaiosIniciais: [{ id: 1, inicioEm: '2026-11-10T22:00:00Z', local: 'Quadra', situacao: 'AGENDADO' }],
  });
  const headers = { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json' };

  const comCampos = await c.solicitar('/api/ensaios/1/cancelamento', {
    method: 'PATCH', headers, body: JSON.stringify({ motivo: 'chuva' }),
  });
  assert.equal(comCampos.status, 400);
  assert.equal((await comCampos.json()).error.code, 'DADOS_INVALIDOS');
});

// ==================== TESTES DE FLUXO COMPLETO E REGRAS DE NEGÓCIO ====================

test('API Ensaios: cadastro, consulta, listagem com filtros, edição e cancelamento idempotente', async t => {
  const c = await prepararAmbiente(t);
  const headers = { Cookie: c.cookieDiretoria, 'Content-Type': 'application/json' };

  // 1. Listagem inicial vazia
  const listaVazia = await c.solicitar('/api/ensaios', { headers: { Cookie: c.cookieDiretoria } });
  assert.equal(listaVazia.status, 200);
  assert.deepEqual(await listaVazia.json(), { ensaios: [] });

  // 2. Cadastro de ensaio
  const payloadCadastro = {
    inicioEm: '2026-11-10T19:00:00-03:00',
    local: '  Quadra do campus  ',
    descricao: '  Ensaio geral de ritmo  ',
  };
  const postResp = await c.solicitar('/api/ensaios', {
    method: 'POST', headers, body: JSON.stringify(payloadCadastro),
  });
  assert.equal(postResp.status, 201);
  assert.equal(postResp.headers.get('Location'), '/api/ensaios/1');
  const ensaioCriado = (await postResp.json()).ensaio;
  assert.equal(ensaioCriado.id, 1);
  assert.equal(ensaioCriado.inicioEm, '2026-11-10T22:00:00.000Z');
  assert.equal(ensaioCriado.local, 'Quadra do campus');
  assert.equal(ensaioCriado.descricao, 'Ensaio geral de ritmo');
  assert.equal(ensaioCriado.situacao, 'AGENDADO');

  // 3. Consulta individual
  const getResp = await c.solicitar('/api/ensaios/1', { headers: { Cookie: c.cookieDiretoria } });
  assert.equal(getResp.status, 200);
  assert.deepEqual(await getResp.json(), { ensaio: ensaioCriado });

  // 4. Cadastro de um segundo ensaio para conferir ordenação
  await c.solicitar('/api/ensaios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inicioEm: '2026-11-09T18:00:00-03:00', local: 'Galpão' }),
  });

  const lista = await c.solicitar('/api/ensaios', { headers: { Cookie: c.cookieDiretoria } });
  assert.equal(lista.status, 200);
  const listaEnsaios = (await lista.json()).ensaios;
  assert.equal(listaEnsaios.length, 2);
  // O ensaio do dia 09 deve vir antes do dia 10
  assert.equal(listaEnsaios[0].id, 2);
  assert.equal(listaEnsaios[0].inicioEm, '2026-11-09T21:00:00.000Z');
  assert.equal(listaEnsaios[1].id, 1);
  assert.equal(listaEnsaios[1].inicioEm, '2026-11-10T22:00:00.000Z');

  // 5. Edição do ensaio (PUT substitui campos e omissão de descrição vira null)
  const putResp = await c.solicitar('/api/ensaios/1', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      inicioEm: '2026-11-10T20:00:00-03:00',
      local: 'Quadra Central',
    }),
  });
  assert.equal(putResp.status, 200);
  const ensaioEditado = (await putResp.json()).ensaio;
  assert.equal(ensaioEditado.id, 1);
  assert.equal(ensaioEditado.inicioEm, '2026-11-10T23:00:00.000Z');
  assert.equal(ensaioEditado.local, 'Quadra Central');
  assert.equal(ensaioEditado.descricao, null);
  assert.equal(ensaioEditado.situacao, 'AGENDADO');

  // 6. Cancelamento (PATCH /api/ensaios/:id/cancelamento)
  const cancelResp1 = await c.solicitar('/api/ensaios/1/cancelamento', {
    method: 'PATCH', headers, body: '{}',
  });
  assert.equal(cancelResp1.status, 200);
  const ensaioCancelado = (await cancelResp1.json()).ensaio;
  assert.equal(ensaioCancelado.id, 1);
  assert.equal(ensaioCancelado.situacao, 'CANCELADO');

  // 7. Cancelamento idempotente: repetir cancelamento retorna 200 com situação CANCELADO
  const cancelResp2 = await c.solicitar('/api/ensaios/1/cancelamento', {
    method: 'PATCH', headers, body: '{}',
  });
  assert.equal(cancelResp2.status, 200);
  assert.deepEqual(await cancelResp2.json(), { ensaio: ensaioCancelado });

  // 8. Ensaio cancelado permanece na agenda e é filtrável
  const filtroAgendados = await c.solicitar('/api/ensaios?situacao=AGENDADO', { headers: { Cookie: c.cookieDiretoria } });
  const agendados = (await filtroAgendados.json()).ensaios;
  assert.equal(agendados.length, 1);
  assert.equal(agendados[0].id, 2);

  const filtroCancelados = await c.solicitar('/api/ensaios?situacao=CANCELADO', { headers: { Cookie: c.cookieDiretoria } });
  const cancelados = (await filtroCancelados.json()).ensaios;
  assert.equal(cancelados.length, 1);
  assert.equal(cancelados[0].id, 1);
  assert.equal(cancelados[0].situacao, 'CANCELADO');

  // 9. Tentativa de editar ensaio cancelado retorna 409 ENSAIO_CANCELADO
  const putCancelado = await c.solicitar('/api/ensaios/1', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      inicioEm: '2026-11-10T21:00:00-03:00',
      local: 'Quadra',
    }),
  });
  assert.equal(putCancelado.status, 409);
  assert.equal((await putCancelado.json()).error.code, 'ENSAIO_CANCELADO');
});
