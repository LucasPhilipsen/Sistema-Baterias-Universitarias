import test from 'node:test';
import assert from 'node:assert/strict';
import { readIntegrante, readIntegrantes, validateIntegrante, integranteError } from '../src/pages/integrantes.js';
import { HttpError } from '../src/services/http.js';

test('senha preserva espaços, conta Unicode e limita bytes; edição só envia contato', () => {
  const base = { nome: '  Ana  ', email: ' ANA@BATERIA.EXAMPLE ', senha: '  🎵🎵🎵🎵🎵🎵🎵🎵  ' };
  assert.deepEqual(validateIntegrante(base, true), { errors: {}, body: { nome: 'Ana', email: 'ana@bateria.example', senha: base.senha } });
  assert.ok(validateIntegrante({ ...base, senha: '🎵'.repeat(11) }, true).errors.senha);
  assert.deepEqual(validateIntegrante({ ...base, senha: '🎵'.repeat(256) }, true).errors, {});
  assert.ok(validateIntegrante({ ...base, senha: '🎵'.repeat(257) }, true).errors.senha);
  assert.deepEqual(validateIntegrante(base, false).body, { nome: 'Ana', email: 'ana@bateria.example' });
  assert.ok(validateIntegrante({ ...base, nome: '\0' }, true).errors.nome);
  assert.ok(validateIntegrante({ ...base, nome: 'a'.repeat(121), email: 'sem email' }, true).errors.email);
});

test('leitura aceita somente integrantes e descarta quaisquer campos sensíveis ou extras', () => {
  const publicFields = { id: 73, nome: 'Ana', email: 'ana@bateria.example', perfil: 'INTEGRANTE' };
  assert.deepEqual(readIntegrante({ ...publicFields, senhaHash: 'segredo', senha: 'segredo', token: 'segredo' }), publicFields);
  assert.throws(() => readIntegrante({ ...publicFields, perfil: 'DIRETORIA' }));
  assert.throws(() => readIntegrantes({ integrantes: [publicFields, publicFields] }));
  assert.throws(() => readIntegrantes({}));
  assert.deepEqual(readIntegrantes({ integrantes: [] }), []);
});

test('erros não mostram corpo bruto e gravação incerta pede nova consulta', () => {
  const error = new HttpError('segredo', 409, { error: { code: 'EMAIL_DUPLICADO', message: 'segredo' } });
  assert.match(integranteError(error, true), /Já existe/);
  assert.doesNotMatch(integranteError(error, true), /segredo/);
  assert.match(integranteError(new TypeError(), true), /Atualize a lista/);
});
