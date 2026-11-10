export const SituacaoEnsaio = Object.freeze({
  AGENDADO: 'AGENDADO',
  CANCELADO: 'CANCELADO',
});

const ISO_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

export function validarEConverterInstante(valor) {
  if (typeof valor !== 'string') {
    throw new TypeError('A data e hora de início deve ser uma string no formato ISO 8601.');
  }

  const match = valor.match(ISO_DATETIME_REGEX);
  if (!match) {
    throw new TypeError('A data e hora de início deve conter fuso horário explícito (ex.: 2026-11-10T19:00:00-03:00 ou Z).');
  }

  const [_, yearStr, monthStr, dayStr, hourStr, minStr, secStr, fracStr, tzStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = parseInt(secStr, 10);

  if (month < 1 || month > 12) {
    throw new TypeError('Mês inválido na data de início.');
  }

  const ehBissexto = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const diasPorMes = [0, 31, ehBissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (day < 1 || day > diasPorMes[month]) {
    throw new TypeError('Data inexistente no calendário.');
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new TypeError('Horário inválido na data de início.');
  }

  if (tzStr !== 'Z') {
    const tzHour = parseInt(tzStr.slice(1, 3), 10);
    const tzMin = parseInt(tzStr.slice(4, 6), 10);
    if (tzHour > 14 || tzMin > 59) {
      throw new TypeError('Deslocamento de fuso horário inválido.');
    }
  }

  const date = new Date(valor);
  if (isNaN(date.getTime())) {
    throw new TypeError('Data e hora inválidas.');
  }

  return date;
}

export class Ensaio {
  #id;
  #inicioEm;
  #local;
  #descricao;
  #situacao;

  constructor({ id = null, inicioEm, local, descricao = null, situacao = SituacaoEnsaio.AGENDADO }) {
    if (id !== null && (!Number.isInteger(id) || id < 1 || id > 2147483647)) {
      throw new TypeError('Identificação de ensaio inválida.');
    }

    if (!inicioEm) {
      throw new TypeError('Data e hora de início obrigatória.');
    }

    let inicioEmDate;
    if (inicioEm instanceof Date) {
      if (isNaN(inicioEm.getTime())) {
        throw new TypeError('Data e hora de início inválida.');
      }
      inicioEmDate = inicioEm;
    } else if (typeof inicioEm === 'string') {
      inicioEmDate = validarEConverterInstante(inicioEm);
    } else {
      throw new TypeError('Data e hora de início deve ser uma data válida ou string ISO 8601.');
    }

    if (typeof local !== 'string' || !local.trim() || local.trim().length > 160) {
      throw new TypeError('Local deve ter entre 1 e 160 caracteres.');
    }

    let descricaoNormalizada = null;
    if (descricao !== null && descricao !== undefined) {
      if (typeof descricao !== 'string') {
        throw new TypeError('Descrição deve ser um texto de até 1000 caracteres.');
      }
      const trimmed = descricao.trim();
      if (trimmed.length > 1000) {
        throw new TypeError('Descrição deve ter no máximo 1000 caracteres.');
      }
      descricaoNormalizada = trimmed.length > 0 ? trimmed : null;
    }

    if (!Object.values(SituacaoEnsaio).includes(situacao)) {
      throw new TypeError('Situação de ensaio inválida.');
    }

    this.#id = id;
    this.#inicioEm = inicioEmDate;
    this.#local = local.trim();
    this.#descricao = descricaoNormalizada;
    this.#situacao = situacao;
  }

  get id() { return this.#id; }
  get inicioEm() { return this.#inicioEm.toISOString(); }
  get inicioEmDate() { return this.#inicioEm; }
  get local() { return this.#local; }
  get descricao() { return this.#descricao; }
  get situacao() { return this.#situacao; }

  estaCancelado() {
    return this.#situacao === SituacaoEnsaio.CANCELADO;
  }

  toJSON() {
    return {
      id: this.#id,
      inicioEm: this.#inicioEm.toISOString(),
      local: this.#local,
      descricao: this.#descricao,
      situacao: this.#situacao,
    };
  }
}

