import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, loginDestination } from '../src/auth/access.js';

const integrante = { perfil: 'INTEGRANTE' };
const diretoria = { perfil: 'DIRETORIA' };

test('somente perfis reconhecidos podem acessar módulos e apenas diretoria acessa administração', () => {
  for (const path of ['/ensaios', '/instrumentos', '/administracao']) {
    assert.equal(canAccess(path, null), false);
    assert.equal(canAccess(path, { perfil: 'ADMIN' }), false);
  }
  assert.equal(canAccess('/ensaios', integrante), true);
  assert.equal(canAccess('/instrumentos/', integrante), true);
  assert.equal(canAccess('/administracao', integrante), false);
  assert.equal(canAccess('/administracao/', diretoria), true);
  assert.equal(canAccess('/desconhecido', diretoria), false);
});

test('login retorna ao destino permitido e rejeita redirecionamentos externos ou proibidos', () => {
  assert.equal(loginDestination(integrante, '/instrumentos?filtro=livres#lista'), '/instrumentos?filtro=livres#lista');
  assert.equal(loginDestination(diretoria), '/administracao');
  assert.equal(loginDestination(integrante), '/ensaios');
  for (const from of ['/administracao', '/acesso', '//externo.example', '/\\externo.example', 'https://externo.example', 'javascript:alert(1)', {}, '/inexistente']) {
    assert.equal(loginDestination(integrante, from), '/ensaios');
  }
});
