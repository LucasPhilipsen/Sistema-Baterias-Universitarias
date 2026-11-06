import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { lerTokenSessao } from '../http/cookieSessao.js';

export function exigirAutenticacao(servico) {
  return async (req, res, next) => {
    req.usuario = await servico.autenticar(lerTokenSessao(req));
    next();
  };
}

export function exigirDiretoria(req, res, next) {
  if (!req.usuario) throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema para continuar.');
  if (!req.usuario.ehDiretoria()) throw new ErroAplicacao(403, 'ACESSO_NEGADO', 'Esta operação exige perfil de diretoria.');
  next();
}

export function exigirProprioUsuarioOuDiretoria(parametro = 'usuarioId') {
  return (req, res, next) => {
    if (!req.usuario) throw new ErroAplicacao(401, 'SESSAO_INVALIDA', 'Entre no sistema para continuar.');
    const id = Number(req.params[parametro]);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new ErroAplicacao(400, 'IDENTIFICACAO_INVALIDA', 'Identificação de usuário inválida.');
    }
    if (!req.usuario.ehDiretoria() && req.usuario.id !== id) {
      throw new ErroAplicacao(403, 'ACESSO_NEGADO', 'Você não pode acessar os dados deste usuário.');
    }
    next();
  };
}

export function exigirJsonMesmaOrigem(req, res, next) {
  if (!req.is('application/json')) {
    throw new ErroAplicacao(415, 'JSON_OBRIGATORIO', 'Envie a requisição com Content-Type application/json.');
  }
  const origin = req.get('Origin');
  let origemValida = req.get('Sec-Fetch-Site') !== 'cross-site';
  if (origin) {
    try {
      const url = new URL(origin);
      origemValida = origemValida && ['http:', 'https:'].includes(url.protocol) && url.host === req.get('host');
    } catch {
      origemValida = false;
    }
  }
  if (!origemValida) throw new ErroAplicacao(403, 'ORIGEM_INVALIDA', 'Origem da requisição não permitida.');
  next();
}
