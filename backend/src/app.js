import express from 'express';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authService as servicoPadrao } from './config/autenticacao.js';
import { ensaioService as servicoEnsaioPadrao } from './config/ensaios.js';
import { demandaService as servicoDemandaPadrao } from './config/demanda.js';
import { servicosEstoque } from './config/estoque.js';
import { integranteService as servicoIntegrantePadrao } from './config/integrantes.js';
import { env } from './config/env.js';
import { createAuthRouter } from './routes/auth.js';
import { createEnsaiosRouter } from './routes/ensaios.js';
import { createDemandaRouter } from './routes/demanda.js';
import { createEstoqueRouter } from './routes/estoque.js';
import { createIntegrantesRouter } from './routes/integrantes.js';

export function createApp({
  authService = servicoPadrao,
  ensaioService = servicoEnsaioPadrao,
  demandaService = servicoDemandaPadrao,
  estoque = servicosEstoque,
  integranteService = servicoIntegrantePadrao,
  cookieSeguro = env.nodeEnv === 'production',
  limiteTentativas = 20,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api/auth', createAuthRouter({
    authService,
    cookieSeguro,
    limiteTentativas,
  }));
  app.use('/api/ensaios', createEnsaiosRouter({
    ensaioService,
    authService,
  }));
  app.use('/api/ensaios', createDemandaRouter({ authService, demandaService }));
  app.use('/api/integrantes', createIntegrantesRouter({ authService, integranteService }));
  app.use('/api', createEstoqueRouter({
    authService,
    ...estoque,
  }));

  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export default createApp();
