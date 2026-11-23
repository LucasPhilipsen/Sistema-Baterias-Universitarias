import { idValido } from '../validacao/entrada.js';

const quantidadeValida = valor => Number.isSafeInteger(valor) && valor >= 0;

// Linha da comparação de um ensaio: confirmações ativas de um tipo diante das unidades disponíveis agora.
// É uma previsão sobre o estoque atual; não reserva unidades nem projeta a disponibilidade futura.
export class ItemDemanda {
  #tipoInstrumentoId;
  #nome;
  #confirmados;
  #disponiveis;

  constructor({ tipoInstrumentoId, nome, confirmados, disponiveis }) {
    if (!idValido(tipoInstrumentoId)) {
      throw new TypeError('Identificação de tipo de instrumento inválida.');
    }
    if (typeof nome !== 'string' || !nome) {
      throw new TypeError('Nome do tipo de instrumento inválido.');
    }
    if (!quantidadeValida(confirmados) || !quantidadeValida(disponiveis)) {
      throw new TypeError('Quantidades da demanda devem ser inteiros não negativos.');
    }

    this.#tipoInstrumentoId = tipoInstrumentoId;
    this.#nome = nome;
    this.#confirmados = confirmados;
    this.#disponiveis = disponiveis;
  }

  get tipoInstrumentoId() { return this.#tipoInstrumentoId; }
  get nome() { return this.#nome; }
  get confirmados() { return this.#confirmados; }
  get disponiveis() { return this.#disponiveis; }

  get falta() {
    return Math.max(0, this.#confirmados - this.#disponiveis);
  }

  toJSON() {
    return {
      tipoInstrumentoId: this.#tipoInstrumentoId,
      nome: this.#nome,
      confirmados: this.#confirmados,
      disponiveis: this.#disponiveis,
      falta: this.falta,
    };
  }
}
