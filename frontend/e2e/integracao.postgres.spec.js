import { test, expect } from '@playwright/test';
import { postgresTestPool } from './support/postgres-pool.js';

const enabled = process.env.ESTOQUE_E2E_POSTGRES === '1';
test.skip(!enabled, 'A conferência integrada exige PostgreSQL descartável.');
let banco;

test.beforeAll(async () => {
  if (process.env.NODE_ENV !== 'test' || !/^bateria_frontend_estoque_test_[a-z0-9_]+$/.test(process.env.DB_NAME ?? '')) {
    throw new Error('Use NODE_ENV=test e banco descartável bateria_frontend_estoque_test_*.');
  }
  banco = postgresTestPool();
});
test.afterAll(async () => { await banco?.end(); });

async function login(page, perfil = 'diretoria', path = '/ensaios') {
  await page.goto(path);
  await page.getByLabel('E-mail', { exact: false }).fill(`${perfil}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(perfil === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: path === '/ensaios' ? 'Ensaios' : 'Instrumentos e estoque', exact: true })).toBeVisible();
}

async function navigate(page, label) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
}

async function prepareEdit(page, module, suffix) {
  await login(page, 'diretoria', module === 'ensaios' ? '/ensaios' : '/instrumentos');
  if (module === 'ensaios') {
    const local = `Integração ${suffix}`;
    const response = await page.request.post('/api/ensaios', { data: { inicioEm: '2026-11-11T22:00:00Z', local } });
    expect(response.status()).toBe(201);
    const { ensaio } = await response.json();
    await page.getByRole('button', { name: 'Atualizar agenda', exact: true }).click();
    await page.getByRole('button', { name: `Editar ensaio em ${local}`, exact: true }).click();
    await page.getByLabel('Local (obrigatório)', { exact: true }).fill('Alteração que deve ser recusada');
    return {
      path: `/api/ensaios/${ensaio.id}`, button: 'Salvar ensaio', success: 'Ensaio atualizado.',
      unchanged: async () => expect((await banco.query('SELECT local FROM ensaios WHERE id = $1', [ensaio.id])).rows[0].local).toBe(local),
    };
  }
  const { rows: [original] } = await banco.query("SELECT id, observacoes FROM instrumentos WHERE identificacao = 'E2E-DISPONIVEL'");
  await page.getByRole('button', { name: 'Editar unidade E2E-DISPONIVEL', exact: true }).click();
  await page.getByLabel('Observações', { exact: true }).fill('Alteração que deve ser recusada');
  return {
    path: `/api/instrumentos/${original.id}`, button: 'Salvar unidade', success: 'Unidade atualizada com sucesso.',
    unchanged: async () => expect((await banco.query('SELECT observacoes FROM instrumentos WHERE id = $1', [original.id])).rows[0].observacoes).toBe(original.observacoes),
  };
}

// Segura somente o envio. A autenticação, a autorização e a resposta vêm da API real.
async function holdSubmission(page, path) {
  let release;
  let entered;
  const waiting = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  await page.route(`**${path}`, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    entered();
    await waiting;
    await route.continue();
  });
  return { started, release };
}

for (const module of ['ensaios', 'estoque']) {
  for (const action of ['expirar', 'revogar', 'rebaixar']) {
    test(`${module}: ${action} no PostgreSQL durante gravação recusa alteração e atualiza a interface`, async ({ page }, testInfo) => {
      const edit = await prepareEdit(page, module, `${action} ${testInfo.project.name}`);
      const gate = await holdSubmission(page, edit.path);
      const response = page.waitForResponse(response => response.url().endsWith(edit.path) && response.request().method() === 'PUT');
      try {
        await page.getByRole('button', { name: edit.button, exact: true }).click();
        await gate.started;
        if (action === 'rebaixar') {
          await banco.query("UPDATE usuarios SET perfil = 'INTEGRANTE' WHERE email = 'diretoria@bateria.example'");
        } else if (action === 'expirar') {
          await banco.query("UPDATE sessoes SET expira_em = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE usuario_id = (SELECT id FROM usuarios WHERE email = 'diretoria@bateria.example')");
        } else {
          await banco.query("DELETE FROM sessoes WHERE usuario_id = (SELECT id FROM usuarios WHERE email = 'diretoria@bateria.example')");
        }
        gate.release();
        expect((await response).status()).toBe(action === 'rebaixar' ? 403 : 401);
        if (action === 'rebaixar') {
          await expect(page.getByRole('alert')).toContainText('Você não tem permissão');
          await expect(page.getByRole('button', { name: /^Cadastrar / })).toHaveCount(0);
          await expect(page.locator('form')).toHaveCount(0);
          expect((await (await page.request.get('/api/auth/me')).json()).usuario.perfil).toBe('INTEGRANTE');
        } else {
          await expect(page).toHaveURL(/\/acesso$/);
          await expect(page.getByText('Sua sessão expirou ou foi encerrada. Entre novamente para continuar.')).toBeVisible();
        }
        await expect(page.getByText(edit.success, { exact: true })).toHaveCount(0);
        await edit.unchanged();
      } finally {
        gate.release();
        await banco.query("UPDATE usuarios SET perfil = 'DIRETORIA' WHERE email = 'diretoria@bateria.example'");
      }
    });
  }
}

test('os dois perfis navegam entre módulos, restauram sessão e encerram a sessão persistida', async ({ page }) => {
  for (const perfil of ['diretoria', 'integrante']) {
    await login(page, perfil);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Agenda de ensaios', exact: true })).toBeVisible();
    await navigate(page, 'Instrumentos e estoque');
    await expect(page.getByRole('heading', { name: 'Instrumentos e estoque', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E-DISPONIVEL', exact: true })).toBeVisible();
    await navigate(page, 'Ensaios');
    await expect(page.getByRole('heading', { name: 'Agenda de ensaios', exact: true })).toBeVisible();
    const me = (await (await page.request.get('/api/auth/me')).json()).usuario;
    expect(me.perfil).toBe(perfil.toUpperCase());
    expect(Object.keys(me).sort()).toEqual(['email', 'id', 'nome', 'perfil']);
    expect(Number((await banco.query('SELECT count(*) FROM sessoes WHERE usuario_id = $1 AND expira_em > CURRENT_TIMESTAMP', [me.id])).rows[0].count)).toBeGreaterThan(0);
    const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    const before = Number((await banco.query('SELECT count(*) FROM sessoes WHERE usuario_id = $1', [me.id])).rows[0].count);
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/acesso$/);
    expect(Number((await banco.query('SELECT count(*) FROM sessoes WHERE usuario_id = $1', [me.id])).rows[0].count)).toBe(before - 1);
    for (const path of ['/ensaios', '/instrumentos']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/acesso$/);
    }
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  }
});

test('estoque: unicidade global, vínculo válido e contagem das três situações são conferidos no banco', async ({ page }, testInfo) => {
  await login(page);
  const tipos = (await (await page.request.get('/api/tipos-instrumentos')).json()).tiposInstrumentos;
  const caixa = tipos.find(tipo => tipo.nome === 'Caixa de teste');
  const zero = tipos.find(tipo => tipo.nome === 'Tipo sem unidades');
  const before = Number((await banco.query('SELECT count(*) FROM instrumentos')).rows[0].count);
  const duplicate = await page.request.post('/api/instrumentos', { data: { tipoInstrumentoId: zero.id, identificacao: 'e2e-disponivel', observacoes: null } });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).error.code).toBe('IDENTIFICACAO_DUPLICADA');
  const invalid = await page.request.post('/api/instrumentos', { data: { tipoInstrumentoId: 2147483647, identificacao: `INVALIDO-${testInfo.project.name}`, observacoes: null } });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error.code).toBe('TIPO_INSTRUMENTO_INVALIDO');
  expect(Number((await banco.query('SELECT count(*) FROM instrumentos')).rows[0].count)).toBe(before);
  const estoque = (await (await page.request.get('/api/estoque')).json()).estoque;
  const { rows } = await banco.query('SELECT situacao, count(*)::integer AS quantidade FROM instrumentos WHERE tipo_instrumento_id = $1 GROUP BY situacao', [caixa.id]);
  const counts = Object.fromEntries(rows.map(row => [row.situacao, row.quantidade]));
  expect(estoque.find(row => row.tipoInstrumentoId === caixa.id)).toMatchObject({
    disponiveis: counts.DISPONIVEL ?? 0, emprestados: counts.EMPRESTADO ?? 0,
    emManutencao: counts.EM_MANUTENCAO ?? 0, total: rows.reduce((sum, row) => sum + row.quantidade, 0),
  });
  expect(estoque.find(row => row.tipoInstrumentoId === zero.id)).toMatchObject({ total: 0, disponiveis: 0, emprestados: 0, emManutencao: 0 });
});
