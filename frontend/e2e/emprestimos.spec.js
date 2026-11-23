// Testes de interface pelo contrato SCRUM-38. Respostas de empréstimos são
// explicitamente simuladas enquanto a API SCRUM-42 não está publicada.
import { test, expect } from '@playwright/test';

const member = { id: 87, nome: 'Ana de Teste', email: 'ana@bateria.example', perfil: 'INTEGRANTE' };
const unit = { id: 409, tipoInstrumentoId: 73, identificacao: 'CX-409', situacao: 'DISPONIVEL', observacoes: null };
const second = { ...unit, id: 613, identificacao: 'CX-613' };
const loan = { id: 903, integrante: { id: member.id, nome: member.nome }, instrumento: { id: unit.id, identificacao: unit.identificacao }, retiradaEm: '2026-11-20T21:30:00.000Z', devolucaoEm: null, situacao: 'ATIVO' };

async function login(page, profile = 'diretoria') {
  await page.goto('/emprestimos');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill(`${profile}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(profile === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Empréstimos', exact: true })).toBeVisible();
}

async function fixture(page, initial = []) {
  const state = { loans: structuredClone(initial), units: initial.some(item => item.situacao === 'ATIVO' && item.instrumento.id === unit.id) ? [second] : [unit, second], writes: [], reads: [] };
  await page.route('**/api/integrantes', route => { state.reads.push('integrantes'); return route.fulfill({ json: { integrantes: [member] } }); });
  await page.route('**/api/instrumentos?*', route => {
    expect(new URL(route.request().url()).search).toBe('?situacao=DISPONIVEL'); state.reads.push('instrumentos');
    return route.fulfill({ json: { instrumentos: state.units } });
  });
  await page.route(/\/api\/emprestimos(?:\/\d+\/devolucao)?(?:\?.*)?$/, async route => {
    const req = route.request();
    expect(new URL(req.url()).search).toBe('');
    if (req.method() === 'GET') { state.reads.push('emprestimos'); return route.fulfill({ json: { emprestimos: state.loans } }); }
    state.writes.push({ method: req.method(), body: req.postDataJSON(), path: new URL(req.url()).pathname });
    if (req.method() === 'POST') {
      const selected = state.units.find(item => item.id === req.postDataJSON().instrumentoId);
      const created = { ...loan, instrumento: { id: selected.id, identificacao: selected.identificacao } };
      state.loans.unshift(created); state.units = state.units.filter(item => item.id !== selected.id);
      return route.fulfill({ status: 201, json: { emprestimo: created } });
    }
    state.loans = state.loans.map(item => ({ ...item, retiradaEm: item.retiradaEm.replace('.000Z', 'Z'), situacao: 'DEVOLVIDO', devolucaoEm: '2026-11-23T14:00:00.000Z' }));
    state.units.push(unit);
    return route.fulfill({ json: { emprestimo: state.loans[0] } });
  });
  return state;
}

async function openForm(page) {
  await page.getByRole('button', { name: 'Registrar retirada', exact: true }).click();
  await expect(page.getByLabel('Integrante (obrigatório)')).toBeVisible();
}

async function fillForm(page, unitId = unit.id) {
  await page.getByLabel('Integrante (obrigatório)').selectOption(String(member.id));
  await page.getByLabel('Unidade (obrigatório)').selectOption(String(unitId));
}

test('diretoria registra retirada e devolução, atualiza opções e mantém histórico após recarregar', async ({ page }, testInfo) => {
  const state = await fixture(page);
  await login(page);
  await expect(page.getByText('Nenhum empréstimo registrado.')).toBeVisible();
  await openForm(page);
  await page.getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
  await expect(page.getByLabel('Integrante (obrigatório)')).toBeFocused();
  await expect(page.getByText('Selecione uma unidade disponível na lista atual.')).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await fillForm(page);
  await page.screenshot({ path: testInfo.outputPath('retirada-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
  await expect(page.getByText('Retirada registrada com sucesso.')).toBeVisible();
  await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('historico-diretoria-320.png'), fullPage: true });
  await page.setViewportSize(viewport);
  expect(state.writes[0]).toEqual({ method: 'POST', body: { integranteId: 87, instrumentoId: 409 }, path: '/api/emprestimos' });
  await openForm(page);
  await expect(page.getByLabel('Unidade (obrigatório)').locator('option')).toHaveText(['Selecione uma unidade', 'CX-613']);
  await page.getByRole('button', { name: 'Fechar cadastro' }).click();
  await page.getByRole('button', { name: 'Registrar devolução de CX-409' }).click();
  await expect(page.getByRole('region', { name: 'Confirmar devolução', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Voltar ao histórico' }).click();
  await expect(page.getByRole('button', { name: 'Registrar devolução de CX-409' })).toBeFocused();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Registrar devolução de CX-409' }).click();
  await page.getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  await expect(page.getByText('Devolução registrada com sucesso.')).toBeVisible();
  await expect(page.getByText('Devolvido', { exact: true })).toBeVisible();
  expect(state.writes[1]).toEqual({ method: 'PUT', body: {}, path: '/api/emprestimos/903/devolucao' });
  await page.reload();
  await expect(page.getByText('Devolvido', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Registrar devolução de/ })).toHaveCount(0);
  await openForm(page);
  await expect(page.getByLabel('Unidade (obrigatório)').locator('option')).toContainText(['Selecione uma unidade', 'CX-613', 'CX-409']);
  expect(state.reads.filter(item => item === 'emprestimos').length).toBeGreaterThan(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('integrante consulta histórico próprio sem consultar cadastros administrativos nem oferecer gravações', async ({ page }) => {
  const state = await fixture(page, [loan]);
  await login(page, 'integrante');
  await expect(page.getByRole('heading', { name: 'Meu histórico de empréstimos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CX-409' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Registrar / })).toHaveCount(0);
  await expect(page.locator('select')).toHaveCount(0);
  expect([...new Set(state.reads)]).toEqual(['emprestimos']); expect(state.writes).toEqual([]);
  state.loans = [];
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByText('Você ainda não possui empréstimos registrados.')).toBeVisible();
});

test('conflito de unidade atualiza opções e preserva integrante para nova seleção', async ({ page }) => {
  const state = await fixture(page);
  await login(page); await openForm(page); await fillForm(page);
  await page.route('**/api/emprestimos', route => {
    if (route.request().method() === 'GET') return route.fallback();
    state.units = [second];
    return route.fulfill({ status: 409, json: { error: { code: 'INSTRUMENTO_INDISPONIVEL', message: 'SQL privado' } } });
  });
  await page.getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ficou indisponível');
  await expect(page.getByLabel('Integrante (obrigatório)')).toHaveValue('87');
  await expect(page.getByLabel('Unidade (obrigatório)')).toHaveValue('');
  await expect(page.getByLabel('Unidade (obrigatório)').locator('option')).toHaveText(['Selecione uma unidade', 'CX-613']);
  await expect(page.locator('main')).not.toContainText('SQL privado');
  await expect(page.getByText('Retirada registrada com sucesso.')).toHaveCount(0);
});

test('carregamento, falha, resposta inválida e repetição sem exibir credenciais extras', async ({ page }) => {
  await fixture(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/emprestimos', async route => { await gate; await route.fulfill({ json: { emprestimos: [] } }); });
  await login(page);
  await expect(page.getByText('Carregando histórico…')).toBeVisible();
  release();
  await expect(page.getByText('Nenhum empréstimo registrado.')).toBeVisible();
  await page.route('**/api/emprestimos', route => route.abort());
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await page.route('**/api/emprestimos', route => route.fulfill({ json: { emprestimos: [{ ...loan, devolucaoEm: 'inválido' }] } }));
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await expect(page.getByRole('heading', { name: 'CX-409' })).toHaveCount(0);
  await page.route('**/api/emprestimos', route => route.fulfill({ json: { emprestimos: [{ ...loan, senha: 'segredo-privado', integrante: { ...loan.integrante, senhaHash: 'hash-privado' } }] } }));
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByRole('heading', { name: 'CX-409' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('segredo-privado');
  await expect(page.locator('main')).not.toContainText('hash-privado');
});

test('envio pendente bloqueia duplicação e resposta malformada não anuncia sucesso', async ({ page }) => {
  const state = await fixture(page);
  await login(page); await openForm(page); await fillForm(page);
  let writes = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/emprestimos', async route => {
    if (route.request().method() === 'GET') return route.fallback();
    writes++; await gate; return route.fulfill({ status: 201, json: { emprestimo: { ...loan, instrumento: { id: 999, identificacao: 'OUTRA-UNIDADE' } } } });
  });
  await page.getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Fechar cadastro' })).toBeDisabled();
  await page.getByLabel('Unidade (obrigatório)').press('Enter');
  expect(writes).toBe(1);
  release();
  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar');
  await expect(page.getByText('Retirada registrada com sucesso.')).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test('sessão expirada volta ao login e não conserva histórico visível', async ({ page }) => {
  await fixture(page, [loan]); await login(page);
  await expect(page.getByRole('heading', { name: 'CX-409' })).toBeVisible();
  await page.route('**/api/emprestimos', route => route.fulfill({ status: 401, json: { error: { code: 'SESSAO_INVALIDA' } } }));
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CX-409' })).toHaveCount(0);
});

test('perda de perfil na retirada remove ações e volta a consultar como integrante', async ({ page }) => {
  await fixture(page); await login(page); await openForm(page); await fillForm(page);
  await page.route('**/api/auth/me', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.usuario.perfil = 'INTEGRANTE'; await route.fulfill({ response, json: data });
  });
  await page.route('**/api/emprestimos', route => route.request().method() === 'GET' ? route.fallback()
    : route.fulfill({ status: 403, json: { error: { code: 'ACESSO_NEGADO' } } }));
  await page.getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meu histórico de empréstimos' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Registrar / })).toHaveCount(0);
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.getByText('Retirada registrada com sucesso.')).toHaveCount(0);
});

test('formulário sem cadastros ou com falha de opções permite fechar e repetir', async ({ page }) => {
  await fixture(page); await login(page);
  await page.route('**/api/integrantes', route => route.fulfill({ json: { integrantes: [] } }));
  await page.route('**/api/instrumentos?*', route => route.fulfill({ json: { instrumentos: [] } }));
  await openForm(page);
  await expect(page.getByText('Nenhuma unidade disponível para retirada.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar retirada', exact: true })).toBeDisabled();
  await page.route('**/api/integrantes', route => route.abort());
  await page.getByRole('button', { name: 'Atualizar consultas' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await page.getByRole('button', { name: 'Fechar cadastro' }).click();
  await expect(page.getByRole('button', { name: 'Registrar retirada', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Atualizar consultas' })).toBeEnabled();
});

test('entrada pelo início e layout a 320px com nomes longos', async ({ page }, testInfo) => {
  const identificacao = 'C'.repeat(40);
  await fixture(page, [{ ...loan, integrante: { ...loan.integrante, nome: 'Integrante '.repeat(12) }, instrumento: { ...loan.instrumento, identificacao } }]);
  await login(page); await page.goto('/');
  await page.getByRole('link', { name: /Empréstimos/ }).click();
  await expect(page.getByRole('heading', { name: identificacao })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('historico-nomes-longos-320.png'), fullPage: true });
});

test('devolução recusada consulta novamente o histórico sem anunciar sucesso', async ({ page }) => {
  const state = await fixture(page, [loan]); await login(page);
  await page.getByRole('button', { name: 'Registrar devolução de CX-409' }).click();
  await page.route('**/api/emprestimos/903/devolucao', route => {
    state.loans = [{ ...loan, situacao: 'DEVOLVIDO', devolucaoEm: '2026-11-23T14:00:00.000Z' }];
    return route.fulfill({ status: 404, json: { error: { code: 'EMPRESTIMO_NAO_ENCONTRADO' } } });
  });
  await page.getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('empréstimo não foi encontrado');
  await expect(page.getByText('Devolvido', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Registrar devolução de/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar retirada', exact: true })).toBeEnabled();
  await expect(page.getByText('Devolução registrada com sucesso.')).toHaveCount(0);
});

test('seletores consultam APIs reais de integrantes e unidades recém-cadastrados', async ({ page }, testInfo) => {
  // Somente empréstimos são interceptados; não comprova persistência PostgreSQL.
  await page.route('**/api/emprestimos', route => route.fulfill({ json: { emprestimos: [] } }));
  await login(page);
  const suffix = `${testInfo.project.name}${Date.now()}`;
  const headers = { Origin: new URL(page.url()).origin };
  const memberResponse = await page.request.post('/api/integrantes', { headers, data: { nome: `Ana ${suffix}`, email: `ana${suffix}@bateria.example`, senha: 'SenhaInicial!2026' } });
  expect(memberResponse.status()).toBe(201);
  const { integrante } = await memberResponse.json();
  const typeResponse = await page.request.post('/api/tipos-instrumentos', { headers, data: { nome: `Caixa ${suffix}` } });
  expect(typeResponse.status()).toBe(201);
  const { tipoInstrumento } = await typeResponse.json();
  const unitResponse = await page.request.post('/api/instrumentos', { headers, data: { tipoInstrumentoId: tipoInstrumento.id, identificacao: `CX-${suffix}`.toUpperCase(), observacoes: null } });
  expect(unitResponse.status()).toBe(201);
  const { instrumento } = await unitResponse.json();
  await openForm(page);
  await page.getByLabel('Integrante (obrigatório)').selectOption({ label: integrante.nome });
  await expect(page.getByLabel('Integrante (obrigatório)')).toHaveValue(String(integrante.id));
  await page.getByLabel('Unidade (obrigatório)').selectOption({ label: instrumento.identificacao });
  await expect(page.getByLabel('Unidade (obrigatório)')).toHaveValue(String(instrumento.id));
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('retirada-320.png'), fullPage: true });
});
