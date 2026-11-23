import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/services/http.js';
import { demandaError, displayCalculatedAt, readDemanda, readScheduledEnsaios } from '../src/pages/demanda.js';

const item = { tipoInstrumentoId: 73, nome: 'Caixa', confirmados: 5, disponiveis: 3, falta: 2 };
const data = { demanda: { ensaioId: 91, calculadoEm: '2026-11-23T21:30:12.000Z', tipos: [item] } };

test('exige o ensaio solicitado, data UTC válida, inteiros e IDs únicos', () => {
  assert.deepEqual(readDemanda(data, 91), data.demanda);
  assert.throws(() => readDemanda(data, 92));
  for (const calculadoEm of ['invalido', '2026-02-30T21:30:12.000Z', '2026-11-23T18:30:12-03:00']) {
    assert.throws(() => readDemanda({ demanda: { ...data.demanda, calculadoEm } }, 91));
  }
  for (const invalid of [{ falta: undefined }, { falta: -1 }, { disponiveis: '3' }, { confirmados: 1.5 }, { tipoInstrumentoId: 0 }, { nome: '' }]) {
    assert.throws(() => readDemanda({ demanda: { ...data.demanda, tipos: [{ ...item, ...invalid }] } }, 91));
  }
  assert.throws(() => readDemanda({ demanda: { ...data.demanda, tipos: [item, item] } }, 91));
  assert.deepEqual(readDemanda({ demanda: { ...data.demanda, tipos: [] } }, 91).tipos, []);
});

test('preserva a falta fornecida pela API e mantém apenas os campos públicos', () => {
  const response = { demanda: { ...data.demanda, tipos: [{ ...item, falta: 4, detalheInterno: 'segredo' }], token: 'segredo' } };
  assert.deepEqual(readDemanda(response, 91), { ...data.demanda, tipos: [{ ...item, falta: 4 }] });
});

test('lista somente ensaios agendados e aceita IDs arbitrários da API', () => {
  const base = { id: 213, inicioEm: '2026-11-25T22:00:00.000Z', local: 'Quadra', descricao: null, situacao: 'AGENDADO' };
  assert.deepEqual(readScheduledEnsaios({ ensaios: [base, { ...base, id: 914, situacao: 'CANCELADO' }] }), [base]);
  assert.throws(() => readScheduledEnsaios({}));
  assert.throws(() => readScheduledEnsaios({ ensaios: [base, base] }));
});

test('exibe o instante em São Paulo independentemente do fuso do navegador', () => {
  assert.equal(displayCalculatedAt(data.demanda.calculadoEm), '23/11/2026, 18:30:12');
});

test('mensagens distinguem permissão, cancelamento e falha sem expor o corpo bruto', () => {
  const error = status => new HttpError('segredo', status, { error: { message: 'SQL segredo' } });
  assert.match(demandaError(error(403)), /restrito à diretoria/);
  assert.match(demandaError(error(409)), /cancelado/);
  assert.match(demandaError(error(404)), /não está disponível/);
  assert.match(demandaError(error(500)), /atualizar a comparação/);
  for (const status of [400, 401, 403, 404, 409, 500]) assert.doesNotMatch(demandaError(error(status)), /segredo/);
});
