import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
});

test('API inicia sem exigir banco e retorna o contrato de saúde', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'baterias-api' });
});

test('rota inexistente responde com erro JSON, sem página HTML', async () => {
  const response = await fetch(`${baseUrl}/api/inexistente`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});

test('JSON malformado retorna 400 sem expor detalhes internos', async () => {
  const response = await fetch(`${baseUrl}/api/inexistente`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: 'INVALID_JSON', message: 'JSON inválido.' } });
});

test('JSON acima do limite retorna 413', async () => {
  const response = await fetch(`${baseUrl}/api/inexistente`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: 'a'.repeat(110000) }),
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
});
