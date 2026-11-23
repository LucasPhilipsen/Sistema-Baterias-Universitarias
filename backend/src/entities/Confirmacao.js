import { idValido } from '../validacao/entrada.js';

export class Confirmacao {
  #id;
  #ensaioId;
  #tipoInstrumentoId;
  #tipoInstrumentoNome;
  #confirmadoEm;
  #atualizadoEm;

  constructor({ id = null, ensaioId, tipoInstrumentoId, tipoInstrumentoNome, confirmadoEm, atualizadoEm = null }) {
    if (id !== null && !idValido(id)) {
      throw new TypeError('Identificação de confirmação inválida.');
    }
    if (!idValido(ensaioId)) {
      throw new TypeError('Identificação de ensaio inválida.');
    }
    if (!idValido(tipoInstrumentoId)) {
      throw new TypeError('Identificação de tipo de instrumento inválida.');
    }
    if (typeof tipoInstrumentoNome !== 'string' || !tipoInstrumentoNome.trim()) {
      throw new TypeError('Nome do tipo de instrumento obrigatório.');
    }
    let confirmadoEmDate;
    if (confirmadoEm instanceof Date) {
      confirmadoEmDate = confirmadoEm;
    } else if (typeof confirmadoEm === 'string') {
      confirmadoEmDate = new Date(confirmadoEm);
    }
    if (!confirmadoEmDate || isNaN(confirmadoEmDate.getTime())) {
      throw new TypeError('Data de confirmação inválida.');
    }

    let atualizadoEmDate = null;
    if (atualizadoEm !== null && atualizadoEm !== undefined) {
      if (atualizadoEm instanceof Date) {
        atualizadoEmDate = atualizadoEm;
      } else if (typeof atualizadoEm === 'string') {
        atualizadoEmDate = new Date(atualizadoEm);
      } else {
        throw new TypeError('Data de atualização inválida.');
      }
      if (isNaN(atualizadoEmDate.getTime())) {
        throw new TypeError('Data de atualização inválida.');
      }
    }

    this.#id = id;
    this.#ensaioId = ensaioId;
    this.#tipoInstrumentoId = tipoInstrumentoId;
    this.#tipoInstrumentoNome = tipoInstrumentoNome.trim();
    this.#confirmadoEm = confirmadoEmDate;
    this.#atualizadoEm = atualizadoEmDate;
  }

  get id() { return this.#id; }
  get ensaioId() { return this.#ensaioId; }
  get tipoInstrumentoId() { return this.#tipoInstrumentoId; }
  get tipoInstrumentoNome() { return this.#tipoInstrumentoNome; }
  get confirmadoEm() { return this.#confirmadoEm.toISOString(); }
  get atualizadoEm() { return this.#atualizadoEm ? this.#atualizadoEm.toISOString() : null; }

  toJSON() {
    return {
      id: this.#id,
      ensaioId: this.#ensaioId,
      tipoInstrumentoId: this.#tipoInstrumentoId,
      tipoInstrumentoNome: this.#tipoInstrumentoNome,
      confirmadoEm: this.#confirmadoEm.toISOString(),
      atualizadoEm: this.#atualizadoEm ? this.#atualizadoEm.toISOString() : null,
    };
  }
}
