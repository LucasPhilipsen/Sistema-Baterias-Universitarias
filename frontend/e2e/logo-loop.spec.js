import { test, expect } from '@playwright/test';

async function openLoop(page) {
  await page.goto('/');
  const loop = page.getByRole('region', { name: 'Logos de baterias universitárias' });
  await loop.scrollIntoViewIfNeeded();
  await expect.poll(() => loop.locator('.logoloop__list:not([aria-hidden]) img').evaluateAll(images => images.length === 7 && images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  return loop;
}

test('faixa mostra sete logos originais recortados no espaço entre a abertura e os módulos', async ({ page }) => {
  const loop = await openLoop(page);
  const images = loop.locator('.logoloop__list:not([aria-hidden]) img');
  await expect(images).toHaveCount(7);
  const sources = await images.evaluateAll(images => images.map(image => new URL(image.src).pathname));
  expect(new Set(sources).size).toBe(7);
  expect(sources.filter(source => source.endsWith('/bandida.png')).length).toBe(1);
  const alpha = await images.evaluateAll(images => images.map(image => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, 1, 1).data[3];
  }));
  expect(alpha).toEqual([0, 0, 0, 0, 0, 0, 0]);
  const intro = await page.getByRole('region', { name: 'Cada ensaio começa com organização.' }).boundingBox();
  const rail = await loop.boundingBox();
  const modules = await page.locator('section[aria-labelledby="modules-title"]').boundingBox();
  expect(rail.y).toBeGreaterThanOrEqual(intro.y + intro.height);
  expect(rail.y + rail.height).toBeLessThanOrEqual(modules.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('rolagem contínua pausa apenas sobre um logo e retoma ao retirar o mouse, sem botões', async ({ page }) => {
  const loop = await openLoop(page);
  const track = loop.locator('.logoloop__track');
  const initial = await track.evaluate(element => element.style.transform);
  await expect.poll(() => track.evaluate(element => element.style.transform)).not.toBe(initial);
  await expect(page.getByRole('button', { name: /animação dos logos/ })).toHaveCount(0);
  const bounds = await loop.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 1);
  const gapPosition = await track.evaluate(element => element.style.transform);
  await expect.poll(() => track.evaluate(element => element.style.transform)).not.toBe(gapPosition);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 10);
  const logo = await loop.locator('.logoloop__content').evaluateAll(elements => {
    const region = elements[0].closest('.logoloop').getBoundingClientRect();
    const visible = elements.map(element => element.getBoundingClientRect()).find(rect => rect.left >= region.left + 20 && rect.right <= region.right - 20);
    return { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 };
  });
  await page.mouse.move(logo.x, logo.y);
  await page.waitForTimeout(100);
  const stopped = await track.evaluate(element => element.style.transform);
  await page.waitForTimeout(250);
  expect(await track.evaluate(element => element.style.transform)).toBe(stopped);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 1);
  await expect.poll(() => track.evaluate(element => element.style.transform)).not.toBe(stopped);
});

test('preferência por movimento reduzido mantém os logos parados', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const loop = await openLoop(page);
  const track = loop.locator('.logoloop__track');
  const initial = await track.evaluate(element => element.style.transform);
  await page.waitForTimeout(350);
  expect(await track.evaluate(element => element.style.transform)).toBe(initial);
  await expect(page.getByRole('button', { name: 'Pausar animação dos logos' })).toHaveCount(0);
});
