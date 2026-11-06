import { test, expect } from '@playwright/test';

async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

async function login(page, perfil = 'integrante') {
  await page.goto('/acesso');
  await page.getByLabel('E-mail', { exact: false }).fill(`${perfil}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(perfil === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(perfil === 'diretoria' ? /\/administracao$/ : /\/ensaios$/);
  await openNavigation(page);
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
}

test('acesso direto exige login, credenciais inválidas informam erro e preservam e-mail', async ({ page }) => {
  await page.goto('/instrumentos');
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole('heading', { name: 'Instrumentos e estoque' })).toHaveCount(0);
  await page.getByLabel('E-mail', { exact: false }).fill('integrante@bateria.example');
  const senha = page.getByLabel('Senha (obrigatório)', { exact: true });
  await senha.fill('senha errada');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  await expect(senha).toHaveValue('');
  await expect(page.getByLabel('E-mail', { exact: false })).toHaveValue('integrante@bateria.example');
  await senha.fill('IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/instrumentos$/);
});

test('login real usa cookie HttpOnly, restaura sessão na recarga e permite navegação', async ({ page, context }) => {
  await login(page);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Diretoria', exact: true })).toHaveCount(0);
  const cookie = (await context.cookies()).find(cookie => cookie.name === 'bateria_sessao');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/api' });
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ensaios', exact: true })).toBeVisible();
  await openNavigation(page);
  await expect(page.getByText('Integrante de Demonstração', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Instrumentos e estoque' }).click();
  await expect(page.getByRole('heading', { name: 'Instrumentos e estoque' })).toBeVisible();
});

test('integrante recebe acesso negado na URL administrativa e 403 diretamente na API', async ({ page, request }) => {
  await login(page);
  expect((await page.request.get('/api/e2e/diretoria')).status()).toBe(403);
  expect((await request.get('/api/e2e/diretoria')).status()).toBe(401);
  await page.goto('/administracao');
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Organize o próximo encontro.' })).toHaveCount(0);
});

test('diretoria tem destino e navegação próprios e autorização do backend', async ({ page }) => {
  await login(page, 'diretoria');
  await expect(page.getByRole('heading', { name: 'Organize o próximo encontro.' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Diretoria', exact: true })).toBeVisible();
  expect((await page.request.get('/api/e2e/diretoria')).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Organize o próximo encontro.' })).toBeVisible();
});

test('logout revoga a sessão e voltar ou recarregar não reabre o módulo', async ({ page, context }) => {
  await login(page);
  const cookie = (await context.cookies()).find(cookie => cookie.name === 'bateria_sessao');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByText('Sessão encerrada com sucesso.')).toBeVisible();
  expect((await page.request.get('/api/auth/me', { headers: { Cookie: `${cookie.name}=${cookie.value}` } })).status()).toBe(401);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Ensaios', exact: true })).toHaveCount(0);
  await page.goto('/ensaios');
  await expect(page).toHaveURL(/\/acesso$/);
});

test('cookie expirado pede novo login e recupera o destino solicitado', async ({ page, context }) => {
  await login(page);
  await context.clearCookies();
  await page.getByRole('navigation').getByRole('link', { name: 'Instrumentos e estoque' }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByText('Sua sessão expirou ou foi encerrada. Entre novamente para continuar.')).toBeVisible();
  await page.getByLabel('E-mail', { exact: false }).fill('integrante@bateria.example');
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill('IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/instrumentos$/);
});

test('falha de sessão bloqueia o conteúdo e permite nova tentativa', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.abort());
  await page.goto('/instrumentos');
  await expect(page.getByRole('heading', { name: 'Não foi possível confirmar sua sessão' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Instrumentos e estoque' })).toHaveCount(0);
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});

test('429 informa excesso de tentativas sem expor detalhes da resposta', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 429, json: { error: { code: 'MUITAS_TENTATIVAS', message: 'detalhe interno' } } }));
  await page.goto('/acesso');
  await page.getByLabel('E-mail', { exact: false }).fill('integrante@bateria.example');
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill('senha');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Muitas tentativas. Aguarde antes de tentar novamente.');
});

test('logout em outra aba invalida a navegação protegida', async ({ page, context }) => {
  await login(page);
  const other = await context.newPage();
  await other.goto('/instrumentos');
  await expect(other.getByRole('heading', { name: 'Instrumentos e estoque' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(other).toHaveURL(/\/acesso$/);
  await other.close();
});

test('mudança de perfil informada pela API remove acesso à diretoria ao retomar a aba', async ({ page }) => {
  await login(page, 'diretoria');
  await page.route('**/api/auth/me', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.usuario.perfil = 'INTEGRANTE';
    await route.fulfill({ response, json: data });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Diretoria', exact: true })).toHaveCount(0);
});

test('falha no logout não anuncia saída e permite tentar revogação novamente', async ({ page }) => {
  await login(page);
  await page.route('**/api/auth/logout', route => route.abort());
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Não foi possível encerrar a sessão no servidor. Tente sair novamente.');
  await page.unroute('**/api/auth/logout');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByText('Sessão encerrada com sucesso.')).toBeVisible();
});

test('formulário respeita teclado e viewport sem rolagem horizontal', async ({ page }, testInfo) => {
  await page.goto('/acesso');
  const email = page.getByLabel('E-mail', { exact: false });
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha (obrigatório)', { exact: true })).toBeFocused();
  await page.getByLabel('Mostrar senha').check();
  await expect(page.getByLabel('Senha (obrigatório)', { exact: true })).toHaveAttribute('type', 'text');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('acesso.png'), fullPage: true });
});
