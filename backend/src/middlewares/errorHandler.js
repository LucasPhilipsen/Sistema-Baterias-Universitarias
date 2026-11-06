import { ErroAplicacao } from '../errors/ErroAplicacao.js';

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = 500;
  let code = 'ERRO_INTERNO';
  let message = 'Erro interno do servidor.';
  if (err instanceof ErroAplicacao) {
    ({ status, code, message } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'JSON_INVALIDO'; message = 'O corpo da requisição deve conter JSON válido.';
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'CORPO_MUITO_GRANDE'; message = 'O corpo da requisição excede o limite permitido.';
  } else {
    console.error(err.stack);
  }
  res.status(status).json({ error: { code, message } });
};
