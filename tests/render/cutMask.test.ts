import { describe, expect, it } from 'vitest';
import { createCutMask, CUT_MASK_PIXELS_PER_METER, type CutMask } from '../../src/render/cutMask';

/** The byte pair (swept size, coverage) of the texel under (x, z). */
function texelAt(mask: CutMask, x: number, z: number): number {
  const column = Math.min(mask.columns - 1, Math.floor(x * CUT_MASK_PIXELS_PER_METER));
  const row = Math.min(mask.rows - 1, Math.floor(z * CUT_MASK_PIXELS_PER_METER));
  return (row * mask.columns + column) * 2;
}

function sweptSizeAt(mask: CutMask, x: number, z: number): number {
  return mask.data[texelAt(mask, x, z)]!;
}

function coverageAt(mask: CutMask, x: number, z: number): number {
  return mask.data[texelAt(mask, x, z) + 1]! / 255;
}

const WIDTH = 16;
const DEPTH = 8;

describe('createCutMask', () => {
  it('covers the field at CUT_MASK_PIXELS_PER_METER and starts with nothing swept', () => {
    const mask = createCutMask(WIDTH, DEPTH);
    expect(mask.columns).toBe(WIDTH * CUT_MASK_PIXELS_PER_METER);
    expect(mask.rows).toBe(DEPTH * CUT_MASK_PIXELS_PER_METER);
    expect(coverageAt(mask, 4, 4)).toBe(0);
    expect(sweptSizeAt(mask, 4, 4)).toBe(0);
  });

  it('fully covers the inside of a sweep, with the size of the blade that swept it, and leaves the outside alone', () => {
    const mask = createCutMask(WIDTH, DEPTH);
    mask.sweep(4, 4, 1, 3);
    expect(coverageAt(mask, 4, 4)).toBe(1);
    expect(sweptSizeAt(mask, 4, 4)).toBe(3);
    expect(coverageAt(mask, 5.2, 4)).toBe(0);
    expect(sweptSizeAt(mask, 5.2, 4)).toBe(0);
  });

  it('fades the coverage out towards the rim, inside the radius', () => {
    const mask = createCutMask(WIDTH, DEPTH);
    mask.sweep(4, 4, 1, 1);
    const nearRim = coverageAt(mask, 4.97, 4);
    expect(nearRim).toBeGreaterThan(0);
    expect(nearRim).toBeLessThan(1);
  });

  it('keeps the biggest blade and the fullest coverage when sweeps overlap', () => {
    const mask = createCutMask(WIDTH, DEPTH);
    mask.sweep(4, 4, 1, 5);
    mask.sweep(4, 4, 1, 2);
    expect(sweptSizeAt(mask, 4, 4)).toBe(5);
    mask.sweep(4.97, 4, 1, 1);
    expect(coverageAt(mask, 4.97, 4)).toBe(1);
  });

  it('records a sweep that cuts everything, like the win wave, as the biggest size it can hold', () => {
    const mask = createCutMask(WIDTH, DEPTH);
    mask.sweep(8, 4, 30, Infinity);
    expect(sweptSizeAt(mask, 0.1, 0.1)).toBe(255);
    expect(coverageAt(mask, 15.9, 7.9)).toBe(1);
  });

  it('ignores the part of a sweep past the field edge, and a sweep that stays outside', () => {
    const mask = createCutMask(WIDTH, DEPTH);
    expect(mask.sweep(-0.5, 4, 1, 1)).toBe(true);
    expect(coverageAt(mask, 0.2, 4)).toBe(1);
    expect(mask.sweep(-3, -3, 1, 1)).toBe(false);
  });

  it('tells whether a sweep changed anything, so the texture is only sent again when it did', () => {
    const mask = createCutMask(WIDTH, DEPTH);
    expect(mask.sweep(4, 4, 1, 2)).toBe(true);
    expect(mask.sweep(4, 4, 1, 2)).toBe(false);
    expect(mask.sweep(4, 4, 1, 3)).toBe(true);
  });

});
