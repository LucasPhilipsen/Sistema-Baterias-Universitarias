import test from 'node:test';
import assert from 'node:assert/strict';
import { instrumentosPath, readEstoque, readInstrumento, readInstrumentos, readTipo, readTipos, stockError, stockFieldErrors, validateInstrumento, validateTipo } from '../src/pages/instrumentos.js';
import { HttpError } from '../src/services/http.js';

const tipos = [{ id: 73, nome: 'Caixa' }];
const values = { tipoInstrumentoId: '73', identificacao: '  caixa-001  ', observacoes: '  ' };

test('normaliza nomes e respeita 80 caracteres Unicode após trim', () => {
  assert.deepEqual(validateTipo({ nome: '  Agogô  ' }), { errors: {}, body: { nome: 'Agogô' } });
  assert.deepEqual(validateTipo({ nome: '🎵'.repeat(80) }).errors, {});
  for (const nome of ['', '  ', 'x'.repeat(81), 'Caixa\0']) assert.ok(validateTipo({ nome }).errors.nome);
});

test('unidade usa ID da API como número, normaliza identificação e envia somente os campos editáveis', () => {
  assert.deepEqual(validateInstrumento({ ...values, id: 123, situacao: 'EMPRESTADO' }, tipos), {
    errors: {}, body: { tipoInstrumentoId: 73, identificacao: 'CAIXA-001', observacoes: null },
  });
  for (const tipoInstrumentoId of ['', '1', '-73', '73.0', '073', '2147483648']) {
    assert.ok(validateInstrumento({ ...values, tipoInstrumentoId }, tipos).errors.tipoInstrumentoId);
  }
});

test('recusa identificação inválida antes de converter letras Unicode para maiúsculas', () => {
  for (const identificacao of ['', '_CAIXA', '-CAIXA', 'CAIXA 001', 'CAIXA/1', 'ı', 'ſ', 'x'.repeat(41)]) {
    assert.ok(validateInstrumento({ ...values, identificacao }, tipos).errors.identificacao);
  }
  assert.deepEqual(validateInstrumento({ ...values, identificacao: 'a_B-09', observacoes: '  Pele revisada  ' }, tipos).body,
    { tipoInstrumentoId: 73, identificacao: 'A_B-09', observacoes: 'Pele revisada' });
});

test('observações opcionais aceitam 500 caracteres e recusam excesso ou caractere nulo', () => {
  assert.deepEqual(validateInstrumento({ ...values, observacoes: '🎵'.repeat(500) }, tipos).errors, {});
  for (const observacoes of ['x'.repeat(501), 'Pele\0']) assert.ok(validateInstrumento({ ...values, observacoes }, tipos).errors.observacoes);
});

test('compõe filtros combinados sem IDs fixos e omite filtros vazios', () => {
  assert.equal(instrumentosPath({}), '/instrumentos');
  assert.equal(instrumentosPath({ tipoInstrumentoId: '73', situacao: 'EM_MANUTENCAO' }), '/instrumentos?tipoInstrumentoId=73&situacao=EM_MANUTENCAO');
});

test('leitores exigem recursos e situações válidos e preservam listas vazias', () => {
  assert.deepEqual(readTipos({ tiposInstrumentos: tipos }), tipos);
  assert.deepEqual(readInstrumentos({ instrumentos: [] }), []);
  const unidade = { id: 801, tipoInstrumentoId: 73, identificacao: 'CX-01', observacoes: null, situacao: 'EMPRESTADO' };
  assert.equal(readInstrumento(unidade), unidade);
  assert.throws(() => readInstrumento({ ...unidade, situacao: 'QUEBRADO' }));
  assert.throws(() => readInstrumento({ ...unidade, identificacao: 'caixa' }));
  assert.throws(() => readTipo({ id: 0, nome: 'Caixa' }));
  assert.throws(() => readTipos({ tiposInstrumentos: {} }));
  assert.throws(() => readInstrumentos(null));
});

test('resumo inclui tipo zerado e exige números inteiros com soma consistente', () => {
  const row = { tipoInstrumentoId: 73, nome: 'Caixa', total: 3, disponiveis: 1, emprestados: 1, emManutencao: 1 };
  assert.deepEqual(readEstoque({ estoque: [row, { ...row, total: 0, disponiveis: 0, emprestados: 0, emManutencao: 0 }] }).length, 2);
  for (const changed of [{ total: 4 }, { total: '3' }, { disponiveis: -1 }, { emManutencao: 1.5 }]) assert.throws(() => readEstoque({ estoque: [{ ...row, ...changed }] }));
});

test('erros de domínio indicam campos; mensagens de falha não expõem o corpo bruto', () => {
  const failure = (status, code) => new HttpError('SQL privado', status, { error: { code, message: 'SQL privado' } });
  assert.ok(stockFieldErrors(failure(409, 'TIPO_INSTRUMENTO_DUPLICADO')).nome);
  assert.ok(stockFieldErrors(failure(409, 'IDENTIFICACAO_DUPLICADA')).identificacao);
  assert.ok(stockFieldErrors(failure(400, 'TIPO_INSTRUMENTO_INVALIDO')).tipoInstrumentoId);
  assert.match(stockError(failure(403)), /permissão/);
  assert.match(stockError(failure(404)), /não foi encontrado/);
  assert.match(stockError(failure(409, 'INSTRUMENTO_INDISPONIVEL')), /não pode ser trocado/);
  assert.match(stockError(failure(400)), /recusou os dados/);
  assert.match(stockError(failure(500), 'save'), /confirmar/);
  assert.doesNotMatch(stockError(failure(500)), /SQL/);
});
