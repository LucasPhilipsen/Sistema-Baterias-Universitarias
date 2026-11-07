import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpClient, HttpError } from '../src/services/http.js';

test('envia JSON, preserva opções e lê a resposta da API', async () => {
  const controller = new AbortController();
  const request = createHttpClient({ baseUrl: '/api/', fetchImpl: async (url, options) => {
    assert.equal(url, '/api/health');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{"nome":"Bateria"}');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.signal, controller.signal);
    assert.equal(options.credentials, 'same-origin');
    return new Response('{"status":"OK"}');
  } });
  assert.deepEqual(await request('/health', { method: 'POST', body: { nome: 'Bateria' }, signal: controller.signal }), { status: 'OK' });
});

test('aceita resposta sem conteúdo', async () => {
  const request = createHttpClient({ fetchImpl: async () => new Response(null, { status: 204 }) });
  assert.equal(await request('/exemplo'), null);
});

test('expõe status e dados de erro sem mostrar detalhes internos na mensagem', async () => {
  const request = createHttpClient({ fetchImpl: async () => new Response('{"message":"detalhe interno"}', { status: 503 }) });
  await assert.rejects(request('/health'), error => error instanceof HttpError && error.status === 503 && error.data.message === 'detalhe interno' && !error.message.includes('detalhe interno'));
});

test('identifica HTML inesperado e propaga falha de rede', async () => {
  const invalid = createHttpClient({ fetchImpl: async () => new Response('<html>fallback</html>') });
  await assert.rejects(invalid('/health'), { name: 'HttpError', message: 'A API retornou uma resposta inválida.' });
  const offline = createHttpClient({ fetchImpl: async () => { throw new TypeError('offline'); } });
  await assert.rejects(offline('/health'), { name: 'TypeError' });
});
