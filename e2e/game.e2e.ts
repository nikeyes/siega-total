import { expect, test, type Page } from '@playwright/test';

/** Console noise that is not the game's fault: missing favicons and the GPU warnings of software WebGL. */
const HARMLESS = /404|GPU stall|GL Driver Message|AudioContext was not allowed/;

/** Opens the game with ?debug, so the tests can read and steer the running game, and gathers every console error. */
async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !HARMLESS.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('?debug');
  await expect(page.locator('canvas')).toBeVisible();
  // Folded, the debug panel no longer covers the game's buttons on a phone-sized screen.
  await debugPanelTitle(page).click();
  return errors;
}

/** The title bar of the debug panel, which folds and unfolds it. */
function debugPanelTitle(page: Page) {
  return page.locator('.lil-gui.lil-root > .lil-title');
}

/** Unfolds the debug panel, presses one of its buttons and folds it again. */
async function pressDebugButton(page: Page, name: string): Promise<void> {
  await debugPanelTitle(page).click();
  await page.locator('.lil-gui button').filter({ hasText: new RegExp(`^${name}$`) }).click();
  await debugPanelTitle(page).click();
}

/** Plays from the home screen: «Jugar», then a first move, so the clock starts. */
async function startPlaying(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Jugar/ }).click();
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__siega.status)).toBe('playing');
  await page.keyboard.up('ArrowUp');
}

/** The sounds the game sent out, in order. */
function soundsPlayed(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__siegaFeedback.filter((entry) => entry.kind === 'sound').map((entry) => entry.name));
}

test('the home screen loads and draws the island without errors', async ({ page }) => {
  const errors = await openGame(page);
  await expect(page.getByRole('button', { name: /^Jugar/ })).toBeVisible();
  // A few frames, so every shader has compiled and drawn.
  await page.waitForTimeout(2_000);
  expect(errors).toEqual([]);
});

test('playing cuts grass and runs the clock down', async ({ page }) => {
  const errors = await openGame(page);
  await startPlaying(page);
  const timeAtStart = await page.evaluate(() => window.__siega.timeLeft);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__siega.field.cutCount)).toBeGreaterThan(0);
  await page.keyboard.up('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__siega.timeLeft)).toBeLessThan(timeAtStart);
  expect(errors).toEqual([]);
});

test('the clock turns amber and warns once below lowTimeSeconds', async ({ page }) => {
  const errors = await openGame(page);
  await startPlaying(page);
  await page.evaluate(() => (window.__siega.timeLeft = 10.3));
  await expect(page.locator('.hud-timer')).toHaveAttribute('data-low-time', 'true');
  await expect.poll(() => soundsPlayed(page)).toContain('lowTime');
  expect((await soundsPlayed(page)).filter((name) => name === 'lowTime')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('winning plays the level-complete chime, then three stars and the confetti on the result', async ({ page }) => {
  const errors = await openGame(page);
  await startPlaying(page);
  await pressDebugButton(page, 'Ganar');
  await expect.poll(() => page.evaluate(() => window.__siega.status), { timeout: 40_000 }).toBe('won');
  await expect(page.locator('.result-star')).toHaveCount(3);
  await expect.poll(() => soundsPlayed(page)).toContain('confetti');
  const victory = (await soundsPlayed(page)).filter((name) => ['levelComplete', 'star1', 'star2', 'star3', 'confetti'].includes(name));
  expect(victory).toEqual(['levelComplete', 'star1', 'star2', 'star3', 'confetti']);
  expect(errors).toEqual([]);
});

test('knocking into a rock plays the rock bump', async ({ page }) => {
  const errors = await openGame(page);
  // Level 5 brings the first rock.
  await debugPanelTitle(page).click();
  const levelFolder = page.locator('.lil-gui .lil-gui').filter({ has: page.locator('.lil-title', { hasText: /^Nivel$/ }) });
  await levelFolder.locator('input').first().fill('5');
  await levelFolder.locator('button').filter({ hasText: /^Ir al nivel$/ }).click();
  await debugPanelTitle(page).click();
  // «Ir al nivel» opens the level straight away; a first move starts the clock.
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__siega.status)).toBe('playing');
  await page.keyboard.up('ArrowUp');
  // Half a meter west of the first rock, facing it.
  await page.evaluate(() => {
    const game = window.__siega;
    const rock = game.obstacles.obstacles.find((obstacle) => obstacle.type === 'rock')!;
    const gap = 0.5 + 0.2 * (game.blade.size - 1) + 1.0 + 0.5;
    Object.assign(game.blade, { x: rock.x - gap, z: rock.z, speed: 0 });
  });
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => soundsPlayed(page)).toContain('rockBump');
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});
