import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController.js';
import { exigirAutenticacao, exigirJsonMesmaOrigem } from '../middlewares/autenticacao.js';

export function createAuthRouter({ authService, cookieSeguro = false, limiteTentativas = 20 }) {
  const router = Router();
  const controller = new AuthController(authService, { cookieSeguro });
  const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: limiteTentativas,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: { code: 'MUITAS_TENTATIVAS', message: 'Muitas tentativas. Aguarde antes de tentar novamente.' } },
  });

  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/login', limitarLogin, exigirJsonMesmaOrigem, (req, res) => controller.entrar(req, res));
  router.get('/me', exigirAutenticacao(authService), (req, res) => controller.consultar(req, res));
  router.post('/logout', exigirJsonMesmaOrigem, (req, res) => controller.sair(req, res));
  return router;
}
