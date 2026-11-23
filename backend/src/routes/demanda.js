import { Router } from 'express';
import { DemandaController } from '../controllers/DemandaController.js';
import { exigirAutenticacao, exigirDiretoria } from '../middlewares/autenticacao.js';

// Montado em /api/ensaios ao lado do router de ensaios; a rota GET /:id de ensaios não captura /:id/demanda.
// Somente leitura e exclusiva da diretoria, sem corpo e sem filtros.
export function createDemandaRouter({ authService, demandaService }) {
  const router = Router();
  const controller = new DemandaController(demandaService);

  router.get('/:id/demanda', exigirAutenticacao(authService), exigirDiretoria, (req, res) => controller.consultar(req, res));
  return router;
}
