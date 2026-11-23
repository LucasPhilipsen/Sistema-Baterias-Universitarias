import { test, expect } from '@playwright/test';
import { cardFor, exampleEnsaio, cancelledEnsaio, loginParticipacoes, mockParticipacoes, participation, participationRoute, tipos } from './support/participacoes-fixtures.js';

test('confirma, troca tipo, cancela e consulta usando o contrato; ensaio cancelado conserva histórico sem ações', async ({ page }, testInfo) => {
  await mockParticipacoes(page);
  await loginParticipacoes(page);
  const card = cardFor(page);
  await expect(card.getByText('Você não confirmou participação neste ensaio.')).toBeVisible();
  const select = card.getByLabel('Tipo de instrumento', { exact: true });
  await expect(select).toBeEnabled();
  await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
  await expect(select).toHaveAttribute('aria-invalid', 'true');
  await expect(select).toBeFocused();
  await select.selectOption(String(tipos[0].id));
  const saved = page.waitForResponse(r => participationRoute.test(r.url()) && r.request().method() === 'PUT');
  await card.getByRole('button', { name: 'Confirmar participação', exact: true }).focus();
  await page.keyboard.press('Enter');
  const response = await saved;
  expect(response.request().postDataJSON()).toEqual({ tipoInstrumentoId: tipos[0].id });
  await expect(card.getByText('Confirmada:', { exact: false })).toContainText('Caixa');
  await expect(card.getByText('Participação confirmada.', { exact: true })).toBeVisible();
  await select.selectOption(String(tipos[1].id));
  await card.getByRole('button', { name: 'Salvar instrumento', exact: true }).click();
  await expect(card.getByText('Confirmada:', { exact: false })).toContainText('Repinique');
  await card.getByRole('button', { name: 'Cancelar participação', exact: true }).click();
  await card.getByRole('button', { name: 'Manter participação', exact: true }).click();
  await expect(card.getByText('Confirmada:', { exact: false })).toContainText('Repinique');
  await card.getByRole('button', { name: 'Cancelar participação', exact: true }).click();
  const removed = page.waitForResponse(r => participationRoute.test(r.url()) && r.request().method() === 'DELETE');
  await card.getByRole('button', { name: 'Confirmar cancelamento da participação', exact: true }).click();
  expect((await removed).request().postData()).toBe(null);
  await expect(card.getByText('Participação cancelada.', { exact: true })).toBeVisible();
  await expect(card.getByText('Você não confirmou participação neste ensaio.')).toBeVisible();
  await card.getByRole('button', { name: 'Atualizar participação', exact: true }).click();
  await expect(card.getByText('Você não confirmou participação neste ensaio.')).toBeVisible();
  const cancelled = cardFor(page, cancelledEnsaio.local);
  await expect(cancelled.getByText('Participação registrada:', { exact: false })).toContainText('Caixa');
  await expect(cancelled.getByRole('button')).toHaveCount(0);
  await expect(cancelled.getByRole('combobox')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('participacao-320.png'), fullPage: true });
});

