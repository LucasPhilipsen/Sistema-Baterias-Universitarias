import { HttpError } from '../services/http.js';

export const situacoes = Object.freeze({ DISPONIVEL: 'Disponível', EMPRESTADO: 'Emprestado', EM_MANUTENCAO: 'Em manutenção' });
const idValido = id => Number.isInteger(id) && id > 0 && id <= 2147483647;
const textoValido = (value, limit) => typeof value === 'string' && value.trim().length > 0 && [...value.trim()].length <= limit && !value.includes('\0');

export function readTipo(value) {
  if (!idValido(value?.id) || !textoValido(value.nome, 80)) throw new Error('Resposta de tipo inválida.');
  return value;
}

export function readInstrumento(value) {
  if (!idValido(value?.id) || !idValido(value.tipoInstrumentoId)
    || typeof value.identificacao !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(value.identificacao)
    || !Object.hasOwn(situacoes, value.situacao)
    || !(value.observacoes === null || textoValido(value.observacoes, 500))) throw new Error('Resposta de unidade inválida.');
  return value;
}

function readResumo(value) {
  const counts = ['total', 'disponiveis', 'emprestados', 'emManutencao'];
  if (!idValido(value?.tipoInstrumentoId) || !textoValido(value.nome, 80)
    || counts.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0)
    || value.total !== value.disponiveis + value.emprestados + value.emManutencao) throw new Error('Resumo de estoque inválido.');
  return value;
}

function readList(data, key, reader) {
  if (!Array.isArray(data?.[key])) throw new Error('Lista inválida.');
  return data[key].map(reader);
}
export const readTipos = data => readList(data, 'tiposInstrumentos', readTipo);
export const readInstrumentos = data => readList(data, 'instrumentos', readInstrumento);
export const readEstoque = data => readList(data, 'estoque', readResumo);

export function instrumentosPath({ tipoInstrumentoId = '', situacao = '' }) {
  const query = new URLSearchParams();
  if (tipoInstrumentoId) query.set('tipoInstrumentoId', tipoInstrumentoId);
  if (situacao) query.set('situacao', situacao);
  return `/instrumentos${query.size ? `?${query}` : ''}`;
}

export function validateTipo(values) {
  const nome = values.nome.trim();
  return { errors: textoValido(nome, 80) ? {} : { nome: 'Informe um nome com 1 a 80 caracteres.' }, body: { nome } };
}

export function validateInstrumento(values, tipos) {
  const errors = {};
  const tipoInstrumentoId = /^[1-9]\d*$/.test(values.tipoInstrumentoId) ? Number(values.tipoInstrumentoId) : NaN;
  if (!idValido(tipoInstrumentoId) || !tipos.some(tipo => tipo.id === tipoInstrumentoId)) errors.tipoInstrumentoId = 'Selecione um tipo disponível na consulta.';
  const identificacao = values.identificacao.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(identificacao)) errors.identificacao = 'Use de 1 a 40 letras de A a Z, números, hífen ou sublinhado. Comece por letra ou número.';
  const observacoes = values.observacoes.trim();
  if ([...observacoes].length > 500 || observacoes.includes('\0')) errors.observacoes = 'Use até 500 caracteres nas observações.';
  return { errors, body: { tipoInstrumentoId, identificacao: identificacao.toUpperCase(), observacoes: observacoes || null } };
}

export function stockFieldErrors(error) {
  const code = error instanceof HttpError ? error.data?.error?.code : null;
  if (code === 'TIPO_INSTRUMENTO_DUPLICADO') return { nome: 'Já existe um tipo com esse nome, inclusive com outra combinação de maiúsculas e minúsculas.' };
  if (code === 'IDENTIFICACAO_DUPLICADA') return { identificacao: 'Já existe uma unidade com essa identificação.' };
  if (code === 'TIPO_INSTRUMENTO_INVALIDO') return { tipoInstrumentoId: 'Esse tipo não existe mais. Atualize as consultas e selecione outro tipo.' };
  return {};
}

export function stockError(error, operation = 'list') {
  if (error instanceof HttpError) {
    if (error.status === 403) return 'Você não tem permissão para esta operação. Seu perfil foi consultado novamente.';
    if (error.status === 404) return 'O registro não foi encontrado. Atualize as consultas antes de continuar.';
    const code = error.data?.error?.code;
    if (error.status === 409 && code === 'INSTRUMENTO_INDISPONIVEL') return 'A unidade ficou indisponível e seu tipo não pode ser trocado. Feche o formulário e atualize as consultas para conferir a situação atual.';
    if (Object.keys(stockFieldErrors(error)).length) return 'A operação foi recusada. Confira o campo indicado no formulário.';
    if (error.status === 400) return 'A API recusou os dados. Confira os campos e tente novamente.';
  }
  return operation === 'list' ? 'Não foi possível carregar os dados. Verifique sua conexão e tente atualizar as consultas.'
    : 'Não foi possível confirmar a operação. Verifique sua conexão e consulte os registros antes de repetir o envio.';
}
