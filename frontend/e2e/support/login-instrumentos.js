import { expect } from '@playwright/test';

export async function loginInstrumentos(page, perfil = 'diretoria') {
  await page.goto('/instrumentos');
  await page.getByLabel('E-mail', { exact: false }).fill(`${perfil}@bateria.example`);
  await page.getByLabel('Senha (obrigatório)', { exact: true }).fill(perfil === 'diretoria' ? 'DiretoriaDemo!2026' : 'IntegranteDemo!2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Instrumentos e estoque', exact: true })).toBeVisible();
}
