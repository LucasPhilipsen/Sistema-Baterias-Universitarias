import { test, expect } from '@playwright/test';
import { postgresTestPool } from './support/postgres-pool.js';
import { loginParticipacoes, participationRoute } from './support/participacoes-fixtures.js';

test.skip(process.env.CONFIRMACOES_E2E_POSTGRES !== '1', 'Exige API SCRUM-41 e PostgreSQL descartável reais.');
const cardFor = (page, name) => page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
const confirmed = card => card.getByText('Confirmada:', { exact: false });

async function prepare(playwright, baseURL, testInfo) {
  const api = await playwright.request.newContext({ baseURL });
  expect((await api.post('/api/auth/login', { data: { email: 'diretoria@bateria.example', senha: 'DiretoriaDemo!2026' } })).status()).toBe(200);
  const name = `Participação ${testInfo.project.name} ${Date.now()}`;
  const result = await api.post('/api/ensaios', { data: { inicioEm: '2026-11-25T22:00:00.000Z', local: name, descricao: null } });
  expect(result.status()).toBe(201);
  const { ensaio } = await result.json();
  const { tiposInstrumentos } = await (await api.get('/api/tipos-instrumentos')).json();
  return { api, ensaio, tipos: tiposInstrumentos };
}

test('integrante confirma, troca, cancela e reconfirma com recarga, SQL e unidade sem reserva', async ({ page, playwright, baseURL }, testInfo) => {
  const { api, ensaio, tipos } = await prepare(playwright, baseURL, testInfo);
  const pool = postgresTestPool();
  try {
    const beforeUnits = (await pool.query('SELECT id, situacao FROM instrumentos ORDER BY id')).rows;
    await loginParticipacoes(page);
    const card = cardFor(page, ensaio.local);
    const select = card.getByLabel('Tipo de instrumento', { exact: true });
    await expect(select).toBeEnabled();
    await expect(card.getByText('Você não confirmou participação neste ensaio.')).toBeVisible();
    await select.selectOption(String(tipos[0].id));
    const saved = page.waitForResponse(r => participationRoute.test(r.url()) && r.request().method() === 'PUT');
    await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
    const savedResponse = await saved;
    expect(savedResponse.status()).toBe(200);
    expect(savedResponse.request().postDataJSON()).toEqual({ tipoInstrumentoId: tipos[0].id });
    const original = (await savedResponse.json()).participacao;
    await expect(confirmed(card)).toContainText(tipos[0].nome);
    await page.reload();
    await expect(confirmed(card)).toContainText(tipos[0].nome);
    // Repetição idempotente pela API mantém um único registro, sem criar outra participação.
    const duplicate = await page.request.put(`/api/ensaios/${ensaio.id}/minha-participacao`, { data: { tipoInstrumentoId: tipos[0].id } });
    expect(duplicate.status()).toBe(200);
    expect((await duplicate.json()).participacao.id).toBe(original.id);
    const { usuario } = await (await page.request.get('/api/auth/me')).json();
    const query = () => pool.query('SELECT id, tipo_instrumento_id, cancelado_em FROM confirmacoes WHERE ensaio_id = $1 AND usuario_id = $2', [ensaio.id, usuario.id]);
    expect((await query()).rowCount).toBe(1);
    await select.selectOption(String(tipos[1].id));
    await card.getByRole('button', { name: 'Salvar instrumento', exact: true }).click();
    await expect(confirmed(card)).toContainText(tipos[1].nome);
    expect((await query()).rows[0].tipo_instrumento_id).toBe(tipos[1].id);
    await page.reload();
    await expect(confirmed(card)).toContainText(tipos[1].nome);
    await card.getByRole('button', { name: 'Cancelar participação', exact: true }).click();
    const removed = page.waitForResponse(r => participationRoute.test(r.url()) && r.request().method() === 'DELETE');
    await card.getByRole('button', { name: 'Confirmar cancelamento da participação', exact: true }).click();
    const removedResponse = await removed;
    expect(removedResponse.status()).toBe(200);
    expect(removedResponse.request().postData()).toBe(null);
    expect(await removedResponse.json()).toEqual({ participacao: null });
    await expect(card.getByText('Participação cancelada.', { exact: true })).toBeVisible();
    expect((await query()).rows[0].cancelado_em).not.toBe(null);
    await page.reload();
    await expect(card.getByText('Você não confirmou participação neste ensaio.')).toBeVisible();
    await select.selectOption(String(tipos[0].id));
    await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
    await expect(confirmed(card)).toContainText(tipos[0].nome);
    const finalRows = await query();
    expect(finalRows.rowCount).toBe(1);
    expect(finalRows.rows[0]).toMatchObject({ id: original.id, tipo_instrumento_id: tipos[0].id, cancelado_em: null });
    expect((await pool.query('SELECT id, situacao FROM instrumentos ORDER BY id')).rows).toEqual(beforeUnits);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('participacao-postgres-320.png'), fullPage: true });
  } finally { await pool.end(); await api.dispose(); }
});

