import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
}

const server = createApp().listen(port, host, () => {
  console.log(`API disponível em http://${host}:${port}/api/health`);
});

server.on('error', (error) => {
  console.error(`Não foi possível iniciar a API (${error.code ?? 'erro desconhecido'}).`);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
  });
}
