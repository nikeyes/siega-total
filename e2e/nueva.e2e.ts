import { expect, test } from '@playwright/test';

// The version tried out at nueva/ for a while became the game.

test('an old link to nueva/ lands on the game', async ({ page }) => {
  await page.goto('nueva/');
  await expect(page.getByRole('button', { name: /^Jugar/ })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/siega-total/');
});

test('the progress played at nueva/ wins over the older one, once', async ({ page }) => {
  await page.goto('.');
  await expect(page.getByRole('button', { name: /^Jugar/ })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('siega-total', JSON.stringify({ version: 1, level: 3 }));
    localStorage.setItem('siega-total-nueva', JSON.stringify({ version: 1, level: 9 }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /^Jugar · Nivel 9$/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('siega-total-nueva'))).toBeNull();
});
