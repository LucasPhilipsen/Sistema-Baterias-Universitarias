import { idValido } from '../validacao/entrada.js';

function validarData(valor, campo) {
  const data = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
  if (!Number.isFinite(data.getTime())) throw new TypeError(`${campo} inválida.`);
  return data;
}

export class Manutencao {
  #id;
  #instrumentoId;
  #motivo;
  #abertaEm;
  #encerradaEm;

  constructor({ id, instrumentoId, motivo, abertaEm, encerradaEm = null }) {
    if (!idValido(id) || !idValido(instrumentoId)) throw new TypeError('Identificação de manutenção inválida.');
    if (typeof motivo !== 'string' || !motivo.trim() || motivo.includes('\u0000') || [...motivo.trim()].length > 500) {
      throw new TypeError('O motivo deve conter de 1 a 500 caracteres válidos.');
    }
    const aberta = validarData(abertaEm, 'Data de abertura');
    const encerrada = encerradaEm === null ? null : validarData(encerradaEm, 'Data de encerramento');
    if (encerrada && encerrada < aberta) throw new TypeError('O encerramento não pode ser anterior à abertura.');

    this.#id = id;
    this.#instrumentoId = instrumentoId;
    this.#motivo = motivo.trim();
    this.#abertaEm = aberta;
    this.#encerradaEm = encerrada;
  }

  get id() { return this.#id; }
  get instrumentoId() { return this.#instrumentoId; }
  get motivo() { return this.#motivo; }
  get abertaEm() { return new Date(this.#abertaEm.getTime()); }
  get encerradaEm() { return this.#encerradaEm ? new Date(this.#encerradaEm.getTime()) : null; }
  get situacao() { return this.#encerradaEm === null ? 'ABERTA' : 'ENCERRADA'; }

  toJSON() {
    return {
      id: this.#id,
      instrumentoId: this.#instrumentoId,
      motivo: this.#motivo,
      abertaEm: this.#abertaEm.toISOString(),
      encerradaEm: this.#encerradaEm?.toISOString() ?? null,
      situacao: this.situacao,
    };
  }
}
