import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createApp } from '../src/app.js';
import { Usuario } from '../src/entities/Usuario.js';
import { AuthService } from '../src/services/AuthService.js';
import { SenhaService } from '../src/services/SenhaService.js';
import { exigirAutenticacao, exigirDiretoria, exigirProprioUsuarioOuDiretoria } from '../src/middlewares/autenticacao.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

const seed = await readFile(new URL('../../database/seeds/001-usuarios-desenvolvimento.sql', import.meta.url), 'utf8');
const hashes = [...seed.matchAll(/scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}/g)].map(([hash]) => hash);
const credenciais = { email: 'integrante@bateria.example', senha: 'IntegranteDemo!2026' };
const cookieDe = response => response.headers.get('set-cookie')?.split(';')[0];

async function preparar(t, opcoes = {}) {
  const usuarios = new Map([
    [1, new Usuario({ id: 1, nome: 'Diretoria', email: 'diretoria@bateria.example', senhaHash: hashes[0], perfil: 'DIRETORIA' })],
    [2, new Usuario({ id: 2, nome: 'Integrante', email: credenciais.email, senhaHash: hashes[1], perfil: 'INTEGRANTE' })],
  ]);
  const sessoes = new Map();
  const servico = new AuthService({
    usuarios: { buscarPorEmail: async email => [...usuarios.values()].find(u => u.email === email) ?? null },
    sessoes: {
      criar: async registro => {
        sessoes.delete(registro.tokenAnteriorHash);
        sessoes.set(registro.tokenHash, registro);
      },
      buscarUsuarioPorHash: async hash => {
        const registro = sessoes.get(hash);
        return registro && registro.expiraEm > new Date() ? usuarios.get(registro.usuarioId) : null;
      },
      removerPorHash: async hash => sessoes.delete(hash),
    },
    senhas: new SenhaService(),
  });
  const app = createApp({ authService: servico, ...opcoes });
  // Rotas exclusivas dos testes para verificar a proteção que os módulos reutilizarão.
  app.get('/teste/diretoria', exigirAutenticacao(servico), exigirDiretoria, (req, res) => res.json({ permitido: true }));
  app.get('/teste/usuarios/:usuarioId', exigirAutenticacao(servico), exigirProprioUsuarioOuDiretoria(), (req, res) => res.json({ permitido: true }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const solicitar = (caminho, opcoes = {}) => fetch(base + caminho, opcoes);
  const entrar = (dados = credenciais, cookie) => solicitar('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(dados),
  });
  return { solicitar, entrar, usuarios, sessoes, servico, base };
}

test('login cria cookie HttpOnly e persiste somente o hash do token', async t => {
  const c = await preparar(t);
  const response = await c.entrar({ ...credenciais, email: ' INTEGRANTE@BATERIA.EXAMPLE ', perfil: 'DIRETORIA', id: 1 });
  assert.equal(response.status, 200);
  const usuario = (await response.json()).usuario;
  assert.deepEqual(Object.keys(usuario).sort(), ['email', 'id', 'nome', 'perfil']);
  assert.equal(usuario.id, 2);
  assert.equal(usuario.perfil, 'INTEGRANTE');
  const header = response.headers.get('set-cookie');
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\/api/);
  assert.doesNotMatch(header, /Secure/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const token = cookieDe(response).split('=')[1];
  const hash = createHash('sha256').update(token).digest('hex');
  assert.ok(c.sessoes.has(hash));
  assert.equal(c.sessoes.has(token), false);
  assert.ok(Math.abs(c.sessoes.get(hash).expiraEm.getTime() - Date.now() - 8 * 3600000) < 5000);
  const me = await c.solicitar('/api/auth/me?usuarioId=1', { headers: { Cookie: cookieDe(response) } });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).usuario, usuario);
});

test('configuração de produção marca o cookie como Secure', async t => {
  const c = await preparar(t, { cookieSeguro: true });
  const response = await c.entrar();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Secure/);
});

test('e-mail inexistente e senha errada retornam o mesmo erro, sem criar sessão', async t => {
  const c = await preparar(t);
  const desconhecido = await c.entrar({ ...credenciais, email: 'ausente@bateria.example' });
  const errado = await c.entrar({ ...credenciais, senha: 'SenhaErrada!2026' });
  assert.equal(desconhecido.status, 401);
  assert.equal(errado.status, 401);
  assert.deepEqual(await desconhecido.json(), await errado.json());
  assert.equal(c.sessoes.size, 0);
});

