import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, loginErrorMessage } from '../src/auth/session.js';
import { HttpError } from '../src/services/http.js';

const usuario = { id: 7, nome: 'Integrante', email: 'integrante@bateria.example', perfil: 'INTEGRANTE' };
const httpError = status => new HttpError('Detalhe interno que não deve aparecer.', status, null);
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('restaura somente o usuário retornado pela API e compartilha consultas simultâneas', async () => {
  const response = deferred();
  const calls = [];
  const session = createSession({ request: async (...args) => { calls.push(args); return response.promise; } });
  assert.equal(session.getSnapshot().status, 'checking');
  const first = session.refresh();
  const second = session.refresh();
  assert.equal(first, second);
  response.resolve({ usuario: { ...usuario, token: 'não armazenar' } });
  await first;
  assert.deepEqual(calls, [['/auth/me', { cache: 'no-store' }]]);
  assert.deepEqual(session.getSnapshot(), { status: 'authenticated', usuario, reason: null });
});

test('login normaliza e-mail, preserva senha e envia somente as credenciais', async () => {
  let changes = 0;
  const session = createSession({ request: async (path, options) => {
    assert.equal(path, '/auth/login');
    assert.deepEqual(options.body, { email: usuario.email, senha: '  senha com espaços  ' });
    assert.equal(options.method, 'POST');
    return { usuario };
  }, onSessionChange: () => changes++ });
  await session.login({ email: ' INTEGRANTE@BATERIA.EXAMPLE ', senha: '  senha com espaços  ', perfil: 'DIRETORIA' });
  assert.equal(changes, 1);
  assert.equal(session.getSnapshot().usuario.perfil, 'INTEGRANTE');
  assert.equal(JSON.stringify(session.getSnapshot()).includes('senha'), false);
});

test('credenciais inválidas deixam sessão anônima e mensagens não expõem erros internos', async () => {
  const session = createSession({ request: async () => { throw httpError(401); } });
  await assert.rejects(session.login({ email: usuario.email, senha: 'errada' }), { status: 401 });
  assert.equal(session.getSnapshot().status, 'anonymous');
  assert.equal(loginErrorMessage(httpError(401)), 'E-mail ou senha inválidos.');
  assert.match(loginErrorMessage(httpError(429)), /Muitas tentativas/);
  assert.match(loginErrorMessage(httpError(403)), /origem/);
  assert.doesNotMatch(loginErrorMessage(httpError(500)), /Detalhe interno/);
});

test('sessão ausente é diferente de falha de conexão e permite tentar novamente', async () => {
  let response = 401;
  const session = createSession({ request: async () => {
    if (response === 'ok') return { usuario };
    if (response === 'offline') throw new TypeError('offline');
    throw httpError(response);
  } });
  await session.refresh();
  assert.deepEqual(session.getSnapshot(), { status: 'anonymous', usuario: null, reason: null });
  response = 'offline';
  await session.refresh();
  assert.equal(session.getSnapshot().status, 'error');
  response = 'ok';
  await session.refresh();
  response = 401;
  await session.refresh();
  assert.equal(session.getSnapshot().reason, 'expired');
});

test('perfil inválido ou resposta de sessão incompleta bloqueia o acesso', async () => {
  for (const invalid of [{ ...usuario, perfil: 'ADMIN' }, { ...usuario, id: null }, { perfil: 'DIRETORIA' }]) {
    const session = createSession({ request: async () => ({ usuario: invalid }) });
    await session.refresh();
    assert.equal(session.getSnapshot().status, 'error');
    assert.equal(session.getSnapshot().usuario, null);
  }
});

test('logout só confirma saída após revogação no servidor e ignora restauração atrasada', async () => {
  const delayed = deferred();
  const calls = [];
  const session = createSession({ request: async (path, options) => {
    calls.push([path, options]);
    if (path === '/auth/me') return delayed.promise;
    return null;
  } });
  const restoring = session.refresh();
  await session.logout();
  delayed.resolve({ usuario });
  await restoring;
  assert.equal(session.getSnapshot().reason, 'signedOut');
  assert.deepEqual(calls[1], ['/auth/logout', { method: 'POST', body: {}, cache: 'no-store' }]);
});

test('restauração anterior não substitui um novo login', async () => {
  const delayed = deferred();
  const session = createSession({ request: async path => path === '/auth/me' ? delayed.promise : { usuario } });
  const restoring = session.refresh();
  await session.login({ email: usuario.email, senha: 'senha' });
  delayed.resolve({ usuario: { ...usuario, perfil: 'DIRETORIA' } });
  await restoring;
  assert.equal(session.getSnapshot().usuario.perfil, 'INTEGRANTE');
});

test('logout com falha bloqueia os módulos e pode ser repetido', async () => {
  let fails = true;
  const session = createSession({ request: async path => {
    if (path === '/auth/login') return { usuario };
    if (fails) throw new TypeError('offline');
    return null;
  } });
  await session.login({ email: usuario.email, senha: 'senha' });
  await session.logout();
  assert.equal(session.getSnapshot().reason, 'logoutFailed');
  await assert.rejects(session.request('/recurso'), { status: 401 });
  fails = false;
  await session.logout();
  assert.equal(session.getSnapshot().reason, 'signedOut');
});

test('401 de um módulo encerra a sessão e 403 atualiza o perfil sem tratá-lo como logout', async () => {
  let status = 403;
  const session = createSession({ request: async path => {
    if (path.startsWith('/auth/')) return { usuario };
    throw httpError(status);
  } });
  await session.login({ email: usuario.email, senha: 'senha' });
  await assert.rejects(session.request('/restrito'), { status: 403 });
  assert.equal(session.getSnapshot().status, 'authenticated');
  status = 401;
  await assert.rejects(session.request('/restrito'), { status: 401 });
  assert.equal(session.getSnapshot().reason, 'expired');
});

test('401 atrasado de uma sessão anterior não encerra um novo login', async () => {
  const delayed = deferred();
  const session = createSession({ request: async path => {
    if (path.startsWith('/auth/')) return { usuario };
    await delayed.promise;
    throw httpError(401);
  } });
  await session.login({ email: usuario.email, senha: 'senha' });
  const oldRequest = session.request('/recurso');
  await session.logout();
  await session.login({ email: usuario.email, senha: 'nova senha' });
  delayed.resolve();
  await assert.rejects(oldRequest, { status: 401 });
  assert.equal(session.getSnapshot().status, 'authenticated');
});
