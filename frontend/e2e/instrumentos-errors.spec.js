import { test, expect } from '@playwright/test';
import { loginInstrumentos } from './support/login-instrumentos.js';

const tipo = { id: 93, nome: 'Tipo simulado' };
const unidade = { id: 812, tipoInstrumentoId: tipo.id, identificacao: 'SIM-001', situacao: 'DISPONIVEL', observacoes: null };
async function setup(page, empty = false) {
  for (const [path, data] of [
    ['tipos-instrumentos', { tiposInstrumentos: empty ? [] : [tipo] }],
    ['instrumentos', { instrumentos: empty ? [] : [unidade] }],
    ['estoque', { estoque: empty ? [] : [{ tipoInstrumentoId: tipo.id, nome: tipo.nome, total: 1, disponiveis: 1, emprestados: 0, emManutencao: 0 }] }],
  ]) {
    await page.route(`**/api/${path}`, route => route.request().method() === 'GET' ? route.fulfill({ json: data }) : route.fallback());
  }
  await loginInstrumentos(page);
}

test('simulação: vazio, carregamento, conexão e recuperação sem dados fictícios na aplicação', async ({ page }) => {
  await setup(page, true);
  await expect(page.getByText('Nenhuma unidade cadastrada.')).toBeVisible();
  await expect(page.getByText('Nenhum tipo cadastrado para consultar a disponibilidade.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cadastrar unidade', exact: true })).toBeDisabled();
  await page.route('**/api/instrumentos', route => route.abort());
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar os dados.');
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  await page.route('**/api/instrumentos', async route => { await waiting; await route.fulfill({ json: { instrumentos: [] } }); });
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByRole('region', { name: 'Unidades', exact: true }).getByText('Carregando dados…')).toBeVisible();
  release();
  await expect(page.getByText('Nenhuma unidade cadastrada.')).toBeVisible();
});

for (const [status, code, message] of [
  [400, 'DADOS_INVALIDOS', 'A API recusou os dados.'],
  [400, 'TIPO_INSTRUMENTO_INVALIDO', 'A operação foi recusada.'],
  [403, 'ACESSO_NEGADO', 'Você não tem permissão'],
  [404, 'INSTRUMENTO_NAO_ENCONTRADO', 'O registro não foi encontrado.'],
  [409, 'IDENTIFICACAO_DUPLICADA', 'A operação foi recusada.'],
  [409, 'INSTRUMENTO_INDISPONIVEL', 'A unidade ficou indisponível'],
  [500, 'ERRO_INTERNO', 'Não foi possível confirmar a operação.'],
]) {
  test(`simulação ${status} ${code}: mantém campos, informa falha e não confirma sucesso`, async ({ page }) => {
    await setup(page);
    await page.getByRole('button', { name: `Editar unidade ${unidade.identificacao}` }).click();
    const identification = page.getByLabel('Identificação (obrigatório)', { exact: true });
    await identification.fill('SIM-REVISADO');
    let submitted;
    await page.route(`**/api/instrumentos/${unidade.id}`, route => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status, json: { error: { code, message: 'Detalhe SQL privado' } } });
    });
    await page.getByRole('button', { name: 'Salvar unidade' }).click();
    await expect(page.getByRole('alert')).toContainText(message);
    expect(submitted).toEqual({ tipoInstrumentoId: tipo.id, identificacao: 'SIM-REVISADO', observacoes: null });
    await expect(identification).toHaveValue('SIM-REVISADO');
    await expect(page.getByText('Unidade atualizada com sucesso.', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Detalhe SQL privado')).toHaveCount(0);
  });
}

test('simulação 401 durante gravação exige novo login sem anunciar sucesso', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: `Editar unidade ${unidade.identificacao}` }).click();
  await page.route(`**/api/instrumentos/${unidade.id}`, route => route.fulfill({ status: 401, json: { error: { code: 'SESSAO_INVALIDA' } } }));
  await page.getByRole('button', { name: 'Salvar unidade' }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByText('Sua sessão expirou ou foi encerrada. Entre novamente para continuar.')).toBeVisible();
  await expect(page.getByText('Unidade atualizada com sucesso.', { exact: true })).toHaveCount(0);
});

test('simulação 403 com novo perfil retira ações administrativas e preserva a mensagem', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: `Editar unidade ${unidade.identificacao}` }).click();
  await page.route('**/api/auth/me', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.usuario.perfil = 'INTEGRANTE';
    await route.fulfill({ response, json: data });
  });
  await page.route(`**/api/instrumentos/${unidade.id}`, route => route.fulfill({ status: 403, json: { error: { code: 'ACESSO_NEGADO' } } }));
  await page.getByRole('button', { name: 'Salvar unidade' }).click();
  await expect(page.getByRole('alert')).toContainText('Você não tem permissão');
  await expect(page.getByRole('button', { name: /^Cadastrar / })).toHaveCount(0);
  await expect(page.locator('form')).toHaveCount(0);
});

test('simulação: confirmação atrasada bloqueia repetição e resposta malformada não confirma sucesso', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: `Editar unidade ${unidade.identificacao}` }).click();
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route(`**/api/instrumentos/${unidade.id}`, async route => { calls++; await waiting; await route.fulfill({ json: {} }); });
  await page.getByRole('button', { name: 'Salvar unidade' }).click();
  await expect(page.getByRole('button', { name: 'Aguardando confirmação…' })).toBeDisabled();
  await expect(page.getByLabel('Identificação (obrigatório)', { exact: true })).toBeDisabled();
  await expect(page.getByText('Unidade atualizada com sucesso.', { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar a operação.');
  expect(calls).toBe(1);
});

test('simulação: resposta antiga de filtro não substitui o resultado mais recente', async ({ page }) => {
  await setup(page);
  let release;
  let started;
  const waiting = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  await page.route('**/api/instrumentos?*', async route => {
    if (new URL(route.request().url()).searchParams.get('situacao') === 'EMPRESTADO') {
      started(); await waiting;
      await route.fulfill({ json: { instrumentos: [{ ...unidade, id: 813, identificacao: 'ANTIGO-001', situacao: 'EMPRESTADO' }] } }).catch(() => {});
    } else await route.fulfill({ json: { instrumentos: [unidade] } });
  });
  await page.getByLabel('Filtrar por situação', { exact: true }).selectOption('EMPRESTADO');
  await entered;
  await page.getByLabel('Filtrar por situação', { exact: true }).selectOption('DISPONIVEL');
  await expect(page.getByRole('heading', { name: unidade.identificacao, exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: 'ANTIGO-001', exact: true })).toHaveCount(0);
});
