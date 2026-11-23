import { idValido } from '../validacao/entrada.js';

function validarData(valor, campo) {
  const data = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
  if (!Number.isFinite(data.getTime())) throw new TypeError(`${campo} inválida.`);
  return data;
}

export class Emprestimo {
  #id;
  #integrante;
  #instrumento;
  #retiradaEm;
  #devolucaoEm;

  constructor({ id, integrante, instrumento, retiradaEm, devolucaoEm = null }) {
    if (!idValido(id)) throw new TypeError('Identificação de empréstimo inválida.');
    if (!integrante || !idValido(integrante.id) || typeof integrante.nome !== 'string' || !integrante.nome.trim()) {
      throw new TypeError('Integrante do empréstimo inválido.');
    }
    if (!instrumento || !idValido(instrumento.id) || typeof instrumento.identificacao !== 'string' || !instrumento.identificacao.trim()) {
      throw new TypeError('Instrumento do empréstimo inválido.');
    }

    const retirada = validarData(retiradaEm, 'Data de retirada');
    const devolucao = devolucaoEm === null ? null : validarData(devolucaoEm, 'Data de devolução');
    if (devolucao && devolucao < retirada) throw new TypeError('A devolução não pode ser anterior à retirada.');

    this.#id = id;
    this.#integrante = Object.freeze({ id: integrante.id, nome: integrante.nome.trim() });
    this.#instrumento = Object.freeze({ id: instrumento.id, identificacao: instrumento.identificacao.trim() });
    this.#retiradaEm = retirada;
    this.#devolucaoEm = devolucao;
  }

  get id() { return this.#id; }
  get integrante() { return this.#integrante; }
  get instrumento() { return this.#instrumento; }
  get retiradaEm() { return new Date(this.#retiradaEm.getTime()); }
  get devolucaoEm() { return this.#devolucaoEm ? new Date(this.#devolucaoEm.getTime()) : null; }
  get situacao() { return this.#devolucaoEm === null ? 'ATIVO' : 'DEVOLVIDO'; }

  toJSON() {
    return {
      id: this.#id,
      integrante: this.#integrante,
      instrumento: this.#instrumento,
      retiradaEm: this.#retiradaEm.toISOString(),
      devolucaoEm: this.#devolucaoEm?.toISOString() ?? null,
      situacao: this.situacao,
    };
  }
}
