import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { lerCorpo, lerFiltros, lerIdUrl } from '../validacao/entrada.js';

const motivoInvalido = () => new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Informe um motivo de 1 a 500 caracteres.');

export class ManutencaoService {
  constructor(manutencoes) {
    this.manutencoes = manutencoes;
  }

  async listar(instrumentoIdUrl, query) {
    const instrumentoId = lerIdUrl(instrumentoIdUrl);
    lerFiltros(query);
    return this.manutencoes.listarPorInstrumento(instrumentoId);
  }

  async abrir(instrumentoIdUrl, corpo, query) {
    const instrumentoId = lerIdUrl(instrumentoIdUrl);
    lerFiltros(query);
    const { motivo } = lerCorpo(corpo, ['motivo']);
    if (typeof motivo !== 'string') throw motivoInvalido();
    const normalizado = motivo.trim();
    if (!normalizado || normalizado.includes('\u0000') || [...normalizado].length > 500) throw motivoInvalido();
    return this.manutencoes.abrir(instrumentoId, normalizado);
  }

  async encerrar(instrumentoIdUrl, manutencaoIdUrl, corpo, query) {
    const instrumentoId = lerIdUrl(instrumentoIdUrl);
    const manutencaoId = lerIdUrl(manutencaoIdUrl);
    lerFiltros(query);
    lerCorpo(corpo, []);
    return this.manutencoes.encerrar(instrumentoId, manutencaoId);
  }
}
