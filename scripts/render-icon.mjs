// Renders the app icon's 3D scene (scripts/icon) in Chrome and writes the PNGs of public/icons.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const ICONS = 'public/icons';
/** "any" icons get rounded corners; the maskable and Apple ones stay full-bleed, since the system crops them.
 * The 32 px favicon stays the flat icon.svg drawing: at that size the 3D scene is a smudge. */
const OUTPUTS = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'icon-maskable-512.png', size: 512, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
];
const PREVIEW_PATH = process.argv[2];

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.goto('http://localhost:5199/siega-total/scripts/icon/index.html');
  await page.waitForFunction(() => window.iconReady === true);
  for (const { file, size, rounded } of OUTPUTS) {
    // Rendered at four times the size and scaled down by the browser, so the edges stay smooth.
    const big = size * 4;
    const png = await page.evaluate(
      ({ big, size, rounded }) => {
        // Copied in the same task as the render: WebGL clears its drawing once the frame is shown.
        window.renderIcon(big);
        const source = document.querySelector('canvas');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        if (rounded) {
          context.beginPath();
          context.roundRect(0, 0, size, size, size * 0.22);
          context.clip();
        }
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, big, big, 0, 0, size, size);
        return canvas.toDataURL('image/png');
      },
      { big, size, rounded },
    );
    writeFileSync(`${PREVIEW_PATH ?? ICONS}/${file}`, Buffer.from(png.split(',')[1], 'base64'));
  }
} finally {
  await browser.close();
  await server.close();
}
