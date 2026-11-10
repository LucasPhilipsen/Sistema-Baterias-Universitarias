import { TipoInstrumento } from '../entities/TipoInstrumento.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { criarComDados, lerCorpo, lerFiltros, lerIdUrl } from '../validacao/entrada.js';

const naoEncontrado = () => new ErroAplicacao(404, 'TIPO_INSTRUMENTO_NAO_ENCONTRADO', 'Tipo de instrumento não encontrado.');

// Nenhuma rota de tipos aceita parâmetros de consulta: os desconhecidos são recusados com 400.
export class TipoInstrumentoService {
  constructor(tipos) {
    this.tipos = tipos;
  }

  async listar(query) {
    lerFiltros(query);
    return this.tipos.listar();
  }

  async consultar(idUrl, query) {
    const id = lerIdUrl(idUrl);
    lerFiltros(query);
    const tipo = await this.tipos.buscarPorId(id);
    if (!tipo) throw naoEncontrado();
    return tipo;
  }

  async cadastrar(corpo, query) {
    lerFiltros(query);
    return this.tipos.criar(this.#lerTipo(corpo));
  }

  async atualizar(idUrl, corpo, query) {
    const id = lerIdUrl(idUrl);
    lerFiltros(query);
    const tipo = await this.tipos.atualizar(id, this.#lerTipo(corpo));
    if (!tipo) throw naoEncontrado();
    return tipo;
  }

  #lerTipo(corpo) {
    const { nome } = lerCorpo(corpo, ['nome']);
    return criarComDados(() => new TipoInstrumento({ nome }));
  }
}
