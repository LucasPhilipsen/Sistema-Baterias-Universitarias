import { test, expect } from '@playwright/test';
import { loginDemanda, scheduledEnsaio, otherEnsaio, cancelledEnsaio } from './support/demanda-fixtures.js';

test.skip(!process.env.DEMANDA_E2E_BACKEND_ROOT, 'Exige checkout explícito da SCRUM-43; rotas reais, repositórios em memória.');
const cells = (page, name) => page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(`^${name}`) }) }).getByRole('cell');

test('API da SCRUM-43 calcula os números exibidos e reflete alterações do repositório na atualização', async ({ page }, testInfo) => {
  await loginDemanda(page);
  const selected = page.getByLabel('Ensaio', { exact: true });
  await expect(selected).toBeVisible();
  await expect(selected).not.toContainText(cancelledEnsaio.local);
  const response = page.waitForResponse(r => r.url().endsWith(`/api/ensaios/${scheduledEnsaio.id}/demanda`));
  await selected.selectOption(String(scheduledEnsaio.id));
  const initial = await response;
  expect(initial.status()).toBe(200);
  expect(initial.request().method()).toBe('GET');
  const { demanda } = await initial.json();
  const caixa = demanda.tipos.find(item => item.nome === 'Caixa');
  await expect(cells(page, 'Caixa')).toHaveText([String(caixa.confirmados), String(caixa.disponiveis), String(caixa.falta)]);
  expect(caixa.confirmados).toBe(5);
  expect(caixa.disponiveis).toBeLessThanOrEqual(3);
  expect(caixa.falta).toBe(5 - caixa.disponiveis);
  await expect(cells(page, 'Surdo')).toHaveText(['2', '0', '2']);
  // Alteração somente na persistência simulada, preservando cálculo e rotas publicados.
  expect((await page.request.post('/api/e2e/demanda/retirada', { data: {} })).status()).toBe(200);
  await page.getByRole('button', { name: 'Atualizar comparação' }).click();
  const expectedAvailable = Math.max(0, caixa.disponiveis - 1);
  await expect(cells(page, 'Caixa')).toHaveText(['5', String(expectedAvailable), String(5 - expectedAvailable)]);
  await selected.selectOption(String(otherEnsaio.id));
  await expect(cells(page, 'Caixa')).toHaveText(['1', String(expectedAvailable), String(Math.max(0, 1 - expectedAvailable))]);
  await page.screenshot({ path: testInfo.outputPath('demanda-api.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('backend publicado protege consulta e distingue ensaio cancelado e inexistente', async ({ page, request }) => {
  await loginDemanda(page);
  expect((await page.request.get(`/api/ensaios/${cancelledEnsaio.id}/demanda`)).status()).toBe(409);
  expect((await page.request.get('/api/ensaios/999999/demanda')).status()).toBe(404);
  expect((await request.get(`/api/ensaios/${scheduledEnsaio.id}/demanda`)).status()).toBe(401);
  expect((await page.request.get(`/api/ensaios/${scheduledEnsaio.id}/demanda?extra=1`)).status()).toBe(400);
  await page.goto('/acesso');
  // A sessão de diretoria continua ativa; encerrar pelo cliente HTTP antes do login de integrante.
  expect((await page.request.post('/api/auth/logout', { data: {} })).status()).toBe(204);
  await loginDemanda(page, 'integrante');
  await expect(page).toHaveURL(/\/ensaios$/);
  expect((await page.request.get(`/api/ensaios/${scheduledEnsaio.id}/demanda`)).status()).toBe(403);
  await page.goto('/demanda');
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
});
