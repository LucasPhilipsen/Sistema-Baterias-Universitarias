import { Instrumento, SituacaoInstrumento } from '../entities/Instrumento.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { criarComDados, dadosInvalidos, lerCorpo, lerFiltros, lerIdUrl } from '../validacao/entrada.js';

const naoEncontrado = () => new ErroAplicacao(404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado.');

export class InstrumentoService {
  constructor(instrumentos) {
    this.instrumentos = instrumentos;
  }

  // Um tipo válido, mas inexistente, no filtro resulta em lista vazia.
  async listar(query) {
    const filtros = lerFiltros(query, ['tipoInstrumentoId', 'situacao']);
    const tipoInstrumentoId = filtros.tipoInstrumentoId === undefined ? null : lerIdUrl(filtros.tipoInstrumentoId);
    const situacao = filtros.situacao ?? null;
    if (situacao !== null && !Object.values(SituacaoInstrumento).includes(situacao)) {
      throw dadosInvalidos('Situação de instrumento inválida.');
    }
    return this.instrumentos.listar({ tipoInstrumentoId, situacao });
  }

  async consultar(idUrl) {
    const instrumento = await this.instrumentos.buscarPorId(lerIdUrl(idUrl));
    if (!instrumento) throw naoEncontrado();
    return instrumento;
  }

  // A situação não é aceita no corpo: toda unidade nova começa DISPONIVEL.
  async cadastrar(corpo) {
    return this.instrumentos.criar(this.#lerInstrumento(corpo));
  }

  async atualizar(idUrl, corpo) {
    const id = lerIdUrl(idUrl);
    const instrumento = await this.instrumentos.atualizar(id, this.#lerInstrumento(corpo));
    if (!instrumento) throw naoEncontrado();
    return instrumento;
  }

  #lerInstrumento(corpo) {
    const { tipoInstrumentoId, identificacao, observacoes } = lerCorpo(corpo, ['tipoInstrumentoId', 'identificacao', 'observacoes']);
    return criarComDados(() => new Instrumento({ tipoInstrumentoId, identificacao, observacoes }));
  }
}
