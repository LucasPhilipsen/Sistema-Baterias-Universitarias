import { Usuario } from '../entities/Usuario.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { contarCaracteres, contemCaractereNulo, criarComDados, dadosInvalidos, lerCorpo, lerFiltros, lerIdUrl } from '../validacao/entrada.js';

const naoEncontrado = () => new ErroAplicacao(404, 'INTEGRANTE_NAO_ENCONTRADO', 'Integrante não encontrado.');

export class IntegranteService {
  constructor({ usuarios, senhas }) {
    this.usuarios = usuarios;
    this.senhas = senhas;
  }

  async listar(query) {
    lerFiltros(query);
    return this.usuarios.listarIntegrantes();
  }

  async consultar(idUrl, query) {
    lerFiltros(query);
    const integrante = await this.usuarios.buscarIntegrantePorId(lerIdUrl(idUrl));
    if (!integrante) throw naoEncontrado();
    return integrante;
  }

  async cadastrar(corpo, query) {
    lerFiltros(query);
    const { nome, email, senha } = lerCorpo(corpo, ['nome', 'email', 'senha']);
    const contato = this.#lerContato(nome, email);
    if (typeof senha !== 'string' || Buffer.byteLength(senha, 'utf8') > 1024 || contarCaracteres(senha) < 12) {
      throw dadosInvalidos('Informe uma senha de pelo menos 12 caracteres e até 1024 bytes.');
    }
    const senhaHash = await this.senhas.gerarHash(senha);
    return this.usuarios.criarIntegrante({ ...contato, senhaHash });
  }

  async atualizar(idUrl, corpo, query) {
    lerFiltros(query);
    const id = lerIdUrl(idUrl);
    const { nome, email } = lerCorpo(corpo, ['nome', 'email']);
    const integrante = await this.usuarios.atualizarIntegrante(id, this.#lerContato(nome, email));
    if (!integrante) throw naoEncontrado();
    return integrante;
  }

  #lerContato(nome, email) {
    const contato = criarComDados(() => Usuario.normalizarContato({ nome, email }));
    if (contemCaractereNulo(contato.nome) || contemCaractereNulo(contato.email) || contato.email.length > 254) {
      throw dadosInvalidos('Informe nome e e-mail válidos.');
    }
    return contato;
  }
}
