import { lerFiltros } from '../validacao/entrada.js';

const QUANTIDADES = ['total', 'disponiveis', 'emprestados', 'emManutencao'];

export class EstoqueService {
  constructor(instrumentos) {
    this.instrumentos = instrumentos;
  }

  // O cálculo é feito no banco; a conversão garante inteiros JSON mesmo que o driver devolva texto.
  async resumir(filtros) {
    lerFiltros(filtros);
    const linhas = await this.instrumentos.resumirPorTipo();
    return linhas.map(linha => ({
      tipoInstrumentoId: Number(linha.tipoInstrumentoId),
      nome: linha.nome,
      ...Object.fromEntries(QUANTIDADES.map(campo => [campo, Number(linha[campo])])),
    }));
  }
}
