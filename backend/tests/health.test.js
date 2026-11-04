import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Socket } from 'node:net';
import app from '../src/app.js';
import { dbPool } from '../src/config/database.js';

test('GET /api/health deve responder com informações da API e do banco', async (t) => {
  t.after(async () => {
    await dbPool.end();
  });

  const socket = new Socket();
  const req = new http.IncomingMessage(socket);
  req.method = 'GET';
  req.url = '/api/health';

  const res = new http.ServerResponse(req);
  let responseBody = '';

  await new Promise((resolve, reject) => {
    res.write = (chunk) => {
      responseBody += chunk;
      return true;
    };

    res.end = (chunk) => {
      if (chunk) responseBody += chunk;
      resolve();
      return res;
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });

  assert.ok([200, 503].includes(res.statusCode), `Status deve ser 200 ou 503, recebido: ${res.statusCode}`);
  const data = JSON.parse(responseBody);

  assert.ok(data.status === 'OK' || data.status === 'DEGRADED');
  assert.ok(data.timestamp, 'Timestamp deve estar presente');
  assert.ok(data.database, 'Objeto database deve estar presente');

  if (res.statusCode === 200) {
    assert.strictEqual(data.database.status, 'connected');
    assert.ok(data.database.timestamp, 'Timestamp retornado pelo PostgreSQL deve estar presente');
  } else {
    assert.strictEqual(data.database.status, 'disconnected');
    assert.ok(data.database.error, 'Erro de conexão deve ser informado');
  }
});
