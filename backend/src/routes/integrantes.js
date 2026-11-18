import { Router } from 'express';
import { IntegranteController } from '../controllers/IntegranteController.js';
import { exigirAutenticacao, exigirDiretoria, exigirJsonMesmaOrigem } from '../middlewares/autenticacao.js';

export function createIntegrantesRouter({ authService, integranteService }) {
  const router = Router();
  const controller = new IntegranteController(integranteService);

  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(exigirAutenticacao(authService), exigirDiretoria);
  router.get('/', (req, res) => controller.listar(req, res));
  router.get('/:id', (req, res) => controller.consultar(req, res));
  router.post('/', exigirJsonMesmaOrigem, (req, res) => controller.cadastrar(req, res));
  router.put('/:id', exigirJsonMesmaOrigem, (req, res) => controller.atualizar(req, res));
  return router;
}
