import process from 'node:process';

const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
const nodeEnv = process.env.NODE_ENV || (isTest ? 'test' : 'development');

if (!isTest) {
  const requiredEnvVars = [];

  if (!process.env.DB_PASSWORD) {
    requiredEnvVars.push('DB_PASSWORD');
  }

  if (requiredEnvVars.length > 0) {
    throw new Error(
      `[Configuração] Variáveis de ambiente obrigatórias não definidas: ${requiredEnvVars.join(', ')}. ` +
      'Preencha o arquivo .env conforme indicado em .env.example.'
    );
  }
}

export const env = {
  port: Number(process.env.PORT) || (isTest ? 3001 : 3000),
  nodeEnv,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || (isTest ? 'bateria_test_db' : 'bateria_db'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || (isTest ? 'test_password' : ''),
  },
};