import { test, expect } from '@playwright/test';

test('onda animada sobre os logos mantém a interação e o layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const wave = page.getByTestId('ribbon-wave');
  await expect(wave.locator('canvas')).toHaveAttribute('data-ready', 'true');
  await expect(wave.locator('picture')).toHaveCSS('opacity', '0');
  await expect(wave).toHaveCSS('pointer-events', 'none');
  const loop = page.getByRole('region', { name: 'Logos de baterias universitárias' });
  await loop.scrollIntoViewIfNeeded();
  const stacking = await loop.evaluate(element => {
    const wave = document.querySelector('[data-testid="ribbon-wave"]');
    return { wave: Number(getComputedStyle(wave).zIndex), rail: Number(getComputedStyle(element.parentElement).zIndex) };
  });
  expect(stacking.wave).toBeGreaterThan(stacking.rail);
  const point = await loop.locator('.logoloop__content').evaluateAll(elements => {
    const bounds = elements[0].closest('.logoloop').getBoundingClientRect();
    const visible = elements.map(element => element.getBoundingClientRect()).find(rect => rect.left >= bounds.left + 20 && rect.right <= bounds.right - 20);
    return { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 };
  });
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.logoloop__content')), point)).toBe(true);
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(100);
  const track = loop.locator('.logoloop__track');
  const stopped = await track.evaluate(element => element.style.transform);
  await page.waitForTimeout(200);
  expect(await track.evaluate(element => element.style.transform)).toBe(stopped);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('movimento reduzido usa a onda estática sem iniciar WebGL', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const wave = page.getByTestId('ribbon-wave');
  await expect(wave.locator('canvas')).toHaveCount(0);
  await expect(wave.locator('picture')).toHaveCSS('opacity', '1');
  await expect.poll(() => wave.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
});

test('WebGL indisponível preserva a imagem e a navegação', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  const wave = page.getByTestId('ribbon-wave');
  await expect(wave.locator('canvas')).toHaveAttribute('data-ready', 'false');
  await expect(wave.locator('picture')).toHaveCSS('opacity', '1');
  await expect.poll(() => wave.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByRole('link', { name: 'Explorar ensaios' }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole('heading', { name: /Entre no ritmo/ })).toBeVisible();
});
