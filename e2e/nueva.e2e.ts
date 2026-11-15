import { expect, test } from '@playwright/test';

/** Console noise that is not the game's fault: missing favicons and the GPU warnings of software WebGL. */
const HARMLESS = /404|GPU stall|GL Driver Message|AudioContext was not allowed/;

test('the new variant loads at nueva/, says so and plays', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !HARMLESS.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('nueva/?debug');
  await expect(page.getByText('Versión nueva')).toBeVisible();
  await page.locator('.lil-gui.lil-root > .lil-title').click();
  await page.getByRole('button', { name: /^Jugar/ }).click();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__siega.field.cutCount)).toBeGreaterThan(0);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

test('the game everyone plays does not say it is the new variant', async ({ page }) => {
  await page.goto('.');
  await expect(page.getByRole('button', { name: /^Jugar/ })).toBeVisible();
  await expect(page.getByText('Versión nueva')).toBeHidden();
});

test('each variant keeps its own save', async ({ page }) => {
  await page.goto('.');
  await expect(page.getByRole('button', { name: /^Jugar/ })).toBeVisible();
  // A saved game at level 7 in the game everyone plays; the oldest save format still loads.
  await page.evaluate(() => localStorage.setItem('siega-total', JSON.stringify({ version: 1, level: 7 })));
  await page.reload();
  await expect(page.getByRole('button', { name: /^Jugar · Nivel 7$/ })).toBeVisible();
  await page.goto('nueva/');
  await expect(page.getByRole('button', { name: /^Jugar · Nivel 1$/ })).toBeVisible();
});

test('the new variant installs as its own app', async ({ page }) => {
  await page.goto('nueva/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(new URL(manifestHref!, page.url()).href)).json();
  expect(manifest.name).toBe('Siega Total Nueva');
});
