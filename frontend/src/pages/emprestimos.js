import { HttpError } from '../services/http.js';

const validId = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const validText = value => typeof value === 'string' && Boolean(value.trim()) && !value.includes('\0');
const validDate = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z');

export function readEmprestimo(value) {
  if (!validId(value?.id) || !validId(value.integrante?.id) || !validText(value.integrante.nome)
    || !validId(value.instrumento?.id) || !validText(value.instrumento.identificacao)
    || !validDate(value.retiradaEm)
    || !(value.situacao === 'ATIVO' && value.devolucaoEm === null
      || value.situacao === 'DEVOLVIDO' && validDate(value.devolucaoEm)
      && Date.parse(value.devolucaoEm) >= Date.parse(value.retiradaEm))) throw new Error('Empréstimo inválido.');
  return {
    id: value.id,
    integrante: { id: value.integrante.id, nome: value.integrante.nome },
    instrumento: { id: value.instrumento.id, identificacao: value.instrumento.identificacao },
    retiradaEm: value.retiradaEm, devolucaoEm: value.devolucaoEm, situacao: value.situacao,
  };
}

export function readEmprestimos(data) {
  if (!Array.isArray(data?.emprestimos)) throw new Error('Histórico inválido.');
  const items = data.emprestimos.map(readEmprestimo);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Histórico inválido.');
  const active = items.filter(item => item.situacao === 'ATIVO');
  if (new Set(active.map(item => item.instrumento.id)).size !== active.length) throw new Error('Histórico inválido.');
  return items.sort((a, b) => Date.parse(b.retiradaEm) - Date.parse(a.retiradaEm) || b.id - a.id);
}

export function validateRetirada(values, integrantes, instrumentos) {
  const errors = {};
  const body = {};
  for (const [key, options, message] of [
    ['integranteId', integrantes, 'Selecione um integrante da lista atual.'],
    ['instrumentoId', instrumentos, 'Selecione uma unidade disponível na lista atual.'],
  ]) {
    const value = /^[1-9]\d*$/.test(values[key]) ? Number(values[key]) : NaN;
    if (!validId(value) || !options.some(item => item.id === value)) errors[key] = message;
    body[key] = value;
  }
  return { errors, body };
}

export function displayLoanDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

export function emprestimoError(error, saving = false) {
  if (error instanceof HttpError) {
    const code = error.data?.error?.code;
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (code === 'ORIGEM_INVALIDA') return 'O servidor recusou a origem do acesso. Abra o sistema pelo endereço configurado.';
    if (error.status === 403) return 'Você não tem permissão para esta operação. Seu perfil foi consultado novamente.';
    if (code === 'INSTRUMENTO_INDISPONIVEL') return 'Esta unidade ficou indisponível. Consulte as opções atualizadas e selecione outra unidade.';
    if (code === 'INTEGRANTE_NAO_ENCONTRADO') return 'O integrante não foi encontrado. Confira a lista atualizada e selecione novamente.';
    if (code === 'INSTRUMENTO_NAO_ENCONTRADO') return 'A unidade não foi encontrada. Confira as opções atualizadas.';
    if (error.status === 404) return saving ? 'O empréstimo não foi encontrado. Atualize o histórico antes de continuar.' : 'O serviço de empréstimos não está disponível. Tente atualizar as consultas mais tarde.';
    if (error.status === 400) return 'Confira os campos informados e selecione os registros das listas atuais.';
    if (error.status === 415) return 'O servidor não aceitou o formato da solicitação. Recarregue a página e tente novamente.';
    if (error.status === 409) return 'A operação entrou em conflito com uma alteração recente. Confira as consultas atualizadas.';
  }
  return saving ? 'Não foi possível confirmar a operação. Confira o histórico atualizado antes de tentar novamente.'
    : 'Não foi possível carregar os dados. Verifique sua conexão e atualize as consultas.';
}
