export const exampleEnsaio = { id: 807, inicioEm: '2026-11-25T22:00:00.000Z', local: 'Ensaio da participação', descricao: null, situacao: 'AGENDADO' };
export const cancelledEnsaio = { ...exampleEnsaio, id: 1427, local: 'Ensaio cancelado da participação', situacao: 'CANCELADO' };
export const tipos = [{ id: 73, nome: 'Caixa' }, { id: 431, nome: 'Repinique' }];
export const participation = (id = exampleEnsaio.id, tipo = tipos[0]) => ({ id: id + 1000, ensaioId: id, tipoInstrumentoId: tipo.id, tipoInstrumentoNome: tipo.nome,
  confirmadoEm: '2026-11-23T20:00:00.000Z', atualizadoEm: null });
export const participationRoute = /\/api\/ensaios\/\d+\/minha-participacao$/;
export const cardFor = (page, nome = exampleEnsaio.local) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: nome, exact: true }) });

export async function loginParticipacoes(page, perfil = 'integrante') {
  await page.goto('/ensaios');
  await page.getByLabel('E-mail (obrigatório)', { exact: true }).fill(`${perfil}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(perfil === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/\/ensaios$/);
}

export async function mockParticipacoes(page) {
  const states = new Map([[cancelledEnsaio.id, participation(cancelledEnsaio.id)]]);
  await page.route(/\/api\/ensaios(?:\?.*)?$/, route => {
    const situacao = new URL(route.request().url()).searchParams.get('situacao');
    return route.fulfill({ json: { ensaios: [exampleEnsaio, cancelledEnsaio].filter(item => !situacao || item.situacao === situacao) } });
  });
  await page.route('**/api/tipos-instrumentos', route => route.fulfill({ json: { tiposInstrumentos: tipos } }));
  await page.route(participationRoute, route => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[3]);
    if (route.request().method() === 'PUT') states.set(id, participation(id, tipos.find(item => item.id === route.request().postDataJSON().tipoInstrumentoId)));
    else if (route.request().method() === 'DELETE') states.delete(id);
    return route.fulfill({ json: { participacao: states.get(id) ?? null } });
  });
  return states;
}
