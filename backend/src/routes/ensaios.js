import { Router } from 'express';
import { EnsaioController } from '../controllers/EnsaioController.js';
import { exigirAutenticacao, exigirDiretoria, exigirJsonMesmaOrigem } from '../middlewares/autenticacao.js';

export function createEnsaiosRouter({ ensaioService, authService }) {
  const router = Router();
  const controller = new EnsaioController(ensaioService);

  router.get('/', exigirAutenticacao(authService), (req, res) => controller.listar(req, res));
  router.get('/:id', exigirAutenticacao(authService), (req, res) => controller.consultar(req, res));
  router.post('/', exigirAutenticacao(authService), exigirDiretoria, exigirJsonMesmaOrigem, (req, res) => controller.cadastrar(req, res));
  router.put('/:id', exigirAutenticacao(authService), exigirDiretoria, exigirJsonMesmaOrigem, (req, res) => controller.editar(req, res));
  router.patch('/:id/cancelamento', exigirAutenticacao(authService), exigirDiretoria, exigirJsonMesmaOrigem, (req, res) => controller.cancelar(req, res));

  return router;
}

