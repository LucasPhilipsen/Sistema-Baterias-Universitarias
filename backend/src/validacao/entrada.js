import { ErroAplicacao } from '../errors/ErroAplicacao.js';

export const ID_MAXIMO = 2147483647;

export const idValido = valor => Number.isInteger(valor) && valor >= 1 && valor <= ID_MAXIMO;

// Conta caracteres (code points), como o varchar do PostgreSQL, e não unidades UTF-16.
export const contarCaracteres = texto => [...texto].length;

export const dadosInvalidos = message => new ErroAplicacao(400, 'DADOS_INVALIDOS', message);

export function lerCorpo(corpo, camposPermitidos) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw dadosInvalidos('Envie os dados como um objeto JSON.');
  }
  if (Object.keys(corpo).some(campo => !camposPermitidos.includes(campo))) {
    throw dadosInvalidos('A requisição contém campos não permitidos.');
  }
  return corpo;
}

export function lerIdUrl(valor) {
  const id = typeof valor === 'string' && /^[0-9]{1,10}$/.test(valor) ? Number(valor) : NaN;
  if (!idValido(id)) throw dadosInvalidos('Identificação inválida.');
  return id;
}

export function lerFiltros(query, filtrosPermitidos = []) {
  const filtros = {};
  for (const [nome, valor] of Object.entries(query ?? {})) {
    if (!filtrosPermitidos.includes(nome)) throw dadosInvalidos('A consulta contém filtros não permitidos.');
    if (typeof valor !== 'string') throw dadosInvalidos('Informe cada filtro uma única vez.');
    filtros[nome] = valor;
  }
  return filtros;
}

// As entidades sinalizam dados inválidos com TypeError; na API, eles viram DADOS_INVALIDOS.
export function criarComDados(criar) {
  try {
    return criar();
  } catch (erro) {
    if (erro instanceof TypeError) throw dadosInvalidos(erro.message);
    throw erro;
  }
}
