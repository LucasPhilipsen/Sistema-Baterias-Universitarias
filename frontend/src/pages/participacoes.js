import { HttpError } from '../services/http.js';

const validId = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const validInstant = value => typeof value === 'string' && /Z$/.test(value) && Number.isFinite(Date.parse(value));

export function readParticipacao(data, ensaioId) {
  if (!data || !Object.hasOwn(data, 'participacao') || !validId(ensaioId)) throw new Error('Participação inválida.');
  const value = data.participacao;
  if (value === null) return null;
  if (!validId(value?.id) || value.ensaioId !== ensaioId || !validId(value.tipoInstrumentoId)
    || typeof value.tipoInstrumentoNome !== 'string' || !value.tipoInstrumentoNome.trim()
    || !validInstant(value.confirmadoEm) || !(value.atualizadoEm === null || validInstant(value.atualizadoEm))) throw new Error('Participação inválida.');
  const { id, tipoInstrumentoId, tipoInstrumentoNome, confirmadoEm, atualizadoEm } = value;
  return { id, ensaioId, tipoInstrumentoId, tipoInstrumentoNome, confirmadoEm, atualizadoEm };
}

export function validateParticipacao(value, tipos) {
  const tipoInstrumentoId = /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  return validId(tipoInstrumentoId) && tipos.some(tipo => tipo.id === tipoInstrumentoId)
    ? { body: { tipoInstrumentoId }, error: '' }
    : { body: null, error: 'Selecione um tipo de instrumento da lista.' };
}

export function participacaoError(error, operation = 'read') {
  if (error instanceof HttpError) {
    const code = error.data?.error?.code;
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (code === 'ORIGEM_INVALIDA') return 'O servidor recusou a origem do acesso. Abra o sistema pelo endereço configurado.';
    if (error.status === 403) return 'Você não tem permissão para esta operação. Sua conta foi consultada novamente.';
    if (code === 'TIPO_INSTRUMENTO_INVALIDO') return 'Este tipo não está mais disponível. Atualize os tipos e escolha outro.';
    if (error.status === 400) return 'Confira o tipo selecionado. A participação não pôde ser registrada com esses dados.';
    if (error.status === 404) return 'Não foi possível encontrar a participação deste ensaio. Atualize a agenda e tente consultar novamente.';
    if (code === 'ENSAIO_CANCELADO') return 'Este ensaio foi cancelado. Não é possível alterar a participação. Atualize a agenda.';
    if (error.status === 409) return 'Sua participação já existe ou foi alterada. Atualize sua participação antes de tentar novamente.';
    if (error.status === 415) return 'Não foi possível enviar a participação. Recarregue a página e tente novamente.';
  }
  if (operation === 'tipos') return 'Não foi possível carregar os tipos de instrumento. Tente atualizar os tipos.';
  return operation === 'save' ? 'Não foi possível confirmar a alteração. Atualize sua participação antes de repetir o envio.'
    : 'Não foi possível consultar sua participação. Verifique a conexão e tente novamente.';
}
