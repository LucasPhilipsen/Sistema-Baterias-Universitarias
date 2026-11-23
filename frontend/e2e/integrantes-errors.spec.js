import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/integrantes');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill('diretoria@bateria.example');
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill('DiretoriaDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('estados de carregamento, vazio, falha e nova tentativa sem expor campos extras', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/integrantes', async route => { await gate; await route.fulfill({ json: { integrantes: [] } }); });
  await login(page);
  await expect(page.getByText('Carregando integrantes…', { exact: true })).toBeVisible();
  release();
  await expect(page.getByText('Nenhum integrante cadastrado.', { exact: true })).toBeVisible();
  await page.unroute('**/api/integrantes');
  await page.route('**/api/integrantes', route => route.abort());
  await page.getByRole('button', { name: 'Atualizar lista' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await page.unroute('**/api/integrantes');
  await page.route('**/api/integrantes', route => route.fulfill({ json: { integrantes: [{ id: 999, nome: 'Ana segura', email: 'ana@bateria.example', perfil: 'INTEGRANTE', senhaHash: 'hash-secreto', senha: 'senha-secreta' }] } }));
  await page.getByRole('button', { name: 'Atualizar lista' }).click();
  await expect(page.getByRole('heading', { name: 'Ana segura' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('hash-secreto');
  await expect(page.locator('main')).not.toContainText('senha-secreta');
  await page.getByLabel('Buscar por nome ou e-mail').fill('inexistente');
  await expect(page.getByText('Nenhum integrante encontrado para esta busca.')).toBeVisible();
});

test('consulta individual com falha permite repetir e gravação incerta preserva formulário', async ({ page }) => {
  await login(page);
  const button = page.getByRole('button', { name: /^Consultar / }).first();
  await expect(button).toBeVisible();
  await page.route(/\/api\/integrantes\/\d+$/, route => route.fulfill({ status: 404, json: { error: { code: 'INTEGRANTE_NAO_ENCONTRADO', message: 'erro interno' } } }));
  await button.click();
  await expect(page.getByRole('alert')).toContainText('Integrante não encontrado');
  await page.unroute(/\/api\/integrantes\/\d+$/);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Consultar integrante', exact: true }).getByRole('button', { name: 'Editar integrante' })).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar integrante', exact: true }).click();
  await page.getByLabel('Nome (obrigatório)', { exact: true }).fill('Não confirmado');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill('incerto@bateria.example');
  await page.getByLabel('Senha inicial (obrigatório)', { exact: true }).fill('SenhaTeste!2026');
  let writes = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/integrantes', async route => { writes++; await gate; await route.abort(); });
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  await expect(page.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Fechar formulário' })).toBeDisabled();
  expect(writes).toBe(1);
  release();
  await expect(page.getByRole('alert')).toContainText('Atualize a lista antes de tentar salvar novamente');
  await expect(page.getByLabel('Nome (obrigatório)', { exact: true })).toHaveValue('Não confirmado');
  await expect(page.getByText('Integrante cadastrado com sucesso.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar formulário' }).click();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('perda de perfil durante gravação remove formulário, senha e navegação administrativa', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Cadastrar integrante', exact: true }).click();
  await page.getByLabel('Nome (obrigatório)', { exact: true }).fill('Permissão revogada');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill('revogada@bateria.example');
  await page.getByLabel('Senha inicial (obrigatório)', { exact: true }).fill('SenhaTeste!2026');
  await page.route('**/api/auth/me', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.usuario.perfil = 'INTEGRANTE';
    await route.fulfill({ response, json: data });
  });
  await page.route('**/api/integrantes', route => route.fulfill({ status: 403, json: { error: { code: 'ACESSO_NEGADO' } } }));
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  await expect(page.getByRole('heading', { name: 'Acesso restrito à diretoria' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Integrantes', exact: true })).toHaveCount(0);
  await expect(page.getByText('Integrante cadastrado com sucesso.', { exact: true })).toHaveCount(0);
});

test('confirmação malformada não anuncia gravação concluída', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Cadastrar integrante', exact: true }).click();
  await page.getByLabel('Nome (obrigatório)', { exact: true }).fill('Ana');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill('ana@bateria.example');
  await page.getByLabel('Senha inicial (obrigatório)', { exact: true }).fill('SenhaTeste!2026');
  await page.route('**/api/integrantes', route => route.fulfill({ json: {} }));
  await page.getByRole('button', { name: 'Salvar integrante' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar a gravação');
  await expect(page.getByText('Integrante cadastrado com sucesso.', { exact: true })).toHaveCount(0);
});
