import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfirmacaoService, validarIdEnsaioParam, validarCorpoConfirmacao, validarSemParametrosConsulta } from '../src/services/ConfirmacaoService.js';
import { Confirmacao } from '../src/entities/Confirmacao.js';

// --- Validação de entrada ---

test('validarIdEnsaioParam rejeita identificador inválido', () => {
  assert.throws(() => validarIdEnsaioParam('0'), { code: 'DADOS_INVALIDOS' });
  assert.throws(() => validarIdEnsaioParam('-1'), { code: 'DADOS_INVALIDOS' });
  assert.throws(() => validarIdEnsaioParam('abc'), { code: 'DADOS_INVALIDOS' });
  assert.throws(() => validarIdEnsaioParam(''), { code: 'DADOS_INVALIDOS' });
  assert.throws(() => validarIdEnsaioParam('99999999999'), { code: 'DADOS_INVALIDOS' });
});

test('validarIdEnsaioParam aceita identificador válido', () => {
  assert.equal(validarIdEnsaioParam('1'), 1);
  assert.equal(validarIdEnsaioParam('2147483647'), 2147483647);
});

test('validarCorpoConfirmacao rejeita corpo sem tipoInstrumentoId', () => {
  assert.throws(() => validarCorpoConfirmacao({}), { code: 'DADOS_INVALIDOS' });
});

test('validarCorpoConfirmacao rejeita tipoInstrumentoId não inteiro', () => {
  assert.throws(() => validarCorpoConfirmacao({ tipoInstrumentoId: 'abc' }), { code: 'DADOS_INVALIDOS' });
  assert.throws(() => validarCorpoConfirmacao({ tipoInstrumentoId: 1.5 }), { code: 'DADOS_INVALIDOS' });
  assert.throws(() => validarCorpoConfirmacao({ tipoInstrumentoId: 0 }), { code: 'DADOS_INVALIDOS' });
  assert.throws(() => validarCorpoConfirmacao({ tipoInstrumentoId: -1 }), { code: 'DADOS_INVALIDOS' });
});

test('validarCorpoConfirmacao rejeita campos adicionais', () => {
  assert.throws(() => validarCorpoConfirmacao({ tipoInstrumentoId: 1, extra: 'x' }), { code: 'DADOS_INVALIDOS' });
});

test('validarCorpoConfirmacao rejeita tentativa de alterar usuarioId de outra pessoa', () => {
  assert.throws(() => validarCorpoConfirmacao({ tipoInstrumentoId: 1, usuarioId: 2 }), { code: 'DADOS_INVALIDOS' });
});

test('validarCorpoConfirmacao aceita corpo válido', () => {
  assert.equal(validarCorpoConfirmacao({ tipoInstrumentoId: 1 }), 1);
});

test('validarSemParametrosConsulta rejeita query params', () => {
  assert.throws(() => validarSemParametrosConsulta({ foo: 'bar' }), { code: 'DADOS_INVALIDOS' });
});

test('validarSemParametrosConsulta aceita query vazia', () => {
  validarSemParametrosConsulta({}); // não deve lançar
});

// --- Entidade Confirmacao ---

test('Confirmacao cria instância com dados válidos', () => {
  const c = new Confirmacao({
    id: 1,
    ensaioId: 5,
    tipoInstrumentoId: 2,
    tipoInstrumentoNome: 'Caixa',
    confirmadoEm: new Date('2026-11-20T19:45:00.000Z'),
    atualizadoEm: null,
  });
  assert.equal(c.id, 1);
  assert.equal(c.ensaioId, 5);
  assert.equal(c.tipoInstrumentoId, 2);
  assert.equal(c.tipoInstrumentoNome, 'Caixa');
  assert.equal(c.confirmadoEm, '2026-11-20T19:45:00.000Z');
  assert.equal(c.atualizadoEm, null);
});

