import { test, expect } from '@playwright/test';
import { cancelledEnsaio, comparison, loginDemanda, otherEnsaio, scheduledEnsaio, setupDemanda } from './support/demanda-fixtures.js';

test.use({ timezoneId: 'Asia/Tokyo' });
const demandRoute = /\/api\/ensaios\/\d+\/demanda$/;
const row = (page, name) => page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(name) }) });

test('diretoria seleciona IDs da API, vê falta e horário e atualiza sem manter comparação antiga', async ({ page }, testInfo) => {
  const requests = [];
  page.on('request', request => { if (demandRoute.test(request.url())) requests.push(request); });
  await setupDemanda(page);
  await expect(page.getByRole('heading', { name: 'Demanda e disponibilidade', exact: true })).toBeVisible();
  await expect(page.getByText('Selecione um ensaio para consultar a demanda e a disponibilidade.')).toBeVisible();
  expect(requests).toHaveLength(0);
  const select = page.getByLabel('Ensaio', { exact: true });
  await expect(select.getByRole('option')).toHaveCount(3);
  await expect(select).not.toContainText(cancelledEnsaio.local);
  await select.selectOption(String(scheduledEnsaio.id));
  await expect(row(page, '^Caixa')).toContainText('Insuficiente');
  await expect(row(page, '^Caixa').getByRole('cell')).toHaveText(['5', '3', '2']);
  await expect(row(page, '^Repinique').getByRole('cell')).toHaveText(['0', '2', '0']);
  await expect(row(page, '^Surdo').getByRole('cell')).toHaveText(['2', '0', '2']);
  await expect(page.getByText('23/11/2026, 18:30:12', { exact: true })).toBeVisible();
  await expect(page.getByText(/Esta comparação não reserva unidades/)).toBeVisible();
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('demanda-320.png'), fullPage: true });
  await page.setViewportSize(viewport);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(demandRoute, async route => {
    await gate;
    const updated = comparison(scheduledEnsaio.id);
    updated.demanda.tipos[0] = { ...updated.demanda.tipos[0], disponiveis: 2, falta: 3 };
    updated.demanda.calculadoEm = '2026-11-23T22:30:12.000Z';
    await route.fulfill({ json: updated });
  });
  await page.getByRole('button', { name: 'Atualizar comparação' }).click();
  await expect(page.getByText('Carregando comparação…', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar comparação' })).toBeDisabled();
  await expect(page.getByRole('table')).toHaveCount(0);
  release();
  await expect(row(page, '^Caixa').getByRole('cell')).toHaveText(['5', '2', '3']);
  await expect(page.getByText('23/11/2026, 19:30:12', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests.every(request => request.method() === 'GET' && !new URL(request.url()).search)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('demanda-desktop-mobile.png'), fullPage: true });
  await page.reload();
  await expect(select).toHaveValue('');
  await expect(page.getByRole('table')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.goto('/administracao');
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Demanda e disponibilidade', exact: true }) }).click();
  await expect(page).toHaveURL(/\/demanda$/);
});

test('resposta antiga de outro ensaio não substitui a seleção atual', async ({ page }) => {
  await setupDemanda(page);
  let release;
  let returned;
  const gate = new Promise(resolve => { release = resolve; });
  const completed = new Promise(resolve => { returned = resolve; });
  await page.route(demandRoute, async route => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[3]);
    const result = comparison(id);
    result.demanda.tipos = [result.demanda.tipos[id === scheduledEnsaio.id ? 0 : 1]];
    if (id === scheduledEnsaio.id) await gate;
    try { await route.fulfill({ json: result }); } finally { if (id === scheduledEnsaio.id) returned(); }
  });
  await page.getByLabel('Ensaio', { exact: true }).selectOption(String(scheduledEnsaio.id));
  await expect(page.getByText('Carregando comparação…', { exact: true })).toBeVisible();
  await page.getByLabel('Ensaio', { exact: true }).selectOption(String(otherEnsaio.id));
  await expect(row(page, '^Repinique')).toBeVisible();
  release();
  await completed;
  await expect(row(page, '^Repinique')).toBeVisible();
  await expect(row(page, '^Caixa')).toHaveCount(0);
});

