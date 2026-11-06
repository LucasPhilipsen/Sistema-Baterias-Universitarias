import { createHash, randomBytes } from 'node:crypto';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';

export const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;
const hashAusente = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
const formatoToken = /^[A-Za-z0-9_-]{43}$/;
const hashToken = token => createHash('sha256').update(token, 'ascii').digest('hex');

export class AuthService {
  constructor({ usuarios, sessoes, senhas, agora = () => new Date() }) {
    this.usuarios = usuarios;
    this.sessoes = sessoes;
    this.senhas = senhas;
    this.agora = agora;
  }

  async entrar(dados, tokenAnterior = null) {
    if (!dados || Array.isArray(dados) || typeof dados.email !== 'string'
      || dados.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())
      || typeof dados.senha !== 'string' || !dados.senha || Buffer.byteLength(dados.senha, 'utf8') > 1024) {
      throw new ErroAplicacao(400, 'DADOS_INVALIDOS', 'Informe um e-mail válido e uma senha de até 1024 bytes.');
    }

    const usuario = await this.usuarios.buscarPorEmail(dados.email.trim().toLowerCase());
    // E-mails inexistentes também passam pela derivação para evitar uma resposta muito mais rápida.
    const senhaValida = await this.senhas.verificar(dados.senha, usuario?.senhaHash ?? hashAusente);
    if (!usuario || !senhaValida) {
      throw new ErroAplicacao(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.');
    }

    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(this.agora().getTime() + DURACAO_SESSAO_MS);
    await this.sessoes.criar({
      tokenHash: hashToken(token), usuarioId: usuario.id, expiraEm,
      tokenAnteriorHash: this.tokenValido(tokenAnterior) ? hashToken(tokenAnterior) : null,
    });
    return { usuario, token, expiraEm };
  }

  tokenValido(token) {
    return typeof token === 'string' && token.length === 43 && formatoToken.test(token);
  }

  async autenticar(token) {
    const usuario = this.tokenValido(token)
      ? await this.sessoes.buscarUsuarioPorHash(hashToken(token)) : null;
    if (!usuario) throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema para continuar.');
    return usuario;
  }

  async sair(token) {
    if (this.tokenValido(token)) await this.sessoes.removerPorHash(hashToken(token));
  }
}
