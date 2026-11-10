import { contarCaracteres, contemCaractereNulo, idValido } from '../validacao/entrada.js';

export class TipoInstrumento {
  #id;
  #nome;

  constructor({ id = null, nome }) {
    if (id !== null && !idValido(id)) {
      throw new TypeError('Identificação de tipo de instrumento inválida.');
    }
    const nomeNormalizado = typeof nome === 'string' ? nome.trim() : '';
    if (!nomeNormalizado || contarCaracteres(nomeNormalizado) > 80) {
      throw new TypeError('Nome do tipo deve ter entre 1 e 80 caracteres.');
    }
    if (contemCaractereNulo(nomeNormalizado)) {
      throw new TypeError('Nome do tipo contém caracteres não permitidos.');
    }

    this.#id = id;
    // A grafia informada é preservada; a comparação sem diferenciar maiúsculas fica no banco.
    this.#nome = nomeNormalizado;
  }

  get id() { return this.#id; }
  get nome() { return this.#nome; }

  toJSON() {
    return { id: this.#id, nome: this.#nome };
  }
}
