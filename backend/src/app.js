import express from 'express';
import { HealthController } from './modules/health/HealthController.js';

export function createApp() {
  const app = express();
  const healthController = new HealthController();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', healthController.getStatus);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
  });

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido.' } });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição muito grande.' } });
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } });
  });

  return app;
}
