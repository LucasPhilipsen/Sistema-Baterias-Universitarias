import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Tokyo' });

async function login(page, perfil = 'diretoria') {
  await page.goto('/ensaios');
  await page.getByLabel('E-mail', { exact: false }).fill(`${perfil}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(perfil === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agenda de ensaios', exact: true })).toBeVisible();
}

const payload = { inicioEm: '2026-11-10T22:00:00.000Z', local: 'Quadra fictícia', descricao: null };

test('diretoria cadastra, edita e cancela com confirmação HTTP, nova consulta e teclado', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.getByRole('button', { name: 'Cadastrar ensaio', exact: true }).click();
  const data = page.getByLabel('Data (obrigatório)', { exact: true });
  const horario = page.getByLabel('Horário (obrigatório)', { exact: true });
  const local = page.getByLabel('Local (obrigatório)', { exact: true });
  await page.getByRole('button', { name: 'Salvar ensaio' }).click();
  await expect(data).toBeFocused();
  await expect(data).toHaveAttribute('aria-invalid', 'true');
  await data.fill('2026-11-10');
  await data.focus();
  await page.keyboard.press('Tab');
  // Campos de data têm segmentos internos em alguns navegadores; a ordem DOM também é conferida.
  expect(await data.evaluate(element => element.compareDocumentPosition(document.querySelector('[name="horario"]')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await horario.fill('19:00');
  const unique = `Quadra ${testInfo.project.name} ${Date.now()}`;
  await local.fill(`  ${unique}  `);
  await local.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Descrição', { exact: true })).toBeFocused();
  await page.getByLabel('Descrição', { exact: true }).fill('  Ensaio geral\nLevar baquetas.  ');
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('formulario-320.png'), fullPage: true });
  await page.setViewportSize(viewport);
  const created = page.waitForResponse(response => response.url().endsWith('/api/ensaios') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Salvar ensaio' }).focus();
  await page.keyboard.press('Enter');
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({ inicioEm: payload.inicioEm, local: unique, descricao: 'Ensaio geral\nLevar baquetas.' });
  const { ensaio } = await response.json();
  await expect(page.getByText('Ensaio cadastrado.', { exact: true })).toBeVisible();
  let card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: unique, exact: true }) });
  await expect(card).toContainText('19:00');
  await page.reload();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: `Editar ensaio em ${unique}`, exact: true }).click();
  await expect(data).toHaveValue('2026-11-10');
  await expect(horario).toHaveValue('19:00');
  const editedName = `${unique} revisada`;
  await local.fill(editedName);
  await page.getByLabel('Descrição', { exact: true }).fill('');
  const edited = page.waitForResponse(response => response.url().endsWith(`/api/ensaios/${ensaio.id}`) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar ensaio' }).click();
  expect((await edited).status()).toBe(200);
  await expect(page.getByText('Ensaio atualizado.', { exact: true })).toBeVisible();
  card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: editedName, exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: `Cancelar ensaio em ${editedName}` }).click();
  await page.getByRole('button', { name: 'Voltar à agenda', exact: true }).click();
  await expect(card.getByText('Agendado', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: `Cancelar ensaio em ${editedName}` }).click();
  const cancelled = page.waitForResponse(response => response.url().endsWith(`/api/ensaios/${ensaio.id}/cancelamento`));
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  const cancellation = await cancelled;
  expect(cancellation.request().method()).toBe('PATCH');
  expect(cancellation.request().postDataJSON()).toEqual({});
  expect(cancellation.status()).toBe(200);
  await expect(page.getByText('Ensaio cancelado. Ele permanece identificado na agenda.')).toBeVisible();
  await expect(card.getByText('Cancelado', { exact: true })).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(0);
  await page.reload();
  await expect(card.getByText('Cancelado', { exact: true })).toBeVisible();
  const fetched = await page.request.get(`/api/ensaios/${ensaio.id}`);
  expect(await fetched.json()).toMatchObject({ ensaio: { id: ensaio.id, inicioEm: payload.inicioEm, descricao: null, situacao: 'CANCELADO' } });
  expect((await page.request.patch(`/api/ensaios/${ensaio.id}/cancelamento`, { data: {} })).status()).toBe(200);
  const conflict = await page.request.put(`/api/ensaios/${ensaio.id}`, { data: payload });
  expect(conflict.status()).toBe(409);
  expect(await conflict.json()).toMatchObject({ error: { code: 'ENSAIO_CANCELADO' } });
  if (process.env.ENSAIOS_E2E_POSTGRES === '1') {
    const { dbPool } = await import('../../backend/src/config/database.js');
    try {
      const result = await dbPool.query('SELECT inicio_em, local, descricao, situacao FROM ensaios WHERE id = $1', [ensaio.id]);
      expect(result.rows[0]).toMatchObject({ local: editedName, descricao: null, situacao: 'CANCELADO' });
      expect(result.rows[0].inicio_em.toISOString()).toBe(payload.inicioEm);
      expect(Number((await dbPool.query('SELECT count(*) FROM sessoes')).rows[0].count)).toBeGreaterThan(0);
    } finally { await dbPool.end(); }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.screenshot({ path: testInfo.outputPath('agenda-diretoria.png'), fullPage: true });
});

test('integrante consulta e filtra; API real recusa cadastro, edição e cancelamento com 403', async ({ page }, testInfo) => {
  await login(page);
  const created = await page.request.post('/api/ensaios', { data: { ...payload, local: `Consulta ${testInfo.project.name} ${Date.now()}` } });
  expect(created.status()).toBe(201);
  const { ensaio } = await created.json();
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await login(page, 'integrante');
  await expect(page.getByRole('button', { name: 'Cadastrar ensaio' })).toHaveCount(0);
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: ensaio.local, exact: true }) });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(0);
  for (const [method, url, body] of [
    ['POST', '/api/ensaios', payload], ['PUT', `/api/ensaios/${ensaio.id}`, payload], ['PATCH', `/api/ensaios/${ensaio.id}/cancelamento`, {}],
  ]) {
    const result = await page.request.fetch(url, { method, data: body });
    expect(result.status()).toBe(403);
    expect(await result.json()).toMatchObject({ error: { code: 'ACESSO_NEGADO' } });
  }
  expect((await (await page.request.get(`/api/ensaios/${ensaio.id}`)).json()).ensaio.situacao).toBe('AGENDADO');
  await page.getByLabel('Situação', { exact: true }).selectOption('CANCELADO');
  await expect(card).toHaveCount(0);
  await page.getByLabel('Situação', { exact: true }).selectOption('AGENDADO');
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('agenda-integrante.png'), fullPage: true });
});
