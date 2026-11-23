import { Router } from 'express';
import { ConfirmacaoController } from '../controllers/ConfirmacaoController.js';
import { exigirAutenticacao, exigirJsonMesmaOrigem, exigirMesmaOrigem } from '../middlewares/autenticacao.js';

export function createConfirmacoesRouter({ confirmacaoService, authService }) {
  const router = Router({ mergeParams: true });
  const controller = new ConfirmacaoController(confirmacaoService);

  router.get(
    '/:id/minha-participacao',
    exigirAutenticacao(authService),
    (req, res) => controller.consultar(req, res),
  );

  router.put(
    '/:id/minha-participacao',
    exigirAutenticacao(authService),
    exigirJsonMesmaOrigem,
    (req, res) => controller.confirmar(req, res),
  );

  router.delete(
    '/:id/minha-participacao',
    exigirAutenticacao(authService),
    exigirMesmaOrigem,
    (req, res) => controller.cancelar(req, res),
  );

  return router;
}
