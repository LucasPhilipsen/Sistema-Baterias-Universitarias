import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/services/http.js';
import { participacaoError, readParticipacao, validateParticipacao } from '../src/pages/participacoes.js';

const record = { id: 91, ensaioId: 807, tipoInstrumentoId: 73, tipoInstrumentoNome: 'Caixa', confirmadoEm: '2026-11-23T20:00:00.000Z', atualizadoEm: null };

test('participação exige resposta explícita e identidade do ensaio, aceitando null', () => {
  assert.deepEqual(readParticipacao({ participacao: { ...record, usuarioId: 1, token: 'segredo' } }, 807), record);
  assert.equal(readParticipacao({ participacao: null }, 807), null);
  assert.throws(() => readParticipacao({}, 807));
  assert.throws(() => readParticipacao({ participacao: record }, 808));
  for (const invalid of [{ id: 0 }, { tipoInstrumentoId: '73' }, { tipoInstrumentoNome: '' }, { confirmadoEm: 'inválido' }, { atualizadoEm: 'inválido' }]) {
    assert.throws(() => readParticipacao({ participacao: { ...record, ...invalid } }, 807));
  }
});

test('seleção usa IDs inteiros vindos dos tipos da API, sem identidade ou perfil no corpo', () => {
  const tipos = [{ id: 73, nome: 'Caixa' }, { id: 431, nome: 'Surdo' }];
  assert.deepEqual(validateParticipacao('431', tipos), { body: { tipoInstrumentoId: 431 }, error: '' });
  for (const value of ['', '0', '01', '1e2', '2147483648', '99']) assert.ok(validateParticipacao(value, tipos).error);
});

test('mensagens de erro não expõem respostas brutas e diferenciam conflito e ensaio cancelado', () => {
  const error = (status, code) => new HttpError('segredo', status, { error: { code, message: 'SQL segredo' } });
  assert.match(participacaoError(error(400, 'TIPO_INSTRUMENTO_INVALIDO')), /Atualize os tipos/);
  assert.match(participacaoError(error(409, 'ENSAIO_CANCELADO')), /ensaio foi cancelado/);
  assert.match(participacaoError(error(409, 'CONFLITO')), /participação já existe/);
  assert.match(participacaoError(new Error(), 'save'), /antes de repetir/);
  for (const status of [400, 401, 403, 404, 409, 415, 500]) assert.doesNotMatch(participacaoError(error(status)), /segredo/);
});
