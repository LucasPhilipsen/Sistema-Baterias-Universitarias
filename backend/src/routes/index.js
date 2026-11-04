import { Router } from 'express';
import { dbPool } from '../config/database.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const result = await dbPool.query('SELECT NOW() AS db_time');
    return res.status(200).json({
      status: 'OK',
      message: 'API operacional e conectada ao banco de dados.',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        timestamp: result.rows[0].db_time,
      },
    });
  } catch (error) {
    const errorMessage = error.message || error.errors?.[0]?.message || error.code || 'Falha na conexão com o banco de dados.';
    return res.status(503).json({
      status: 'DEGRADED',
      message: 'API operacional, mas o banco de dados está inacessível.',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: errorMessage,
      },
    });
  }
});

export default router;