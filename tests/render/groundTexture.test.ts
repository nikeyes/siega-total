import { describe, expect, it } from 'vitest';
import { GRASS_TYPE_ORDER } from '../../src/logic/field';
import { createRandom } from '../../src/logic/random';
import { BIOME_COLORS } from '../../src/render/biomes';
import { cliffPixels, groundPixels, valueNoise } from '../../src/render/groundTexture';

const SIZE = 64;
const MIDDLE = SIZE / 2;
const GREY = 0x808080;

/** Noise of `value` everywhere, so only the edge darkening shades the ground. */
function flatNoise(value: number): Float32Array {
  return new Float32Array(SIZE * SIZE).fill(value);
}

/** Red channel of the pixel at column `x`, row `y`. */
function redAt(pixels: Uint8Array, x: number, y: number, size = SIZE): number {
  return pixels[(y * size + x) * 4]!;
}

describe('valueNoise', () => {
  /** Mean difference between two columns of a `size` × `size` noise. */
  function columnGap(noise: Float32Array, size: number, left: number, right: number): number {
    let total = 0;
    for (let y = 0; y < size; y++) total += Math.abs(noise[y * size + left]! - noise[y * size + right]!);
    return total / size;
  }

  it('stays between 0 and 1', () => {
    const noise = valueNoise(SIZE, 8, createRandom(3));
    expect(noise).toHaveLength(SIZE * SIZE);
    expect(Math.min(...noise)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...noise)).toBeLessThanOrEqual(1);
  });

  it('changes smoothly from one pixel to the next', () => {
    const noise = valueNoise(SIZE, 8, createRandom(3));
    let largestStep = 0;
    for (let y = 0; y < SIZE - 1; y++) {
      for (let x = 0; x < SIZE - 1; x++) {
        const here = noise[y * SIZE + x]!;
        largestStep = Math.max(largestStep, Math.abs(noise[y * SIZE + x + 1]! - here), Math.abs(noise[(y + 1) * SIZE + x]! - here));
      }
    }
    expect(largestStep).toBeLessThanOrEqual(0.25);
  });

  it('is the same for the same seed and different for another', () => {
    expect(valueNoise(SIZE, 8, createRandom(3))).toEqual(valueNoise(SIZE, 8, createRandom(3)));
    expect(valueNoise(SIZE, 8, createRandom(3))).not.toEqual(valueNoise(SIZE, 8, createRandom(4)));
  });

  it.each([
    { size: 64, description: 'a multiple of the lattice' },
    { size: 50, description: 'not a multiple of the lattice' },
  ])('tiles without a seam on a side that is $description', ({ size }) => {
    const noise = valueNoise(size, 8, createRandom(9));
    const largestNeighbourGap = Math.max(...Array.from({ length: size - 1 }, (_, x) => columnGap(noise, size, x, x + 1)));

    expect(largestNeighbourGap).toBeGreaterThan(0);
    expect(columnGap(noise, size, size - 1, 0)).toBeLessThanOrEqual(largestNeighbourGap);
  });

  it('is flat with a single lattice cell', () => {
    expect(new Set(valueNoise(16, 1, createRandom(2))).size).toBe(1);
  });
});

describe('groundPixels', () => {
  /** Mean brightness (sum of red, green and blue) of the pixels where `include(x, y)` holds. */
  function meanBrightness(pixels: Uint8Array, include: (x: number, y: number) => boolean): number {
    let total = 0;
    let count = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!include(x, y)) continue;
        const pixel = (y * SIZE + x) * 4;
        total += pixels[pixel]! + pixels[pixel + 1]! + pixels[pixel + 2]!;
        count++;
      }
    }
    return total / count;
  }

  it('lightens the color by up to 6% where the noise is high and darkens it where it is low', () => {
    expect(redAt(groundPixels(SIZE, GREY, flatNoise(1), 0), MIDDLE, MIDDLE)).toBe(136);
    expect(redAt(groundPixels(SIZE, GREY, flatNoise(0), 0), MIDDLE, MIDDLE)).toBe(120);
  });

  it('is darker along the edge that meets the cliff than in the middle', () => {
    const pixels = groundPixels(SIZE, BIOME_COLORS.green.ground, valueNoise(SIZE, 8, createRandom(3)), 0.15);
    const edge = meanBrightness(pixels, (x) => x === 0);
    const middle = meanBrightness(pixels, (x, y) => Math.abs(x - MIDDLE) < 8 && Math.abs(y - MIDDLE) < 8);
    expect(edge).toBeLessThan(middle * 0.9);
  });

  it('darkens all four edges by the full edge darkening and leaves the middle alone', () => {
    const pixels = groundPixels(SIZE, GREY, flatNoise(0.5), 0.15);
    const darkened = Math.round(0x80 * 0.85);
    expect([redAt(pixels, 0, MIDDLE), redAt(pixels, SIZE - 1, MIDDLE), redAt(pixels, MIDDLE, 0), redAt(pixels, MIDDLE, SIZE - 1)]).toEqual(
      [darkened, darkened, darkened, darkened],
    );
    expect(redAt(pixels, MIDDLE, MIDDLE)).toBe(0x80);
  });

  it('is the plain opaque color with flat noise and no edge darkening', () => {
    const pixels = groundPixels(SIZE, GREY, flatNoise(0.5), 0);
    expect(pixels.every((value, index) => value === (index % 4 === 3 ? 255 : 0x80))).toBe(true);
  });

  it('clamps a near-white color instead of wrapping around', () => {
    expect(redAt(groundPixels(SIZE, 0xf8f8f8, flatNoise(1), 0), MIDDLE, MIDDLE)).toBe(255);
  });

  it.each(GRASS_TYPE_ORDER)('averages to within 3%% of the %s biome color', (biome) => {
    const color = BIOME_COLORS[biome].ground;
    const pixels = groundPixels(SIZE, color, valueNoise(SIZE, 8, createRandom(3)), 0.15);
    for (const [channel, shift] of [16, 8, 0].entries()) {
      let total = 0;
      for (let pixel = 0; pixel < SIZE * SIZE; pixel++) total += pixels[pixel * 4 + channel]!;
      const expected = (color >> shift) & 0xff;
      expect(Math.abs(total / (SIZE * SIZE) - expected)).toBeLessThanOrEqual(expected * 0.03);
    }
  });
});

describe('cliffPixels', () => {
  it('mottles the earth with darker and lighter specks around its color', () => {
    const pixels = cliffPixels(SIZE, 0xc8783a, createRandom(5));
    const reds = Array.from({ length: SIZE * SIZE }, (_, pixel) => pixels[pixel * 4]!);
    expect(Math.min(...reds)).toBeLessThan(0xc8);
    expect(Math.max(...reds)).toBeGreaterThan(0xc8);
  });

  it('is opaque', () => {
    const pixels = cliffPixels(SIZE, 0xc8783a, createRandom(5));
    expect(pixels.filter((_, index) => index % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
  });
});
