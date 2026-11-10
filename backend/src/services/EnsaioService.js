import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { SituacaoEnsaio } from '../entities/Ensaio.js';

const ISO_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

export function validarEConverterInicioEm(valor) {
  if (typeof valor !== 'string') {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'A data e hora de início deve ser informada como texto ISO 8601.');
  }

  const match = valor.match(ISO_DATETIME_REGEX);
  if (!match) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'A data e hora de início deve conter fuso horário explícito (ex.: 2026-11-10T19:00:00-03:00 ou Z).');
  }

  const [_, yearStr, monthStr, dayStr, hourStr, minStr, secStr, fracStr, tzStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = parseInt(secStr, 10);

  if (month < 1 || month > 12) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Mês inválido na data de início.');
  }

  const ehBissexto = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const diasPorMes = [0, 31, ehBissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (day < 1 || day > diasPorMes[month]) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Data inexistente no calendário.');
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Horário inválido na data de início.');
  }

  if (tzStr !== 'Z') {
    const tzHour = parseInt(tzStr.slice(1, 3), 10);
    const tzMin = parseInt(tzStr.slice(4, 6), 10);
    if (tzHour > 14 || tzMin > 59) {
      throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Deslocamento de fuso horário inválido.');
    }
  }

  const date = new Date(valor);
  if (isNaN(date.getTime())) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Data e hora inválidas.');
  }

  return date;
}

export function validarIdParam(idParam) {
  if (typeof idParam !== 'string' || !/^[1-9]\d{0,9}$/.test(idParam)) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Identificador de ensaio inválido.');
  }
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Identificador de ensaio inválido.');
  }
  return id;
}

export function validarObjetoJson(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'O corpo da requisição deve ser um objeto JSON.');
  }
}

export function validarCamposPermitidos(body, camposPermitidos) {
  validarObjetoJson(body);
  const chaves = Object.keys(body);
  for (const chave of chaves) {
    if (!camposPermitidos.includes(chave)) {
      throw new ErroAplicacao(400, 'DADOS_INVALIDOS', `Campo não permitido ou desconhecido: ${chave}.`);
    }
  }
}

export function validarDadosEnsaio(dados) {
  validarCamposPermitidos(dados, ['inicioEm', 'local', 'descricao']);

  if (!('inicioEm' in dados)) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'A data e hora de início é obrigatória.');
  }
  const inicioEm = validarEConverterInicioEm(dados.inicioEm);

  if (!('local' in dados) || typeof dados.local !== 'string' || !dados.local.trim() || dados.local.trim().length > 160) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'O local é obrigatório e deve ter entre 1 e 160 caracteres.');
  }
  const local = dados.local.trim();

  let descricao = null;
  if ('descricao' in dados && dados.descricao !== null && dados.descricao !== undefined) {
    if (typeof dados.descricao !== 'string') {
      throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'A descrição deve ser um texto de até 1000 caracteres.');
    }
    const trimmed = dados.descricao.trim();
    if (trimmed.length > 1000) {
      throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'A descrição deve ter no máximo 1000 caracteres.');
    }
    descricao = trimmed.length > 0 ? trimmed : null;
  }

  return { inicioEm, local, descricao };
}

export class EnsaioService {
  constructor({ ensaios }) {
    this.ensaios = ensaios;
  }

  async listar({ situacao } = {}) {
    if (situacao !== undefined && !Object.values(SituacaoEnsaio).includes(situacao)) {
      throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'A situação deve ser AGENDADO ou CANCELADO.');
    }
    return this.ensaios.listar({ situacao });
  }

  async buscarPorId(id) {
    const idValido = typeof id === 'number' ? id : validarIdParam(String(id));
    const ensaio = await this.ensaios.buscarPorId(idValido);
    if (!ensaio) {
      throw new ErroAplicacao(404, 'ENSAIO_NAO_ENCONTRADO', 'Ensaio não encontrado.');
    }
    return ensaio;
  }

  async cadastrar(dados) {
    const dadosValidados = validarDadosEnsaio(dados);
    return this.ensaios.criar(dadosValidados);
  }

  async editar(id, dados) {
    const idValido = typeof id === 'number' ? id : validarIdParam(String(id));
    const dadosValidados = validarDadosEnsaio(dados);
    const resultado = await this.ensaios.atualizar(idValido, dadosValidados);
    if (!resultado.encontrado) {
      throw new ErroAplicacao(404, 'ENSAIO_NAO_ENCONTRADO', 'Ensaio não encontrado.');
    }
    if (resultado.cancelado) {
      throw new ErroAplicacao(409, 'ENSAIO_CANCELADO', 'Não é possível editar um ensaio cancelado.');
    }
    return resultado.ensaio;
  }

  async cancelar(id) {
    const idValido = typeof id === 'number' ? id : validarIdParam(String(id));
    const ensaio = await this.ensaios.cancelar(idValido);
    if (!ensaio) {
      throw new ErroAplicacao(404, 'ENSAIO_NAO_ENCONTRADO', 'Ensaio não encontrado.');
    }
    return ensaio;
  }
}