test('sessões de integrante e diretoria alteram apenas a própria participação', async ({ page, playwright, baseURL }, testInfo) => {
  const { api, ensaio, tipos } = await prepare(playwright, baseURL, testInfo);
  try {
    await loginParticipacoes(page);
    const card = cardFor(page, ensaio.local);
    await card.getByLabel('Tipo de instrumento', { exact: true }).selectOption(String(tipos[0].id));
    await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
    await expect(confirmed(card)).toContainText(tipos[0].nome);
    const path = `/api/ensaios/${ensaio.id}/minha-participacao`;
    expect(await (await api.get(path)).json()).toEqual({ participacao: null });
    expect((await api.put(path, { data: { tipoInstrumentoId: tipos[1].id } })).status()).toBe(200);
    expect((await (await page.request.get(path)).json()).participacao.tipoInstrumentoId).toBe(tipos[0].id);
    expect((await page.request.put(path, { data: { tipoInstrumentoId: tipos[1].id, usuarioId: 1 } })).status()).toBe(400);
    expect((await page.request.get(`${path}?usuarioId=1`)).status()).toBe(400);
    await card.getByRole('button', { name: 'Atualizar participação', exact: true }).click();
    await expect(confirmed(card)).toContainText(tipos[0].nome);
  } finally { await api.dispose(); }
});

test('ensaio cancelado após carregar a agenda retorna 409 e retira as ações', async ({ page, playwright, baseURL }, testInfo) => {
  const { api, ensaio, tipos } = await prepare(playwright, baseURL, testInfo);
  try {
    await loginParticipacoes(page);
    const card = cardFor(page, ensaio.local);
    await card.getByLabel('Tipo de instrumento', { exact: true }).selectOption(String(tipos[0].id));
    expect((await api.patch(`/api/ensaios/${ensaio.id}/cancelamento`, { data: {} })).status()).toBe(200);
    const refused = page.waitForResponse(r => participationRoute.test(r.url()) && r.request().method() === 'PUT');
    await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
    expect((await refused).status()).toBe(409);
    await expect(card.getByRole('alert')).toContainText('ensaio foi cancelado');
    await expect(card.getByRole('button')).toHaveCount(0);
    await page.getByRole('button', { name: 'Atualizar agenda', exact: true }).click();
    await expect(card.getByText('Cancelado', { exact: true })).toBeVisible();
    await expect(card.getByRole('button')).toHaveCount(0);
    expect((await page.request.delete(`/api/ensaios/${ensaio.id}/minha-participacao`)).status()).toBe(409);
  } finally { await api.dispose(); }
});

test('diretoria participa sem perder a gestão e consulta registro preservado de ensaio cancelado', async ({ page, playwright, baseURL }, testInfo) => {
  const { api, ensaio, tipos } = await prepare(playwright, baseURL, testInfo);
  const pool = postgresTestPool();
  try {
    await loginParticipacoes(page, 'diretoria');
    const card = cardFor(page, ensaio.local);
    await expect(card.getByRole('button', { name: `Editar ensaio em ${ensaio.local}`, exact: true })).toBeVisible();
    await card.getByLabel('Tipo de instrumento', { exact: true }).selectOption(String(tipos[0].id));
    await card.getByRole('button', { name: 'Confirmar participação', exact: true }).click();
    await expect(confirmed(card)).toContainText(tipos[0].nome);
    await card.getByRole('button', { name: `Cancelar ensaio em ${ensaio.local}`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar cancelamento', exact: true }).click();
    await expect(card.getByText('Participação registrada:', { exact: false })).toContainText(tipos[0].nome);
    await expect(card.getByRole('button')).toHaveCount(0);
    await page.reload();
    await expect(card.getByText('Participação registrada:', { exact: false })).toContainText(tipos[0].nome);
    expect((await pool.query('SELECT cancelado_em FROM confirmacoes WHERE ensaio_id = $1', [ensaio.id])).rows[0].cancelado_em).toBe(null);
    const anonymous = await playwright.request.newContext({ baseURL });
    try { expect((await anonymous.get(`/api/ensaios/${ensaio.id}/minha-participacao`)).status()).toBe(401); }
    finally { await anonymous.dispose(); }
    await page.screenshot({ path: testInfo.outputPath('participacao-diretoria-cancelado.png'), fullPage: true });
  } finally { await pool.end(); await api.dispose(); }
});
