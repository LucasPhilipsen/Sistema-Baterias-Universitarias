export const scheduledEnsaio = { id: 913, inicioEm: '2026-11-25T22:00:00.000Z', local: 'Quadra de teste', descricao: null, situacao: 'AGENDADO' };
export const otherEnsaio = { ...scheduledEnsaio, id: 1481, local: 'Ginásio de teste' };
export const cancelledEnsaio = { ...scheduledEnsaio, id: 1779, local: 'Ensaio cancelado de teste', situacao: 'CANCELADO' };
export const comparison = (id = scheduledEnsaio.id) => ({ demanda: {
  ensaioId: id, calculadoEm: '2026-11-23T21:30:12.000Z', tipos: [
    { tipoInstrumentoId: 83, nome: 'Caixa', confirmados: 5, disponiveis: 3, falta: 2 },
    { tipoInstrumentoId: 128, nome: 'Repinique', confirmados: 0, disponiveis: 2, falta: 0 },
    { tipoInstrumentoId: 371, nome: 'Surdo sem unidades', confirmados: 2, disponiveis: 0, falta: 2 },
  ],
} });

export async function loginDemanda(page, perfil = 'diretoria') {
  await page.goto('/demanda');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill(`${perfil}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(perfil === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(perfil === 'diretoria' ? /\/demanda$/ : /\/ensaios$/);
}

export async function setupDemanda(page) {
  await page.route('**/api/ensaios?situacao=AGENDADO', route => route.fulfill({ json: { ensaios: [scheduledEnsaio, otherEnsaio, cancelledEnsaio] } }));
  await page.route(/\/api\/ensaios\/\d+\/demanda$/, route => route.fulfill({ json: comparison(Number(new URL(route.request().url()).pathname.split('/')[3])) }));
  await loginDemanda(page);
}