test('agenda vazia, falha e recuperação não produzem comparações fictícias', async ({ page }) => {
  let mode = 'empty';
  await page.route('**/api/ensaios?situacao=AGENDADO', route => mode === 'fail' ? route.abort() : route.fulfill({ json: { ensaios: mode === 'empty' ? [] : [scheduledEnsaio] } }));
  await loginDemanda(page);
  await expect(page.getByText('Nenhum ensaio agendado para comparar.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  mode = 'fail';
  await page.getByRole('button', { name: 'Atualizar ensaios' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar os ensaios');
  mode = 'success';
  await page.getByRole('button', { name: 'Atualizar ensaios' }).click();
  await expect(page.getByLabel('Ensaio', { exact: true })).toBeVisible();
});

test('sem tipos exibe vazio; sem falta informa estoque suficiente', async ({ page }) => {
  await setupDemanda(page);
  let empty = true;
  await page.route(demandRoute, route => {
    const result = comparison();
    result.demanda.tipos = empty ? [] : [{ tipoInstrumentoId: 128, nome: 'Repinique', confirmados: 0, disponiveis: 0, falta: 0 }];
    return route.fulfill({ json: result });
  });
  await page.getByLabel('Ensaio', { exact: true }).selectOption(String(scheduledEnsaio.id));
  await expect(page.getByText('Nenhum tipo de instrumento cadastrado para comparar.')).toBeVisible();
  await expect(page.getByText('O estoque atual atende às confirmações deste ensaio.')).toHaveCount(0);
  empty = false;
  await page.getByRole('button', { name: 'Atualizar comparação' }).click();
  await expect(page.getByText('O estoque atual atende às confirmações deste ensaio.')).toBeVisible();
  await expect(row(page, '^Repinique').getByRole('cell')).toHaveText(['0', '0', '0']);
});

for (const [status, code, message] of [
  [400, 'DADOS_INVALIDOS', 'Atualize os ensaios'], [403, 'ACESSO_NEGADO', 'Acesso restrito à diretoria'],
  [404, 'ENSAIO_NAO_ENCONTRADO', 'não está disponível'], [409, 'ENSAIO_CANCELADO', 'foi cancelado'], [500, 'ERRO_INTERNO', 'Não foi possível carregar a comparação'],
]) {
  test(`erro ${status} remove resultados e permite nova consulta`, async ({ page }) => {
    await setupDemanda(page);
    await page.getByLabel('Ensaio', { exact: true }).selectOption(String(scheduledEnsaio.id));
    await expect(page.getByRole('table')).toBeVisible();
    await page.route(demandRoute, route => route.fulfill({ status, json: { error: { code, message: 'SQL e segredo interno' } } }));
    await page.getByRole('button', { name: 'Atualizar comparação' }).click();
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('SQL e segredo interno');
    await expect(page.getByRole('button', { name: 'Atualizar comparação' })).toBeEnabled();
  });
}

test('resposta malformada e falha de rede não mantêm números anteriores', async ({ page }) => {
  await setupDemanda(page);
  await page.getByLabel('Ensaio', { exact: true }).selectOption(String(scheduledEnsaio.id));
  await expect(page.getByRole('table')).toBeVisible();
  let networkFailure = false;
  await page.route(demandRoute, route => networkFailure ? route.abort() : route.fulfill({ json: comparison(otherEnsaio.id) }));
  await page.getByRole('button', { name: 'Atualizar comparação' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar a comparação');
  await expect(page.getByRole('table')).toHaveCount(0);
  networkFailure = true;
  await page.getByRole('button', { name: 'Atualizar comparação' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar a comparação');
});

test('ensaio removido ou cancelado sai da seleção ao atualizar agenda', async ({ page }) => {
  await setupDemanda(page);
  await page.getByLabel('Ensaio', { exact: true }).selectOption(String(scheduledEnsaio.id));
  await expect(page.getByRole('table')).toBeVisible();
  await page.route('**/api/ensaios?situacao=AGENDADO', route => route.fulfill({ json: { ensaios: [otherEnsaio] } }));
  await page.getByRole('button', { name: 'Atualizar ensaios' }).click();
  await expect(page.getByLabel('Ensaio', { exact: true })).toHaveValue('');
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('integrante recebe acesso restrito sem consultar agenda ou demanda administrativa', async ({ page }) => {
  await loginDemanda(page, 'integrante');
  await expect(page).toHaveURL(/\/ensaios$/);
  const calls = [];
  page.on('request', request => { if (demandRoute.test(request.url()) || request.url().endsWith('/api/ensaios?situacao=AGENDADO')) calls.push(request); });
  await page.goto('/demanda');
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  expect(calls).toHaveLength(0);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Demanda e disponibilidade', exact: true })).toHaveCount(0);
});

test('sessão expirada e perda de perfil retiram o painel', async ({ page }) => {
  await setupDemanda(page);
  await page.getByLabel('Ensaio', { exact: true }).selectOption(String(scheduledEnsaio.id));
  await expect(page.getByRole('table')).toBeVisible();
  await page.route('**/api/auth/me', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.usuario.perfil = 'INTEGRANTE';
    await route.fulfill({ response, json: data });
  });
  await page.route(demandRoute, route => route.fulfill({ status: 403, json: { error: { code: 'ACESSO_NEGADO' } } }));
  await page.getByRole('button', { name: 'Atualizar comparação' }).click();
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.unroute('**/api/auth/me');
  await page.goto('/demanda');
  await expect(page.getByLabel('Ensaio', { exact: true })).toBeVisible();
  await page.route(demandRoute, route => route.fulfill({ status: 401, json: { error: { code: 'SESSAO_INVALIDA' } } }));
  await page.getByLabel('Ensaio', { exact: true }).selectOption(String(scheduledEnsaio.id));
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole('table')).toHaveCount(0);
});
