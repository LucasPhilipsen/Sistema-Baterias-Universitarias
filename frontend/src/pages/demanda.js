import { HttpError } from '../services/http.js';
import { readEnsaio } from './ensaios.js';

export const validId = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const validCount = value => Number.isSafeInteger(value) && value >= 0;
const calculatedFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium',
});

export const displayCalculatedAt = instant => calculatedFormatter.format(new Date(instant));

export function readScheduledEnsaios(data) {
  if (!Array.isArray(data?.ensaios)) throw new Error('Agenda inválida.');
  const ensaios = data.ensaios.map(readEnsaio);
  if (new Set(ensaios.map(item => item.id)).size !== ensaios.length) throw new Error('Agenda inválida.');
  return ensaios.filter(item => item.situacao === 'AGENDADO');
}

export function readDemanda(data, expectedId) {
  const value = data?.demanda;
  if (!validId(expectedId) || value?.ensaioId !== expectedId || !Array.isArray(value.tipos)
    || typeof value.calculadoEm !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value.calculadoEm)
    || !Number.isFinite(Date.parse(value.calculadoEm))
    || new Date(value.calculadoEm).toISOString().slice(0, 19) !== value.calculadoEm.slice(0, 19)) throw new Error('Comparação inválida.');
  const tipos = value.tipos.map(item => {
    if (!validId(item?.tipoInstrumentoId) || typeof item.nome !== 'string' || !item.nome.trim()
      || !['confirmados', 'disponiveis', 'falta'].every(key => validCount(item[key]))) throw new Error('Item de demanda inválido.');
    // A falta é fornecida pelo backend; a interface não refaz o cálculo.
    const { tipoInstrumentoId, nome, confirmados, disponiveis, falta } = item;
    return { tipoInstrumentoId, nome, confirmados, disponiveis, falta };
  });
  if (new Set(tipos.map(item => item.tipoInstrumentoId)).size !== tipos.length) throw new Error('Comparação inválida.');
  return { ensaioId: value.ensaioId, calculadoEm: value.calculadoEm, tipos };
}

export function demandaError(error, operation = 'demanda') {
  if (error instanceof HttpError) {
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (error.status === 403) return 'Você não tem permissão para consultar a demanda. Acesso restrito à diretoria.';
    if (error.status === 404) return 'A comparação deste ensaio não está disponível. Atualize os ensaios e tente novamente.';
    if (error.status === 409) return 'Este ensaio foi cancelado e não possui demanda a comparar. Atualize os ensaios e selecione outro.';
    if (error.status === 400) return 'Não foi possível consultar esse ensaio. Atualize os ensaios e selecione novamente.';
  }
  return operation === 'agenda' ? 'Não foi possível carregar os ensaios. Verifique sua conexão e tente novamente.'
    : 'Não foi possível carregar a comparação. Verifique sua conexão e tente atualizar a comparação.';
}
