import { contarCaracteres, contemCaractereNulo, idValido } from '../validacao/entrada.js';

export const SituacaoInstrumento = Object.freeze({
  DISPONIVEL: 'DISPONIVEL',
  EMPRESTADO: 'EMPRESTADO',
  EM_MANUTENCAO: 'EM_MANUTENCAO',
});

// Valida antes de converter para maiúsculas: caracteres como "ı" ou "ſ" viram letras ASCII em toUpperCase().
const formatoIdentificacao = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

export class Instrumento {
  #id;
  #tipoInstrumentoId;
  #identificacao;
  #situacao;
  #observacoes;

  constructor({ id = null, tipoInstrumentoId, identificacao, situacao = SituacaoInstrumento.DISPONIVEL, observacoes = null }) {
    if (id !== null && !idValido(id)) {
      throw new TypeError('Identificação de instrumento inválida.');
    }
    if (!idValido(tipoInstrumentoId)) {
      throw new TypeError('Informe o tipo do instrumento por um identificador inteiro válido.');
    }
    const identificacaoNormalizada = typeof identificacao === 'string' ? identificacao.trim() : '';
    if (!formatoIdentificacao.test(identificacaoNormalizada)) {
      throw new TypeError('A identificação deve ter de 1 a 40 caracteres: letras de A a Z, dígitos, "_" ou "-", começando por letra ou dígito.');
    }
    if (!Object.values(SituacaoInstrumento).includes(situacao)) {
      throw new TypeError('Situação de instrumento inválida.');
    }
    if (observacoes !== null && observacoes !== undefined && typeof observacoes !== 'string') {
      throw new TypeError('Observações devem ser texto.');
    }
    const observacoesNormalizadas = observacoes?.trim() || null;
    if (observacoesNormalizadas && contarCaracteres(observacoesNormalizadas) > 500) {
      throw new TypeError('Observações devem ter até 500 caracteres.');
    }
    if (observacoesNormalizadas && contemCaractereNulo(observacoesNormalizadas)) {
      throw new TypeError('Observações contêm caracteres não permitidos.');
    }

    this.#id = id;
    this.#tipoInstrumentoId = tipoInstrumentoId;
    this.#identificacao = identificacaoNormalizada.toUpperCase();
    this.#situacao = situacao;
    this.#observacoes = observacoesNormalizadas;
  }

  get id() { return this.#id; }
  get tipoInstrumentoId() { return this.#tipoInstrumentoId; }
  get identificacao() { return this.#identificacao; }
  get situacao() { return this.#situacao; }
  get observacoes() { return this.#observacoes; }

  estaDisponivel() {
    return this.#situacao === SituacaoInstrumento.DISPONIVEL;
  }

  toJSON() {
    return {
      id: this.#id,
      tipoInstrumentoId: this.#tipoInstrumentoId,
      identificacao: this.#identificacao,
      situacao: this.#situacao,
      observacoes: this.#observacoes,
    };
  }
}
