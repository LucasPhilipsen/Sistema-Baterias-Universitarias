import { TipoInstrumento } from '../entities/TipoInstrumento.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { criarComDados, lerCorpo, lerFiltros, lerIdUrl } from '../validacao/entrada.js';

const naoEncontrado = () => new ErroAplicacao(404, 'TIPO_INSTRUMENTO_NAO_ENCONTRADO', 'Tipo de instrumento não encontrado.');

export class TipoInstrumentoService {
  constructor(tipos) {
    this.tipos = tipos;
  }

  async listar(filtros) {
    lerFiltros(filtros);
    return this.tipos.listar();
  }

  async consultar(idUrl) {
    const tipo = await this.tipos.buscarPorId(lerIdUrl(idUrl));
    if (!tipo) throw naoEncontrado();
    return tipo;
  }

  async cadastrar(corpo) {
    return this.tipos.criar(this.#lerTipo(corpo));
  }

  async atualizar(idUrl, corpo) {
    const id = lerIdUrl(idUrl);
    const tipo = await this.tipos.atualizar(id, this.#lerTipo(corpo));
    if (!tipo) throw naoEncontrado();
    return tipo;
  }

  #lerTipo(corpo) {
    const { nome } = lerCorpo(corpo, ['nome']);
    return criarComDados(() => new TipoInstrumento({ nome }));
  }
}
