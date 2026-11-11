import { HttpError } from '../services/http.js';

const timeZone = 'America/Sao_Paulo';
const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const displayFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone, dateStyle: 'full', timeStyle: 'short',
});

export function dateFields(instant) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return { data: `${parts.year}-${parts.month}-${parts.day}`, horario: `${parts.hour}:${parts.minute}` };
}

export const displayDate = instant => displayFormatter.format(new Date(instant));

export function toInstant(data, horario) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(horario)) throw new Error('Informe uma data e um horário válidos.');
  const [year, month, day] = data.split('-').map(Number);
  const [hour, minute] = horario.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const calendar = new Date(wall);
  if (year < 1970 || year > 9999 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error('Informe uma data e um horário válidos.');

  // Obtém os deslocamentos dos dois lados de uma eventual transição de horário de verão.
  const offsets = new Set([-36, 0, 36].map(hours => {
    const sample = wall + hours * 3_600_000;
    const parts = Object.fromEntries(partsFormatter.formatToParts(new Date(sample)).map(part => [part.type, part.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - sample;
  }));
  const candidates = [...offsets].map(offset => wall - offset).filter(instant => {
    const fields = dateFields(instant);
    return fields.data === data && fields.horario === horario && new Date(instant).getUTCFullYear() <= 9999;
  }).sort((a, b) => a - b);
  if (!candidates.length) throw new Error('Esse horário não existe em America/Sao_Paulo. Escolha outro horário.');
  // Em uma hora histórica repetida, utiliza a primeira ocorrência.
  return new Date(candidates[0]).toISOString();
}

export function validateForm(values) {
  const errors = {};
  let inicioEm;
  try { inicioEm = toInstant(values.data, values.horario); }
  catch (error) { errors.data = error.message; }
  const local = values.local.trim();
  const descricao = values.descricao.trim();
  if (!local || local.length > 160 || local.includes('\0')) errors.local = 'Informe um local com 1 a 160 caracteres.';
  if (descricao.length > 1000 || descricao.includes('\0')) errors.descricao = 'Use até 1000 caracteres na descrição.';
  return { errors, body: { inicioEm, local, descricao: descricao || null } };
}

export function readEnsaio(ensaio) {
  if (!Number.isInteger(ensaio?.id) || ensaio.id < 1 || ensaio.id > 2147483647
    || typeof ensaio.inicioEm !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(ensaio.inicioEm) || !Number.isFinite(Date.parse(ensaio.inicioEm))
    || typeof ensaio.local !== 'string' || !ensaio.local.trim()
    || !(ensaio.descricao === null || typeof ensaio.descricao === 'string')
    || !['AGENDADO', 'CANCELADO'].includes(ensaio.situacao)) throw new Error('Resposta de ensaio inválida.');
  return ensaio;
}

export function ensaioError(error, operation) {
  if (error instanceof HttpError) {
    if (error.status === 403) return 'Você não tem permissão para esta operação. Seu perfil foi consultado novamente.';
    if (error.status === 400) return 'Confira a data, o horário, o local e a descrição. A API recusou os dados informados.';
    if (error.status === 404) return 'Este ensaio não foi encontrado. Atualize a agenda antes de continuar.';
    if (error.status === 409 && error.data?.error?.code === 'ENSAIO_CANCELADO') return 'Este ensaio já foi cancelado e não pode ser editado. Atualize a agenda.';
  }
  return operation === 'list'
    ? 'Não foi possível carregar a agenda. Verifique sua conexão e tente novamente.'
    : 'Não foi possível confirmar a operação. Verifique sua conexão e atualize a agenda antes de tentar novamente.';
}
