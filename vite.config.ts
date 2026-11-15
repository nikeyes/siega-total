import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/** Builds the game everyone plays, or with SIEGA_VARIANT=nueva the variant that tries changes on top of it (src/variant.ts). */
const variant = process.env.SIEGA_VARIANT ?? 'actual';
const isNueva = variant === 'nueva';
const NUEVA_NAME = 'Siega Total Nueva';

/** Names the new variant apart, so it installs as its own app next to the other. */
function nueva(): Plugin {
  let outDir = '';
  return {
    name: 'siega-nueva',
    configResolved(resolved) {
      outDir = resolved.build.outDir;
    },
    transformIndexHtml: (html) => html.replace('<title>Siega Total</title>', `<title>${NUEVA_NAME}</title>`),
    writeBundle() {
      const manifestPath = join(outDir, 'manifest.webmanifest');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      writeFileSync(manifestPath, JSON.stringify({ ...manifest, name: NUEVA_NAME, short_name: 'Siega Nueva' }, null, 2));
    },
  };
}

export default defineConfig({
  base: isNueva ? '/siega-total/nueva/' : '/siega-total/',
  define: { __SIEGA_VARIANT__: JSON.stringify(variant) },
  plugins: isNueva ? [nueva()] : [],
  // The new variant goes inside the build of the other, so both publish together.
  build: isNueva ? { outDir: 'dist/nueva', emptyOutDir: true } : {},
  test: {
    environment: 'node',
    // Some tests generate and validate dozens of levels; the CI runners take about twice as long as a laptop.
    testTimeout: 15_000,
    projects: [
      { extends: true, test: { name: 'actual', include: ['tests/**/*.test.ts'], exclude: ['tests/nueva/**'] } },
      { extends: true, define: { __SIEGA_VARIANT__: JSON.stringify('nueva') }, test: { name: 'nueva', include: ['tests/nueva/**/*.test.ts'] } },
    ],
  },
});
