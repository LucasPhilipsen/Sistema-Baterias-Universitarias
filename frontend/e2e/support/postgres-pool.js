import { createRequire } from 'node:module';

// Cada conferência SQL possui seu pool; encerrá-lo não afeta outro arquivo de testes.
export function postgresTestPool() {
  if (!/^bateria_frontend_(?:estoque_)?test_[a-z0-9_]+$/.test(process.env.DB_NAME ?? '')
    || ![process.env.ESTOQUE_E2E_POSTGRES, process.env.ENSAIOS_E2E_POSTGRES].includes('1')) {
    throw new Error('A conferência SQL exige opt-in e banco PostgreSQL descartável.');
  }
  const { Pool } = createRequire(new URL('../../../backend/package.json', import.meta.url))('pg');
  return new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
}