test('Confirmacao.toJSON retorna representação correta', () => {
  const c = new Confirmacao({
    id: 10,
    ensaioId: 3,
    tipoInstrumentoId: 1,
    tipoInstrumentoNome: 'Surdo',
    confirmadoEm: new Date('2026-11-20T19:45:00.000Z'),
    atualizadoEm: new Date('2026-11-20T20:10:00.000Z'),
  });
  const json = c.toJSON();
  assert.deepEqual(json, {
    id: 10,
    ensaioId: 3,
    tipoInstrumentoId: 1,
    tipoInstrumentoNome: 'Surdo',
    confirmadoEm: '2026-11-20T19:45:00.000Z',
    atualizadoEm: '2026-11-20T20:10:00.000Z',
  });
});

test('Confirmacao rejeita id inválido', () => {
  assert.throws(() => new Confirmacao({
    id: -1,
    ensaioId: 1,
    tipoInstrumentoId: 1,
    tipoInstrumentoNome: 'Caixa',
    confirmadoEm: new Date(),
  }));
});

// --- Serviço com repositório simulado ---

function criarRepoMock(retornos = {}) {
  return {
    buscarAtiva: async () => retornos.buscarAtiva ?? { status: 'OK', confirmacao: null },
    confirmar: async () => retornos.confirmar ?? { status: 'OK', confirmacao: {} },
    cancelar: async () => retornos.cancelar ?? { status: 'OK' },
    demandaAtivas: async () => retornos.demandaAtivas ?? [],
  };
}

test('ConfirmacaoService.consultar retorna null quando não houver participação', async () => {
  const servico = new ConfirmacaoService({ confirmacoes: criarRepoMock() });
  const resultado = await servico.consultar(1, 1);
  assert.equal(resultado, null);
});

test('ConfirmacaoService.consultar lança ENSAIO_NAO_ENCONTRADO', async () => {
  const servico = new ConfirmacaoService({
    confirmacoes: criarRepoMock({ buscarAtiva: { status: 'ENSAIO_NAO_ENCONTRADO' } }),
  });
  await assert.rejects(() => servico.consultar(999, 1), { status: 404, code: 'ENSAIO_NAO_ENCONTRADO' });
});

test('ConfirmacaoService.confirmar lança ENSAIO_NAO_ENCONTRADO', async () => {
  const servico = new ConfirmacaoService({
    confirmacoes: criarRepoMock({ confirmar: { status: 'ENSAIO_NAO_ENCONTRADO' } }),
  });
  await assert.rejects(() => servico.confirmar(999, 1, 1), { status: 404, code: 'ENSAIO_NAO_ENCONTRADO' });
});

test('ConfirmacaoService.confirmar lança ENSAIO_CANCELADO', async () => {
  const servico = new ConfirmacaoService({
    confirmacoes: criarRepoMock({ confirmar: { status: 'ENSAIO_CANCELADO' } }),
  });
  await assert.rejects(() => servico.confirmar(1, 1, 1), { status: 409, code: 'ENSAIO_CANCELADO' });
});

test('ConfirmacaoService.confirmar lança TIPO_INSTRUMENTO_INVALIDO', async () => {
  const servico = new ConfirmacaoService({
    confirmacoes: criarRepoMock({ confirmar: { status: 'TIPO_INSTRUMENTO_INVALIDO' } }),
  });
  await assert.rejects(() => servico.confirmar(1, 1, 999), { status: 400, code: 'TIPO_INSTRUMENTO_INVALIDO' });
});

test('ConfirmacaoService.cancelar lança ENSAIO_NAO_ENCONTRADO', async () => {
  const servico = new ConfirmacaoService({
    confirmacoes: criarRepoMock({ cancelar: { status: 'ENSAIO_NAO_ENCONTRADO' } }),
  });
  await assert.rejects(() => servico.cancelar(999, 1), { status: 404, code: 'ENSAIO_NAO_ENCONTRADO' });
});

test('ConfirmacaoService.cancelar lança ENSAIO_CANCELADO', async () => {
  const servico = new ConfirmacaoService({
    confirmacoes: criarRepoMock({ cancelar: { status: 'ENSAIO_CANCELADO' } }),
  });
  await assert.rejects(() => servico.cancelar(1, 1), { status: 409, code: 'ENSAIO_CANCELADO' });
});
