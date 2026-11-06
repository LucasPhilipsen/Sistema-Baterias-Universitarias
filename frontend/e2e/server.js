// Servidor exclusivo dos testes: rotas, scrypt e cookie reais da SCRUM-23;
// repositórios em memória, sem acesso nem alterações ao PostgreSQL da aplicação.
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createApp } from '../../backend/src/app.js';
import { Usuario } from '../../backend/src/entities/Usuario.js';
import { AuthService } from '../../backend/src/services/AuthService.js';
import { SenhaService } from '../../backend/src/services/SenhaService.js';
import { exigirAutenticacao, exigirDiretoria } from '../../backend/src/middlewares/autenticacao.js';
import { errorHandler } from '../../backend/src/middlewares/errorHandler.js';

if (process.env.NODE_ENV !== 'test') throw new Error('Este servidor só pode ser usado em testes.');

const seed = await readFile(new URL('../../database/seeds/001-usuarios-desenvolvimento.sql', import.meta.url), 'utf8');
const hashes = [...seed.matchAll(/scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}/g)].map(([hash]) => hash);
const usuarios = new Map([
  [1, new Usuario({ id: 1, nome: 'Diretoria de Demonstração', email: 'diretoria@bateria.example', perfil: 'DIRETORIA', senhaHash: hashes[0] })],
  [2, new Usuario({ id: 2, nome: 'Integrante de Demonstração', email: 'integrante@bateria.example', perfil: 'INTEGRANTE', senhaHash: hashes[1] })],
]);
const sessoes = new Map();
const authService = new AuthService({
  usuarios: { buscarPorEmail: async email => [...usuarios.values()].find(usuario => usuario.email === email) ?? null },
  sessoes: {
    criar: async registro => { sessoes.delete(registro.tokenAnteriorHash); sessoes.set(registro.tokenHash, registro); },
    buscarUsuarioPorHash: async hash => {
      const registro = sessoes.get(hash);
      return registro && registro.expiraEm > new Date() ? usuarios.get(registro.usuarioId) : null;
    },
    removerPorHash: async hash => sessoes.delete(hash),
  },
  senhas: new SenhaService(),
});
const app = createApp({ authService, limiteTentativas: 1000 });
app.get('/api/e2e/diretoria', exigirAutenticacao(authService), exigirDiretoria, (req, res) => res.json({ permitido: true }));
app.use(errorHandler);
const api = app.listen(0, '127.0.0.1');
await new Promise(resolve => api.once('listening', resolve));
const vite = await createServer({
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${api.address().port}`, changeOrigin: false } } },
});
await vite.listen();

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await vite.close();
  api.closeAllConnections();
  api.close();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
