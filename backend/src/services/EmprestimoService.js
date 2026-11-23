import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { dadosInvalidos, idValido, lerCorpo, lerFiltros, lerIdUrl } from '../validacao/entrada.js';

const integranteNaoEncontrado = () => new ErroAplicacao(404, 'INTEGRANTE_NAO_ENCONTRADO', 'Integrante não encontrado.');

export class EmprestimoService {
  constructor(emprestimos, usuarios) {
    this.emprestimos = emprestimos;
    this.usuarios = usuarios;
  }

  async listar(usuario, query) {
    lerFiltros(query);
    if (!usuario || !idValido(usuario.id)) {
      throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema para continuar.');
    }
    return this.emprestimos.listar({ usuarioId: usuario.ehDiretoria() ? null : usuario.id });
  }

  async cadastrar(corpo, query) {
    lerFiltros(query);
    const { integranteId, instrumentoId } = lerCorpo(corpo, ['integranteId', 'instrumentoId']);
    if (!idValido(integranteId) || !idValido(instrumentoId)) {
      throw dadosInvalidos('Informe identificadores inteiros válidos para integrante e instrumento.');
    }
    const integrante = await this.usuarios.buscarIntegrantePorId(integranteId);
    if (!integrante) throw integranteNaoEncontrado();
    return this.emprestimos.criar({ integranteId, instrumentoId });
  }

  async devolver(idUrl, corpo, query) {
    lerFiltros(query);
    const id = lerIdUrl(idUrl);
    lerCorpo(corpo, []);
    return this.emprestimos.devolver(id);
  }
}