test('login valida corpo, tamanho da senha, JSON e origem', async t => {
  const c = await preparar(t);
  for (const dados of [null, [], {}, { ...credenciais, senha: 'ç'.repeat(513) }, { ...credenciais, email: 'inválido' }]) {
    assert.equal((await c.entrar(dados)).status, 400);
  }
  const invalido = await c.solicitar('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"senha":',
  });
  assert.equal(invalido.status, 400);
  assert.equal((await invalido.json()).error.code, 'JSON_INVALIDO');
  assert.equal((await c.solicitar('/api/auth/login', { method: 'POST', body: 'email=x' })).status, 415);
  for (const origin of ['https://externo.example', 'null']) {
    const externo = await c.solicitar('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(credenciais),
    });
    assert.equal(externo.status, 403);
  }
  const local = await c.solicitar('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: c.base }, body: JSON.stringify(credenciais),
  });
  assert.equal(local.status, 200);
});

test('sessões ausentes, malformadas, duplicadas, desconhecidas e expiradas são recusadas', async t => {
  const c = await preparar(t);
  for (const cookie of ['', 'bateria_sessao=invalido', `bateria_sessao=${'a'.repeat(43)}`]) {
    assert.equal((await c.solicitar('/api/auth/me', { headers: { Cookie: cookie } })).status, 401);
  }
  const login = await c.entrar();
  const cookie = cookieDe(login);
  assert.equal((await c.solicitar('/api/auth/me', { headers: { Cookie: `${cookie}; ${cookie}` } })).status, 401);
  [...c.sessoes.values()][0].expiraEm = new Date(Date.now() - 1000);
  assert.equal((await c.solicitar('/api/auth/me', { headers: { Cookie: cookie } })).status, 401);
});

test('novo login troca a sessão; logout revoga o token e pode ser repetido', async t => {
  const c = await preparar(t);
  const primeiro = cookieDe(await c.entrar());
  const segundo = cookieDe(await c.entrar(credenciais, primeiro));
  assert.notEqual(primeiro, segundo);
  assert.equal(c.sessoes.size, 1);
  assert.equal((await c.solicitar('/api/auth/me', { headers: { Cookie: primeiro } })).status, 401);
  const sair = () => c.solicitar('/api/auth/logout', {
    method: 'POST', headers: { Cookie: segundo, 'Content-Type': 'application/json' }, body: '{}',
  });
  const response = await sair();
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.match(response.headers.get('set-cookie'), /bateria_sessao=;/);
  assert.equal(c.sessoes.size, 0);
  assert.equal((await c.solicitar('/api/auth/me', { headers: { Cookie: segundo } })).status, 401);
  assert.equal((await sair()).status, 204);
});

test('permissões protegem operações administrativas e dados de outro integrante', async t => {
  const c = await preparar(t);
  assert.equal((await c.solicitar('/teste/diretoria')).status, 401);
  const integrante = cookieDe(await c.entrar());
  const headers = { Cookie: integrante };
  assert.equal((await c.solicitar('/teste/diretoria', { headers })).status, 403);
  assert.equal((await c.solicitar('/teste/usuarios/1', { headers })).status, 403);
  assert.equal((await c.solicitar('/teste/usuarios/2', { headers })).status, 200);
  assert.equal((await c.solicitar('/teste/usuarios/abc', { headers })).status, 400);
  const diretoria = cookieDe(await c.entrar({ email: 'diretoria@bateria.example', senha: 'DiretoriaDemo!2026' }));
  assert.equal((await c.solicitar('/teste/diretoria', { headers: { Cookie: diretoria } })).status, 200);
  assert.equal((await c.solicitar('/teste/usuarios/2', { headers: { Cookie: diretoria } })).status, 200);
});

test('limite de tentativas retorna 429 com orientação para tentar novamente', async t => {
  const c = await preparar(t, { limiteTentativas: 2 });
  assert.equal((await c.entrar({})).status, 400);
  assert.equal((await c.entrar({})).status, 400);
  const response = await c.entrar({});
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, 'MUITAS_TENTATIVAS');
  assert.ok(Number(response.headers.get('retry-after')) > 0);
});

test('falha no repositório não retorna detalhes internos ou cookie de sessão', async t => {
  const c = await preparar(t);
  c.servico.usuarios.buscarPorEmail = async () => { throw new Error('detalhe interno do banco'); };
  const original = console.error;
  console.error = () => {};
  try {
    const response = await c.entrar();
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: { code: 'ERRO_INTERNO', message: 'Erro interno do servidor.' } });
    assert.equal(response.headers.get('set-cookie'), null);
  } finally {
    console.error = original;
  }
});
