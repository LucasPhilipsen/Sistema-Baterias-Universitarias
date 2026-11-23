import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/services/http.js';
import { readEmprestimo, readEmprestimos, validateRetirada, displayLoanDate, emprestimoError } from '../src/pages/emprestimos.js';

const loan = {
  id: 903, integrante: { id: 87, nome: 'Ana' }, instrumento: { id: 409, identificacao: 'CX-409' },
  retiradaEm: '2026-11-20T21:30:00.000Z', devolucaoEm: null, situacao: 'ATIVO',
};

test('contrato de empréstimos aceita somente datas e situações coerentes e guarda campos públicos', () => {
  assert.deepEqual(readEmprestimo({ ...loan, senhaHash: 'segredo', integrante: { ...loan.integrante, email: 'privado', senha: 'segredo' } }), loan);
  assert.equal(readEmprestimo({ ...loan, situacao: 'DEVOLVIDO', devolucaoEm: '2026-11-21T14:00:00Z' }).situacao, 'DEVOLVIDO');
  for (const changes of [
    { id: '903' }, { id: 2147483648 }, { integrante: null }, { instrumento: { id: 0, identificacao: 'CX' } },
    { retiradaEm: '2026-02-30T12:00:00Z' }, { retiradaEm: '2026-11-20T21:30:00-03:00' },
    { devolucaoEm: '2026-11-21T14:00:00Z' }, { situacao: 'DEVOLVIDO' },
    { situacao: 'DEVOLVIDO', devolucaoEm: '2026-11-19T14:00:00Z' }, { situacao: 'CANCELADO' },
  ]) assert.throws(() => readEmprestimo({ ...loan, ...changes }));
});

test('histórico ordena por retirada e id, rejeita duplicatas e dois ativos na mesma unidade', () => {
  const other = { ...loan, id: 904, instrumento: { id: 410, identificacao: 'CX-410' } };
  assert.deepEqual(readEmprestimos({ emprestimos: [loan, other] }).map(item => item.id), [904, 903]);
  assert.deepEqual(readEmprestimos({ emprestimos: [] }), []);
  for (const data of [{}, { emprestimos: [loan, loan] }, { emprestimos: [loan, { ...loan, id: 904 }] }]) assert.throws(() => readEmprestimos(data));
});

test('retirada usa IDs numéricos das opções atuais e impede seleção inválida ou removida', () => {
  const values = { integranteId: '87', instrumentoId: '409' };
  assert.deepEqual(validateRetirada(values, [{ id: 87 }], [{ id: 409 }]), { errors: {}, body: { integranteId: 87, instrumentoId: 409 } });
  assert.equal(Object.keys(validateRetirada(values, [], []).errors).length, 2);
  for (const id of ['', '0', '01', '-1', '1e2', '2147483648']) {
    assert.ok(validateRetirada({ ...values, integranteId: id }, [{ id: 87 }], [{ id: 409 }]).errors.integranteId);
  }
});

test('datas são exibidas em São Paulo independentemente do fuso da máquina', () => {
  assert.match(displayLoanDate('2026-11-20T01:30:00Z'), /19\/11\/2026.*22:30/);
});

test('falhas contratuais têm mensagens próprias sem expor detalhes da API', () => {
  for (const [status, code, expected] of [
    [400, 'DADOS_INVALIDOS', 'Confira os campos'], [401, 'SESSAO_INVALIDA', 'sessão expirou'],
    [403, 'ACESSO_NEGADO', 'permissão'], [403, 'ORIGEM_INVALIDA', 'origem'],
    [404, 'INTEGRANTE_NAO_ENCONTRADO', 'integrante não foi encontrado'],
    [404, 'INSTRUMENTO_NAO_ENCONTRADO', 'unidade não foi encontrada'],
    [404, 'EMPRESTIMO_NAO_ENCONTRADO', 'empréstimo não foi encontrado'],
    [409, 'INSTRUMENTO_INDISPONIVEL', 'ficou indisponível'], [415, 'JSON_OBRIGATORIO', 'formato'],
  ]) {
    const message = emprestimoError(new HttpError('SQL secreto', status, { error: { code, message: 'SQL secreto' } }), true);
    assert.ok(message.includes(expected), message); assert.ok(!message.includes('SQL secreto'));
  }
  assert.match(emprestimoError(new Error(), true), /histórico atualizado/);
  assert.match(emprestimoError(new Error()), /atualize as consultas/);
});
