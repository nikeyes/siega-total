import { describe, expect, it } from 'vitest';
import { radialGlowAlpha } from '../../src/render/bladeGlow';

const SIZE = 64;
const MIDDLE = SIZE / 2;

describe('radialGlowAlpha', () => {
  it('is brightest in the middle', () => {
    const alpha = radialGlowAlpha(SIZE);
    expect(alpha).toHaveLength(SIZE * SIZE);
    expect(alpha[MIDDLE * SIZE + MIDDLE]).toBe(Math.max(...alpha));
    expect(alpha[MIDDLE * SIZE + MIDDLE]).toBeGreaterThan(250);
  });

  it('fades to nothing at the edges and in the corners', () => {
    const alpha = radialGlowAlpha(SIZE);
    const at = (x: number, y: number) => alpha[y * SIZE + x];
    expect([at(0, MIDDLE), at(SIZE - 1, MIDDLE), at(MIDDLE, 0), at(MIDDLE, SIZE - 1)]).toEqual([0, 0, 0, 0]);
    expect([at(0, 0), at(SIZE - 1, 0), at(0, SIZE - 1), at(SIZE - 1, SIZE - 1)]).toEqual([0, 0, 0, 0]);
  });

  it('dims step by step, without jumps, from the middle out to the edge', () => {
    const alpha = radialGlowAlpha(SIZE);
    const row = Array.from({ length: MIDDLE }, (_, step) => alpha[MIDDLE * SIZE + MIDDLE + step]!);
    for (let step = 1; step < row.length; step++) {
      expect(row[step]).toBeLessThanOrEqual(row[step - 1]!);
      expect(row[step - 1]! - row[step]!).toBeLessThan(20);
    }
  });

  it('is full strength in the exact middle of an odd-sized square', () => {
    expect(radialGlowAlpha(65)[32 * 65 + 32]).toBe(255);
  });

  it('is symmetric around the middle', () => {
    const alpha = radialGlowAlpha(SIZE);
    for (let step = 0; step < MIDDLE; step++) {
      expect(alpha[MIDDLE * SIZE + MIDDLE + step]).toBe(alpha[MIDDLE * SIZE + MIDDLE - 1 - step]);
      expect(alpha[(MIDDLE + step) * SIZE + MIDDLE]).toBe(alpha[MIDDLE * SIZE + MIDDLE + step]);
    }
  });

  it('is already soft halfway out, at (1 − r²)² rather than fading linearly', () => {
    const halfwayOut = radialGlowAlpha(65)[32 * 65 + 32 + 16]!;
    expect(halfwayOut).toBeGreaterThanOrEqual(139);
    expect(halfwayOut).toBeLessThanOrEqual(147);
  });
});
