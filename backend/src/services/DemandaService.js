import { ItemDemanda } from '../entities/ItemDemanda.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { lerFiltros, lerIdUrl } from '../validacao/entrada.js';

export class DemandaService {
  // `ensaios` é o repositório do módulo de ensaios; `demanda` faz as contagens por tipo.
  constructor({ ensaios, demanda, agora = () => new Date() }) {
    this.ensaios = ensaios;
    this.demanda = demanda;
    this.agora = agora;
  }

  // O ensaio é conferido antes da contagem para diferenciar 404 de 409. Ensaio cancelado
  // não recebe novas confirmações, então não há demanda a comparar.
  async consultar(idUrl, query) {
    const ensaioId = lerIdUrl(idUrl);
    lerFiltros(query);

    const ensaio = await this.ensaios.buscarPorId(ensaioId);
    if (!ensaio) {
      throw new ErroAplicacao(404, 'ENSAIO_NAO_ENCONTRADO', 'Ensaio não encontrado.');
    }
    if (ensaio.estaCancelado()) {
      throw new ErroAplicacao(409, 'ENSAIO_CANCELADO', 'Ensaio cancelado não possui demanda a comparar.');
    }

    const calculadoEm = this.agora().toISOString();
    const linhas = await this.demanda.contarPorTipo(ensaioId);
    // A conversão garante inteiros JSON mesmo que o driver devolva as agregações como texto.
    const tipos = linhas.map(linha => new ItemDemanda({
      tipoInstrumentoId: Number(linha.tipoInstrumentoId),
      nome: linha.nome,
      confirmados: Number(linha.confirmados),
      disponiveis: Number(linha.disponiveis),
    }));

    return { ensaioId, calculadoEm, tipos };
  }
}
