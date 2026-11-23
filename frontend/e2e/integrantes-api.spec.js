import { test, expect } from '@playwright/test';
import { postgresTestPool } from './support/postgres-pool.js';

async function login(page, perfil = 'diretoria') {
  await page.goto('/integrantes');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill(`${perfil}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(perfil === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  if (perfil === 'diretoria') await expect(page.getByRole('heading', { name: 'Integrantes', exact: true })).toBeVisible();
}

test('cadastro, consulta atualizada, edição, recarga e login usam API real sem credenciais na lista', async ({ page, browser }, testInfo) => {
  await login(page);
  const suffix = `${testInfo.project.name}${Date.now()}`;
  const nome = `Ana ${suffix}`;
  const email = `ana${suffix}@bateria.example`;
  const senha = '  SenhaInicial!2026  ';
  await page.getByRole('button', { name: 'Cadastrar integrante', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  await expect(page.getByLabel('Nome (obrigatório)', { exact: true })).toBeFocused();
  await page.getByLabel('Nome (obrigatório)', { exact: true }).fill(`  ${nome}  `);
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill(`  ${email.toUpperCase()}  `);
  await page.getByLabel('Senha inicial (obrigatório)', { exact: true }).fill(senha);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('integrantes-cadastro-320.png'), fullPage: true });
  const created = page.waitForResponse(r => r.url().endsWith('/api/integrantes') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Salvar integrante' }).focus();
  await page.keyboard.press('Enter');
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({ nome, email, senha });
  const { integrante } = await response.json();
  expect(Object.keys(integrante).sort()).toEqual(['email', 'id', 'nome', 'perfil']);
  expect(integrante.id).toBeGreaterThan(2);
  await expect(page.getByText('Integrante cadastrado com sucesso.', { exact: true })).toBeVisible();
  await page.reload();
  const card = name => page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(card(nome)).toContainText(email);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(senha);
  await expect(page.locator('main')).not.toContainText('scrypt$');
  // Alteração externa: a consulta individual deve buscar o dado atual, não só copiar a lista.
  const renamed = `${nome} revisada`;
  expect((await page.request.put(`/api/integrantes/${integrante.id}`, { data: { nome: renamed, email } })).status()).toBe(200);
  await card(nome).getByRole('button', { name: `Consultar ${nome}`, exact: true }).click();
  const detail = page.getByRole('region', { name: 'Consultar integrante', exact: true });
  await expect(detail).toContainText(renamed);
  await detail.getByRole('button', { name: 'Editar integrante' }).click();
  await expect(page.getByLabel('Nome (obrigatório)', { exact: true })).toHaveValue(renamed);
  await expect(page.locator('input[name="senha"], select[name="perfil"]')).toHaveCount(0);
  const updatedEmail = `novo${suffix}@bateria.example`;
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill(updatedEmail);
  const updated = page.waitForResponse(r => r.url().endsWith(`/api/integrantes/${integrante.id}`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  const edited = await updated;
  expect(edited.status()).toBe(200);
  expect(edited.request().postDataJSON()).toEqual({ nome: renamed, email: updatedEmail });
  await expect(page.getByText('Integrante atualizado com sucesso.', { exact: true })).toBeVisible();
  await expect(card(renamed)).toContainText(updatedEmail);
  await page.reload();
  await expect(card(renamed)).toContainText(updatedEmail);
  await page.getByLabel('Buscar por nome ou e-mail').fill(updatedEmail);
  await expect(page.getByRole('article')).toHaveCount(1);
  if (process.env.INTEGRANTES_E2E_POSTGRES === '1') {
    const pool = postgresTestPool();
    try {
      const { rows: [row] } = await pool.query('SELECT nome, email, perfil, senha_hash FROM usuarios WHERE id = $1', [integrante.id]);
      expect(row).toMatchObject({ nome: renamed, email: updatedEmail, perfil: 'INTEGRANTE' });
      expect(row.senha_hash).toMatch(/^scrypt\$/);
      expect(row.senha_hash).not.toEqual(senha);
    } finally { await pool.end(); }
  }
  const context = await browser.newContext();
  try {
    const newPage = await context.newPage();
    await newPage.goto('http://127.0.0.1:5174/acesso');
    await newPage.getByLabel('E-mail (obrigatório)', { exact: true }).fill(updatedEmail);
    await newPage.getByLabel('Senha (obrigatório)', { exact: true }).fill(senha);
    await newPage.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(newPage).toHaveURL(/\/ensaios$/);
    expect((await (await newPage.request.get('/api/auth/me')).json()).usuario).toMatchObject({ id: integrante.id, email: updatedEmail, perfil: 'INTEGRANTE' });
  } finally { await context.close(); }
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize(testInfo.project.use.viewport);
  await page.screenshot({ path: testInfo.outputPath('integrantes-lista.png'), fullPage: true });
});

test('valida campos e trata e-mail duplicado real preservando os dados para correção', async ({ page }, testInfo) => {
  await login(page);
  await page.getByRole('button', { name: 'Cadastrar integrante', exact: true }).click();
  const nome = page.getByLabel('Nome (obrigatório)', { exact: true });
  const email = page.getByLabel('E-mail (obrigatório)', { exact: true });
  const senha = page.getByLabel('Senha inicial (obrigatório)', { exact: true });
  await nome.fill('Teste de duplicidade');
  await email.fill('DIRETORIA@BATERIA.EXAMPLE');
  await senha.fill('🎵'.repeat(11));
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  await expect(senha).toHaveAttribute('aria-invalid', 'true');
  await senha.fill('SenhaTeste!2026');
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('Já existe uma conta');
  await expect(nome).toHaveValue('Teste de duplicidade');
  await email.fill(`corrigido${testInfo.project.name}${Date.now()}@bateria.example`);
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  await expect(page.getByText('Integrante cadastrado com sucesso.', { exact: true })).toBeVisible();
});

test('integrante não vê navegação administrativa; URL e quatro rotas são protegidas', async ({ page }) => {
  await login(page, 'integrante');
  await expect(page).toHaveURL(/\/ensaios$/);
  await expect(page.getByRole('link', { name: 'Integrantes', exact: true })).toHaveCount(0);
  let listRequests = 0;
  page.on('request', request => { if (request.url().endsWith('/api/integrantes')) listRequests++; });
  await page.goto('/integrantes');
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  expect(listRequests).toBe(0);
  for (const [method, path, data] of [
    ['GET', '/api/integrantes'], ['GET', '/api/integrantes/2'],
    ['POST', '/api/integrantes', { nome: 'Negado', email: 'negado@bateria.example', senha: 'SenhaTeste!2026' }],
    ['PUT', '/api/integrantes/2', { nome: 'Negado', email: 'negado@bateria.example' }],
  ]) expect((await page.request.fetch(path, { method, data })).status()).toBe(403);
});

test('expiração ao consultar integrantes retorna ao login', async ({ page }) => {
  await login(page);
  await page.context().clearCookies();
  await page.getByRole('button', { name: 'Atualizar lista' }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole('article')).toHaveCount(0);
});
