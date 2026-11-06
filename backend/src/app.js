import express from 'express';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authService as servicoPadrao } from './config/autenticacao.js';
import { env } from './config/env.js';
import { createAuthRouter } from './routes/auth.js';

export function createApp({ authService = servicoPadrao, cookieSeguro = env.nodeEnv === 'production', limiteTentativas = 20 } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ authService, cookieSeguro, limiteTentativas }));
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export default createApp();
