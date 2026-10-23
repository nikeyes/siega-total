import { expect, test } from '@playwright/test';

test('offers a manifest with icons, so the game can be saved to a phone home screen with its own icon', async ({ page }) => {
  await page.goto('.');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).not.toBeNull();
  const manifestUrl = new URL(manifestHref!, page.url()).href;
  const manifest = await (await page.request.get(manifestUrl)).json();
  expect(manifest.name).toBe('Siega Total');
  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toContain('any');
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await page.request.get(new URL(icon.src, manifestUrl).href);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()['content-type'], icon.src).toBe('image/png');
  }
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await page.request.get(new URL(appleIcon!, page.url()).href)).status()).toBe(200);
});
