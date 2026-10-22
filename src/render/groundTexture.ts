/**
 * Smoothed value noise from 0 to 1 on a `size` × `size` square, row by row,
 * from a lattice of `cellsPerSide` × `cellsPerSide` random values that wraps around,
 * so the noise tiles without a seam.
 */
export function valueNoise(size: number, cellsPerSide: number, random: () => number): Float32Array {
  const lattice = Float32Array.from({ length: cellsPerSide * cellsPerSide }, random);
  const latticeAt = (column: number, row: number) =>
    lattice[(row % cellsPerSide) * cellsPerSide + (column % cellsPerSide)]!;
  const noise = new Float32Array(size * size);
  const pixelsPerCell = size / cellsPerSide;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / pixelsPerCell);
    const blendY = smoothstep(y / pixelsPerCell - row);
    for (let x = 0; x < size; x++) {
      const column = Math.floor(x / pixelsPerCell);
      const blendX = smoothstep(x / pixelsPerCell - column);
      const top = lerp(latticeAt(column, row), latticeAt(column + 1, row), blendX);
      const bottom = lerp(latticeAt(column, row + 1), latticeAt(column + 1, row + 1), blendX);
      noise[y * size + x] = lerp(top, bottom, blendY);
    }
  }
  return noise;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** How far the ground color strays from the biome color, up or down, with the noise. */
const GROUND_NOISE_VARIATION = 0.06;
/** Share of the side, at each edge, that darkens towards the cliff. */
const GROUND_EDGE_BAND = 0.06;

/**
 * RGBA pixels, row by row, of the island's top face: `color` lightened or darkened with `noise`,
 * and darkened by up to `edgeDarkening` towards the edges that meet the cliff.
 */
export function groundPixels(size: number, color: number, noise: Float32Array, edgeDarkening: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edgeDistance = Math.min(x, y, size - 1 - x, size - 1 - y) / size;
      const edgeShade = edgeDarkening * Math.max(0, 1 - edgeDistance / GROUND_EDGE_BAND);
      const noiseShade = (noise[y * size + x]! - 0.5) * 2 * GROUND_NOISE_VARIATION;
      writePixel(pixels, y * size + x, color, (1 + noiseShade) * (1 - edgeShade));
    }
  }
  return pixels;
}

/** Writes `color` scaled by `brightness` as an opaque RGBA pixel. */
function writePixel(pixels: Uint8Array, pixel: number, color: number, brightness: number): void {
  pixels[pixel * 4] = Math.min(255, Math.round(((color >> 16) & 0xff) * brightness));
  pixels[pixel * 4 + 1] = Math.min(255, Math.round(((color >> 8) & 0xff) * brightness));
  pixels[pixel * 4 + 2] = Math.min(255, Math.round((color & 0xff) * brightness));
  pixels[pixel * 4 + 3] = 255;
}

/** Share of the cliff's pixels that are a dark or light speck. */
const CLIFF_SPECK_SHARE = 0.12;
/** How much darker or lighter a speck is than the earth around it. */
const CLIFF_SPECK_CONTRAST = 0.2;

/** RGBA pixels, row by row, of the island's earth sides: soft blotches of `color` with darker and lighter specks. */
export function cliffPixels(size: number, color: number, random: () => number): Uint8Array {
  const blotches = valueNoise(size, 4, random);
  const pixels = new Uint8Array(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel++) {
    const speck = random();
    const speckShade =
      speck < CLIFF_SPECK_SHARE / 2 ? -CLIFF_SPECK_CONTRAST : speck < CLIFF_SPECK_SHARE ? CLIFF_SPECK_CONTRAST : 0;
    const blotchShade = (blotches[pixel]! - 0.5) * 2 * GROUND_NOISE_VARIATION;
    writePixel(pixels, pixel, color, 1 + blotchShade + speckShade);
  }
  return pixels;
}