test('carregamento e ausência de tipos bloqueiam confirmação; falha pode ser recuperada', async ({ page }) => {
  await mockParticipacoes(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/tipos-instrumentos', async route => { await gate; await route.fulfill({ json: { tiposInstrumentos: [] } }); });
  await loginParticipacoes(page);
  const card = cardFor(page);
  await expect(card.getByText('Você não confirmou participação neste ensaio.')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Confirmar participação', exact: true })).toBeDisabled();
  release();
  await expect(page.getByText(/Nenhum tipo de instrumento cadastrado/)).toBeVisible();
  await page.route('**/api/tipos-instrumentos', route => route.abort());
  await page.getByRole('button', { name: 'Atualizar tipos', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar os tipos');
  await page.route('**/api/tipos-instrumentos', route => route.fulfill({ json: { tiposInstrumentos: tipos } }));
  await page.getByRole('button', { name: 'Atualizar tipos', exact: true }).click();
  await expect(card.getByLabel('Tipo de instrumento', { exact: true })).toBeEnabled();
});

test('consulta malformada ou com falha não permite sobrescrever participação desconhecida', async ({ page }) => {
  await mockParticipacoes(page);
  let malformed = false;
  await page.route(participationRoute, route => malformed ? route.fulfill({ json: {} }) : route.abort());
  await loginParticipacoes(page);
  const card = cardFor(page);
  await expect(card.getByRole('alert')).toContainText('Não foi possível consultar sua participação');
  await expect(card.getByRole('button', { name: 'Confirmar participação', exact: true })).toHaveCount(0);
  malformed = true;
  await card.getByRole('button', { name: 'Atualizar participação', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Não foi possível consultar sua participação');
  await page.route(participationRoute, route => route.fulfill({ json: { participacao: null } }));
  await card.getByRole('button', { name: 'Atualizar participação', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Confirmar participação', exact: true })).toBeEnabled();
});

test('envio único bloqueia campos e filtros; falha incerta exige consultar antes de repetir', async ({ page }) => {
  await mockParticipacoes(page);
  await loginParticipacoes(page);
  const card = cardFor(page);
  await card.getByLabel('Tipo de instrumento', { exact: true }).selectOption(String(tipos[0].id));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route(participationRoute, async route => {
    if (route.request().method() !== 'PUT') return route.fulfill({ json: { participacao: null } });
    calls++; await gate; await route.abort();
  });
  await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Salvando participação…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Situação', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Atualizar agenda', exact: true })).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(card.getByRole('alert')).toContainText('Atualize sua participação antes de repetir');
  await expect(card.getByRole('button', { name: 'Confirmar participação', exact: true })).toBeDisabled();
  await expect(card.getByText('Participação confirmada.', { exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: 'Atualizar participação', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Confirmar participação', exact: true })).toBeEnabled();
});

for (const [status, code, text] of [
  [400, 'TIPO_INSTRUMENTO_INVALIDO', 'Atualize os tipos'], [403, 'ACESSO_NEGADO', 'não tem permissão'],
  [404, 'ENSAIO_NAO_ENCONTRADO', 'Atualize a agenda'], [409, 'CONFLITO', 'participação já existe'],
  [409, 'ENSAIO_CANCELADO', 'ensaio foi cancelado'], [500, 'ERRO_INTERNO', 'Não foi possível confirmar a alteração'],
]) {
  test(`erro ${status}/${code} não anuncia sucesso e preserva o controle do estado`, async ({ page }) => {
    await mockParticipacoes(page);
    await loginParticipacoes(page);
    const card = cardFor(page);
    await card.getByLabel('Tipo de instrumento', { exact: true }).selectOption(String(tipos[0].id));
    await page.route(participationRoute, route => route.request().method() === 'PUT'
      ? route.fulfill({ status, json: { error: { code, message: 'SQL segredo' } } }) : route.fulfill({ json: { participacao: null } }));
    await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
    await expect(card.getByRole('alert')).toContainText(text);
    await expect(card).not.toContainText('SQL segredo');
    await expect(card.getByText('Participação confirmada.', { exact: true })).toHaveCount(0);
    if (code === 'TIPO_INSTRUMENTO_INVALIDO') {
      await page.route('**/api/tipos-instrumentos', route => route.fulfill({ json: { tiposInstrumentos: [tipos[1]] } }));
      await page.getByRole('button', { name: 'Atualizar tipos', exact: true }).click();
      await expect(card.getByLabel('Tipo de instrumento', { exact: true }).getByRole('option')).toHaveCount(2);
      await page.route(participationRoute, route => route.fulfill({ json: { participacao: participation(exampleEnsaio.id, tipos[1]) } }));
      await card.getByLabel('Tipo de instrumento', { exact: true }).selectOption(String(tipos[1].id));
      await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
      await expect(card.getByText('Confirmada:', { exact: false })).toContainText(tipos[1].nome);
    }
    if (code === 'ENSAIO_CANCELADO') {
      await expect(card.getByRole('button')).toHaveCount(0);
      await expect(card.getByRole('combobox')).toHaveCount(0);
    }
  });
}

test('confirmação de outro ensaio é rejeitada e sessão expirada retorna ao login', async ({ page }) => {
  await mockParticipacoes(page);
  await loginParticipacoes(page);
  const card = cardFor(page);
  await card.getByLabel('Tipo de instrumento', { exact: true }).selectOption(String(tipos[0].id));
  await page.route(participationRoute, route => route.fulfill({ json: { participacao: participation(cancelledEnsaio.id) } }));
  await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Não foi possível confirmar a alteração');
  await page.route(participationRoute, route => route.fulfill({ status: 401, json: { error: { code: 'SESSAO_INVALIDA' } } }));
  await card.getByRole('button', { name: 'Atualizar participação', exact: true }).click();
  await expect(page).toHaveURL(/\/acesso$/);
});
