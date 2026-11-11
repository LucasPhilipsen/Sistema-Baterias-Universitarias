import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Tokyo' });

const example = { id: 812, inicioEm: '2026-11-11T01:30:45.123Z', local: 'Quadra fictícia', descricao: 'Ensaio geral', situacao: 'AGENDADO' };
async function setup(page) {
  await page.route('**/api/ensaios?*', route => route.fulfill({ json: { ensaios: [] } }));
  await page.route('**/api/ensaios', route => route.fulfill({ json: { ensaios: [example] } }));
  await page.goto('/ensaios');
  await page.getByLabel('E-mail', { exact: false }).fill('diretoria@bateria.example');
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill('DiretoriaDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agenda de ensaios', exact: true })).toBeVisible();
}

test('respostas simuladas: carregamento, vazio, conexão, nova tentativa e fuso diferente do computador', async ({ page }) => {
  await setup(page);
  await expect(page.getByRole('article')).toContainText('22:30');
  await expect(page.getByRole('article')).toContainText('10 de novembro');
  await page.getByLabel('Situação', { exact: true }).selectOption('CANCELADO');
  await expect(page.getByText('Nenhum ensaio nesta situação.')).toBeVisible();
  await page.route('**/api/ensaios?*', route => route.abort());
  await page.getByRole('button', { name: 'Atualizar agenda' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar a agenda.');
  await page.unroute('**/api/ensaios?*');
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/ensaios?*', async route => { await pending; await route.fulfill({ json: { ensaios: [] } }); });
  await page.getByRole('button', { name: 'Atualizar agenda' }).click();
  await expect(page.getByText('Carregando ensaios…')).toBeVisible();
  release();
  await expect(page.getByText('Nenhum ensaio nesta situação.')).toBeVisible();
});

for (const [status, code, message] of [
  [400, 'DADOS_INVALIDOS', 'A API recusou os dados informados.'],
  [403, 'ACESSO_NEGADO', 'Você não tem permissão'],
  [404, 'ENSAIO_NAO_ENCONTRADO', 'Este ensaio não foi encontrado.'],
  [409, 'ENSAIO_CANCELADO', 'Este ensaio já foi cancelado'],
  [500, 'ERRO_INTERNO', 'Não foi possível confirmar a operação.'],
]) {
  test(`resposta simulada ${status}: mantém formulário, trata erro e não confirma sucesso`, async ({ page }) => {
    await setup(page);
    await page.getByRole('button', { name: `Editar ensaio em ${example.local}` }).click();
    await page.getByLabel('Local (obrigatório)', { exact: true }).fill('Local revisado');
    let submitted;
    await page.route(`**/api/ensaios/${example.id}`, route => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status, json: { error: { code, message: 'SQL e detalhe privado' } } });
    });
    await page.getByRole('button', { name: 'Salvar ensaio' }).click();
    await expect(page.getByRole('alert')).toContainText(message);
    expect(submitted).toEqual({ inicioEm: example.inicioEm, local: 'Local revisado', descricao: example.descricao });
    await expect(page.getByLabel('Local (obrigatório)', { exact: true })).toHaveValue('Local revisado');
    await expect(page.getByText('Ensaio atualizado.', { exact: true })).toHaveCount(0);
    await expect(page.getByText('SQL e detalhe privado')).toHaveCount(0);
  });
}

test('resposta simulada 401 durante gravação exige login e não anuncia sucesso', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: `Cancelar ensaio em ${example.local}` }).click();
  await page.route(`**/api/ensaios/${example.id}/cancelamento`, route => route.fulfill({ status: 401, json: { error: { code: 'SESSAO_INVALIDA' } } }));
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByText('Sua sessão expirou ou foi encerrada. Entre novamente para continuar.')).toBeVisible();
  await expect(page.getByText('Ensaio cancelado. Ele permanece identificado na agenda.')).toHaveCount(0);
});

test('resposta simulada: envio único, confirmação atrasada e resposta malformada', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: `Editar ensaio em ${example.local}` }).click();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route(`**/api/ensaios/${example.id}`, async route => { calls++; await pending; await route.fulfill({ json: {} }); });
  await page.getByRole('button', { name: 'Salvar ensaio' }).click();
  await expect(page.getByRole('button', { name: 'Aguardando confirmação…' })).toBeDisabled();
  await expect(page.getByLabel('Local (obrigatório)', { exact: true })).toBeDisabled();
  await expect(page.getByText('Ensaio atualizado.', { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar a operação.');
  expect(calls).toBe(1);
});

test('resposta simulada 403 com perda de perfil retira gestão e informa permissão', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: `Cancelar ensaio em ${example.local}` }).click();
  await page.route('**/api/auth/me', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.usuario.perfil = 'INTEGRANTE';
    await route.fulfill({ response, json: data });
  });
  await page.route(`**/api/ensaios/${example.id}/cancelamento`, route => route.fulfill({ status: 403, json: { error: { code: 'ACESSO_NEGADO' } } }));
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByRole('alert')).toContainText('Você não tem permissão');
  await expect(page.getByRole('button', { name: 'Cadastrar ensaio' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cancelar ensaio', exact: true })).toHaveCount(0);
});
