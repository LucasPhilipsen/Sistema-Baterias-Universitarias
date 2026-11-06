import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/AuthService.js';
import { SenhaService } from '../src/services/SenhaService.js';
import { UsuarioRepository } from '../src/repositories/UsuarioRepository.js';
import { SessaoRepository } from '../src/repositories/SessaoRepository.js';
import { env } from '../src/config/env.js';

test('autenticação completa com PostgreSQL descartável', { skip: process.env.AUTH_PG_INTEGRATION !== '1' }, async t => {
  assert.match(env.db.database, /^bateria_auth_test_[a-z0-9_]+$/, 'Use um banco novo e descartável com prefixo bateria_auth_test_.');
  const banco = new pg.Pool(env.db);
  t.after(() => banco.end());
  for (const caminho of ['001-criar-usuarios.sql', '002-criar-sessoes.sql', 'seeds/001-usuarios-desenvolvimento.sql']) {
    await banco.query(await readFile(new URL(`../../database/${caminho}`, import.meta.url), 'utf8'));
  }
  const criarServico = () => new AuthService({
    usuarios: new UsuarioRepository(banco), sessoes: new SessaoRepository(banco), senhas: new SenhaService(),
  });
  const servico = criarServico();
  const app = createApp({ authService: servico });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const entrar = cookie => fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ email: 'integrante@bateria.example', senha: 'IntegranteDemo!2026' }),
  });
  const primeiro = await entrar();
  assert.equal(primeiro.status, 200);
  const usuario = (await primeiro.json()).usuario;
  const cookie = primeiro.headers.get('set-cookie').split(';')[0];
  const token = cookie.split('=')[1];
  const hash = createHash('sha256').update(token).digest('hex');
  assert.equal((await banco.query('SELECT token_hash FROM sessoes')).rows[0].token_hash, hash);
  assert.equal((await criarServico().autenticar(token)).id, usuario.id, 'Uma nova instância recupera a sessão persistida.');

  await banco.query("UPDATE usuarios SET perfil = 'DIRETORIA' WHERE id = $1", [usuario.id]);
  const me = await fetch(`${base}/api/auth/me?usuarioId=999`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  const atual = (await me.json()).usuario;
  assert.equal(atual.id, usuario.id);
  assert.equal(atual.perfil, 'DIRETORIA');
  assert.equal(atual.senhaHash, undefined);

  const segundo = await entrar(cookie);
  assert.equal(segundo.status, 200);
  const novoCookie = segundo.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await banco.query('SELECT count(*)::integer AS total FROM sessoes')).rows[0].total, 1);
  await banco.query("UPDATE sessoes SET expira_em = CURRENT_TIMESTAMP - INTERVAL '1 second'");
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: novoCookie } })).status, 401);

  const terceiro = await entrar();
  assert.equal(terceiro.status, 200);
  const ultimoCookie = terceiro.headers.get('set-cookie').split(';')[0];
  assert.equal((await banco.query('SELECT count(*)::integer AS total FROM sessoes')).rows[0].total, 1, 'Login limpa sessões expiradas.');
  const logout = await fetch(`${base}/api/auth/logout`, {
    method: 'POST', headers: { Cookie: ultimoCookie, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(logout.status, 204);
  assert.equal((await banco.query('SELECT count(*)::integer AS total FROM sessoes')).rows[0].total, 0);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: ultimoCookie } })).status, 401);
});
