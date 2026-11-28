import { Router } from 'express';
import { ManutencaoController } from '../controllers/ManutencaoController.js';
import { exigirAutenticacao, exigirDiretoria, exigirJsonMesmaOrigem } from '../middlewares/autenticacao.js';

export function createManutencoesRouter({ authService, manutencaoService }) {
  const router = Router();
  const controller = new ManutencaoController(manutencaoService);
  const administrar = [exigirAutenticacao(authService), exigirDiretoria];
  const semCache = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
  router.get('/instrumentos/:instrumentoId/manutencoes', ...administrar, semCache, (req, res) => controller.listar(req, res));
  router.post('/instrumentos/:instrumentoId/manutencoes', ...administrar, exigirJsonMesmaOrigem, semCache, (req, res) => controller.abrir(req, res));
  router.put('/instrumentos/:instrumentoId/manutencoes/:manutencaoId/encerramento', ...administrar, exigirJsonMesmaOrigem, semCache, (req, res) => controller.encerrar(req, res));
  return router;
}
