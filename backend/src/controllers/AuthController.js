import { lerTokenSessao, NOME_COOKIE, opcoesCookie } from '../http/cookieSessao.js';

export class AuthController {
  constructor(servico, { cookieSeguro = false } = {}) {
    this.servico = servico;
    this.cookieSeguro = cookieSeguro;
  }

  async entrar(req, res) {
    const { usuario, token, expiraEm } = await this.servico.entrar(req.body, lerTokenSessao(req));
    res.cookie(NOME_COOKIE, token, { ...opcoesCookie(this.cookieSeguro), expires: expiraEm });
    res.status(200).json({ usuario });
  }

  consultar(req, res) {
    res.status(200).json({ usuario: req.usuario });
  }

  async sair(req, res) {
    await this.servico.sair(lerTokenSessao(req));
    res.clearCookie(NOME_COOKIE, opcoesCookie(this.cookieSeguro));
    res.status(204).end();
  }
}
