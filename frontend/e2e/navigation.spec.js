import { test, expect } from '@playwright/test';

test('barra mantém marca, navegação e login na mesma linha no desktop; menu abre no celular', async ({ page, isMobile }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  const brand = header.getByRole('link', { name: 'Flam — Início', exact: true });
  await expect(brand).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const toggle = page.getByRole('button', { name: 'Abrir menu' });
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
  } else {
    const brandBox = await brand.boundingBox();
    const loginBox = await header.getByRole('link', { name: 'Login', exact: true }).boundingBox();
    for (const name of ['Início', 'Ensaios', 'Instrumentos e estoque']) {
      const linkBox = await page.getByRole('navigation').getByRole('link', { name, exact: true }).boundingBox();
      expect(Math.abs(linkBox.y + linkBox.height / 2 - brandBox.y - brandBox.height / 2)).toBeLessThan(2);
      expect(linkBox.x).toBeGreaterThan(brandBox.x + brandBox.width);
      expect(linkBox.x + linkBox.width).toBeLessThan(loginBox.x);
    }
  }
  await header.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  if (isMobile) await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
});

test('menu móvel fecha com Escape e clique externo, mantendo o foco de teclado', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Interação específica do menu recolhido.');
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Abrir menu' });
  await toggle.click();
  await page.getByRole('navigation').getByRole('link', { name: 'Ensaios', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.getByRole('heading', { name: 'Cada ensaio começa com organização.' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('navbar Flam revela o fundo branco no hover e foco, mantendo a onda atrás', async ({ page, isMobile }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  const brand = header.getByRole('link', { name: 'Flam — Início', exact: true });
  await expect(brand.getByRole('img', { name: 'Flam', exact: true })).toBeVisible();
  await expect.poll(() => brand.locator('image').evaluate(async image => {
    const file = new Image();
    file.src = image.href.baseVal;
    await file.decode();
    return file.naturalWidth;
  })).toBe(1200);
  const opacity = () => header.locator(':scope > div').evaluate(element => getComputedStyle(element, '::before').opacity);
  await page.mouse.move(0, 900);
  await expect.poll(opacity).toBe('0');
  if (isMobile) {
    await header.getByRole('button', { name: 'Abrir menu' }).click();
    await expect.poll(opacity).toBe('1');
    await expect(header.getByRole('navigation')).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await header.getByRole('navigation').getByRole('link', { name: 'Início', exact: true }).hover();
    await expect.poll(opacity).toBe('1');
    await page.mouse.move(0, 900);
    await expect.poll(opacity).toBe('0');
  }
  await brand.focus();
  await expect.poll(opacity).toBe('1');
  await brand.evaluate(element => element.blur());
  await expect.poll(opacity).toBe('0');
  const wave = await page.getByTestId('ribbon-wave').boundingBox();
  const bounds = await header.boundingBox();
  expect(wave.y).toBe(0);
  expect(wave.height).toBeGreaterThan(bounds.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
