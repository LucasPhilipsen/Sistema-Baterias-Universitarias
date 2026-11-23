import { Router } from 'express';
import { EmprestimoController } from '../controllers/EmprestimoController.js';
import { exigirAutenticacao, exigirDiretoria, exigirJsonMesmaOrigem } from '../middlewares/autenticacao.js';

export function createEmprestimosRouter({ authService, emprestimoService }) {
  const router = Router();
  const controller = new EmprestimoController(emprestimoService);

  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(exigirAutenticacao(authService));
  router.get('/', (req, res) => controller.listar(req, res));
  router.post('/', exigirDiretoria, exigirJsonMesmaOrigem, (req, res) => controller.cadastrar(req, res));
  router.put('/:id/devolucao', exigirDiretoria, exigirJsonMesmaOrigem, (req, res) => controller.devolver(req, res));
  return router;
}
