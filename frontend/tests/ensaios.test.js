import test from 'node:test';
import assert from 'node:assert/strict';
import { dateFields, displayDate, toInstant, validateForm, ensaioError, readEnsaio } from '../src/pages/ensaios.js';
import { HttpError } from '../src/services/http.js';

test('converte São Paulo para UTC e exibe o instante no fuso da agenda', () => {
  assert.equal(toInstant('2026-11-10', '19:00'), '2026-11-10T22:00:00.000Z');
  assert.deepEqual(dateFields('2026-11-11T01:30:45.123Z'), { data: '2026-11-10', horario: '22:30' });
  assert.match(displayDate('2026-11-10T22:00:00.000Z'), /19:00/);
  assert.equal(toInstant('2026-11-10', '23:30'), '2026-11-11T02:30:00.000Z');
});

test('respeita deslocamento histórico, rejeita salto de horário de verão e escolhe primeira hora repetida', () => {
  assert.equal(toInstant('2018-12-10', '19:00'), '2018-12-10T21:00:00.000Z');
  assert.throws(() => toInstant('2018-11-04', '00:30'), /não existe/);
  assert.equal(toInstant('2019-02-16', '23:30'), '2019-02-17T01:30:00.000Z');
});

test('recusa datas inexistentes, campos incompletos e instantes fora do contrato', () => {
  for (const data of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '1969-12-31', '10000-01-01', '', '2026-1-01']) {
    assert.throws(() => toInstant(data, '19:00'), /válidos/);
  }
  for (const horario of ['', '24:00', '23:60', '1:00']) assert.throws(() => toInstant('2026-11-10', horario));
  assert.throws(() => toInstant('9999-12-31', '23:30'));
  assert.equal(toInstant('2028-02-29', '00:00'), '2028-02-29T03:00:00.000Z');
});

test('valida e normaliza somente campos editáveis com limites após trim', () => {
  const values = { data: '2026-11-10', horario: '19:00', local: '  Quadra  ', descricao: '  ' };
  assert.deepEqual(validateForm(values), { errors: {}, body: { inicioEm: '2026-11-10T22:00:00.000Z', local: 'Quadra', descricao: null } });
  assert.equal(validateForm({ ...values, local: 'x'.repeat(160), descricao: 'x'.repeat(1000) }).errors.local, undefined);
  assert.ok(validateForm({ ...values, local: 'x'.repeat(161) }).errors.local);
  assert.ok(validateForm({ ...values, descricao: 'x'.repeat(1001) }).errors.descricao);
  assert.ok(validateForm({ ...values, local: '  ' }).errors.local);
});

test('mensagens tratam status e código sem expor o erro bruto da API', () => {
  const failure = (status, code) => new HttpError('SQL sigiloso', status, { error: { code, message: 'SQL sigiloso' } });
  assert.match(ensaioError(failure(403), 'save'), /permissão/);
  assert.match(ensaioError(failure(400), 'save'), /recusou/);
  assert.match(ensaioError(failure(404), 'save'), /não foi encontrado/);
  assert.match(ensaioError(failure(409, 'ENSAIO_CANCELADO'), 'save'), /já foi cancelado/);
  assert.match(ensaioError(failure(500), 'save'), /confirmar/);
  assert.match(ensaioError(new TypeError('Failed to fetch'), 'list'), /carregar a agenda/);
});

test('exige confirmação do recurso válido antes de anunciar sucesso', () => {
  const ensaio = { id: 71, inicioEm: '2026-11-10T22:00:00.000Z', local: 'Quadra', descricao: null, situacao: 'AGENDADO' };
  assert.equal(readEnsaio(ensaio), ensaio);
  for (const changed of [{ id: 0 }, { inicioEm: '2026-11-10T19:00:00' }, { situacao: 'ABERTO' }, { descricao: undefined }, { local: '' }]) {
    assert.throws(() => readEnsaio({ ...ensaio, ...changed }));
  }
  assert.throws(() => readEnsaio(null));
});
