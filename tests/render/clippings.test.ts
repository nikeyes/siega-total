import { describe, expect, it } from 'vitest';
import { clippingBlades } from '../../src/render/clippings';

const NO_CAP = 1000;
const cutsOf = (count: number) => Array.from({ length: count }, (_, index) => 100 + index);

describe('clippingBlades', () => {
  describe('how many clippings are thrown', () => {
    it('throws one clipping for every bladesPerClipping blades cut', () => {
      expect(clippingBlades(cutsOf(9), 3, NO_CAP)).toHaveLength(3);
    });

    it('throws one clipping even for fewer blades than bladesPerClipping, so a single cut shows', () => {
      expect(clippingBlades(cutsOf(2), 3, NO_CAP)).toHaveLength(1);
    });

    it('throws nothing when nothing was cut', () => {
      expect(clippingBlades([], 3, NO_CAP)).toEqual([]);
    });

    it.each([1, 0.5, 0.01, 0])('throws one clipping from every blade, never two, when bladesPerClipping is %s', (perClipping) => {
      const cut = cutsOf(5);
      expect(clippingBlades(cut, perClipping, NO_CAP)).toEqual(cut);
    });
  });

  describe('which blades throw them', () => {
    it('starts at the first blade cut and picks evenly spaced blades from the list', () => {
      expect(clippingBlades([7, 3, 42, 9, 11, 5], 2, NO_CAP)).toEqual([7, 42, 11]);
    });

    it('throws whole clippings when the cut blades do not divide evenly, picking each at or before its even share', () => {
      const cut = cutsOf(11);
      expect(clippingBlades(cut, 3, NO_CAP)).toEqual([cut[0], cut[3], cut[7]]);
    });

    it('throws whole clippings for a non-integer bladesPerClipping, picking each at or before its even share', () => {
      const cut = cutsOf(10);
      expect(clippingBlades(cut, 2.5, NO_CAP)).toEqual([cut[0], cut[2], cut[5], cut[7]]);
    });
  });

  describe('the per-frame cap', () => {
    it('throws no more than the cap, spread over the whole list', () => {
      const cut = cutsOf(300);
      const thrown = clippingBlades(cut, 3, 30);
      expect(thrown).toHaveLength(30);
      expect(new Set(thrown).size).toBe(30);
      expect(thrown.every((blade) => cut.includes(blade))).toBe(true);
      expect(Math.min(...thrown)).toBeLessThan(cut[30]!);
      expect(Math.max(...thrown)).toBeGreaterThan(cut[270]!);
    });

    it('treats a non-integer cap as the whole clippings below it, still spread over the list', () => {
      const cut = cutsOf(100);
      expect(clippingBlades(cut, 1, 2.5)).toEqual([cut[0], cut[50]]);
    });

    it('throws nothing when the cap is 0', () => {
      expect(clippingBlades(cutsOf(10), 3, 0)).toEqual([]);
    });
  });
});
