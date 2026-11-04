import app from './src/app.js';
import { env } from './src/config/env.js';

app.listen(env.port, () => {
  console.log(`Servidor Express a rodar na porta ${env.port} [Ambiente: ${env.nodeEnv}]`);
});