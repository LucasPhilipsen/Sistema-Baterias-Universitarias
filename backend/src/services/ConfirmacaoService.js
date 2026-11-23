import { ErroAplicacao } from '../errors/ErroAplicacao.js';

export function validarIdEnsaioParam(idParam) {
  if (typeof idParam !== 'string' || !/^[1-9]\d{0,9}$/.test(idParam)) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Identificador de ensaio inválido.');
  }
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Identificador de ensaio inválido.');
  }
  return id;
}

export function validarSemParametrosConsulta(query) {
  const chaves = Object.keys(query);
  if (chaves.length > 0) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', `Parâmetro de consulta não permitido: ${chaves[0]}.`);
  }
}

export function validarCorpoConfirmacao(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'O corpo da requisição deve ser um objeto JSON.');
  }
  const camposPermitidos = ['tipoInstrumentoId'];
  for (const chave of Object.keys(body)) {
    if (!camposPermitidos.includes(chave)) {
      throw new ErroAplicacao(400, 'DADOS_INVALIDOS', `Campo não permitido ou desconhecido: ${chave}.`);
    }
  }
  if (!('tipoInstrumentoId' in body)) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'O campo tipoInstrumentoId é obrigatório.');
  }
  const tipoId = body.tipoInstrumentoId;
  if (!Number.isInteger(tipoId) || tipoId < 1 || tipoId > 2147483647) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'O tipoInstrumentoId deve ser um inteiro positivo.');
  }
  return tipoId;
}

export class ConfirmacaoService {
  constructor({ confirmacoes }) {
    this.confirmacoes = confirmacoes;
  }

  async consultar(ensaioId, usuarioId) {
    const resultado = await this.confirmacoes.buscarAtiva(ensaioId, usuarioId);
    if (resultado && resultado.status === 'ENSAIO_NAO_ENCONTRADO') {
      throw new ErroAplicacao(404, 'ENSAIO_NAO_ENCONTRADO', 'Ensaio não encontrado.');
    }
    return resultado ? resultado.confirmacao : null;
  }

  async confirmar(ensaioId, usuarioId, tipoInstrumentoId) {
    const resultado = await this.confirmacoes.confirmar(ensaioId, usuarioId, tipoInstrumentoId);

    if (resultado.status === 'ENSAIO_NAO_ENCONTRADO') {
      throw new ErroAplicacao(404, 'ENSAIO_NAO_ENCONTRADO', 'Ensaio não encontrado.');
    }
    if (resultado.status === 'ENSAIO_CANCELADO') {
      throw new ErroAplicacao(409, 'ENSAIO_CANCELADO', 'Não é possível confirmar participação em um ensaio cancelado.');
    }
    if (resultado.status === 'TIPO_INSTRUMENTO_INVALIDO') {
      throw new ErroAplicacao(400, 'TIPO_INSTRUMENTO_INVALIDO', 'O tipo de instrumento informado não existe.');
    }

    return resultado.confirmacao;
  }

  async cancelar(ensaioId, usuarioId) {
    const resultado = await this.confirmacoes.cancelar(ensaioId, usuarioId);

    if (resultado.status === 'ENSAIO_NAO_ENCONTRADO') {
      throw new ErroAplicacao(404, 'ENSAIO_NAO_ENCONTRADO', 'Ensaio não encontrado.');
    }
    if (resultado.status === 'ENSAIO_CANCELADO') {
      throw new ErroAplicacao(409, 'ENSAIO_CANCELADO', 'Não é possível cancelar participação em um ensaio cancelado.');
    }
  }

  async demandaAtivas(ensaioId) {
    return this.confirmacoes.demandaAtivas(ensaioId);
  }
}
