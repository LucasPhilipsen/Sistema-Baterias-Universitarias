import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { Usuario, PerfilUsuario } from '../src/entities/Usuario.js';

const seed = await readFile(new URL('../../database/seeds/001-usuarios-desenvolvimento.sql', import.meta.url), 'utf8');
const hashes = [...seed.matchAll(/scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}/g)].map(([hash]) => hash);
const dados = {
  id: 1,
  nome: ' Integrante de Teste ',
  email: ' Integrante@Bateria.Example ',
  senhaHash: hashes[1],
  perfil: PerfilUsuario.INTEGRANTE,
};

test('normaliza nome e e-mail e distingue os dois perfis', () => {
  const integrante = new Usuario(dados);
  assert.equal(integrante.nome, 'Integrante de Teste');
  assert.equal(integrante.email, 'integrante@bateria.example');
  assert.equal(integrante.ehDiretoria(), false);
  assert.equal(new Usuario({ ...dados, perfil: PerfilUsuario.DIRETORIA }).ehDiretoria(), true);
  assert.equal(new Usuario({ ...dados, id: undefined }).id, null);
});

test('serialização pública não expõe o hash da senha', () => {
  const usuario = new Usuario(dados);
  assert.deepEqual(JSON.parse(JSON.stringify(usuario)), {
    id: 1, nome: 'Integrante de Teste', email: 'integrante@bateria.example', perfil: 'INTEGRANTE',
  });
  assert.equal(usuario.senhaHash, dados.senhaHash);
});

for (const [campo, valor] of [
  ['id', -1], ['id', 1.5], ['id', '1'],
  ['nome', '   '], ['nome', 'x'.repeat(121)],
  ['email', 'sem-arroba'], ['email', 'a b@bateria.example'], ['email', 'x'.repeat(255)],
  ['perfil', 'ADMIN'], ['perfil', undefined], ['senhaHash', 'senha-em-texto'], ['senhaHash', ''],
]) {
  test(`recusa ${campo} inválido: ${String(valor).slice(0, 30)}`, () => {
    assert.throws(() => new Usuario({ ...dados, [campo]: valor }), TypeError);
  });
}

test('as duas contas fictícias têm hashes válidos e salts distintos', () => {
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0].split('$')[4], hashes[1].split('$')[4]);
  for (const [index, senha] of ['DiretoriaDemo!2026', 'IntegranteDemo!2026'].entries()) {
    const [, n, r, p, saltHex, hashHex] = hashes[index].split('$');
    const esperado = Buffer.from(hashHex, 'hex');
    const opcoes = { N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024 };
    const correto = scryptSync(senha, Buffer.from(saltHex, 'hex'), 64, opcoes);
    const incorreto = scryptSync('SenhaIncorreta!2026', Buffer.from(saltHex, 'hex'), 64, opcoes);
    assert.equal(timingSafeEqual(correto, esperado), true);
    assert.equal(timingSafeEqual(incorreto, esperado), false);
  }
});
