import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { sizeUpRing } from '../../src/render/ringMath';

const { sizeUpRingSeconds, sizeUpRingGrowth } = config.effects;
const BLADE_RADIUS = 0.8;
const FULL_RADIUS = BLADE_RADIUS * sizeUpRingGrowth;

/** The ring sampled at 100 evenly spaced moments while it is running. */
const ringOverItsLife = () =>
  Array.from({ length: 100 }, (_, step) => sizeUpRing((step / 100) * sizeUpRingSeconds, BLADE_RADIUS)!);

describe('sizeUpRing', () => {
  describe('while running', () => {
    it('starts at the blade edge, fully opaque', () => {
      expect(sizeUpRing(0, BLADE_RADIUS)).toEqual({ radius: BLADE_RADIUS, opacity: 1 });
    });

    it('grows smoothly toward sizeUpRingGrowth times the blade radius', () => {
      const rings = ringOverItsLife();
      for (let step = 1; step < rings.length; step++) {
        const growth = rings[step]!.radius - rings[step - 1]!.radius;
        expect(growth).toBeGreaterThan(0);
        expect(growth).toBeLessThan(BLADE_RADIUS * 0.05);
        expect(rings[step]!.radius).toBeLessThan(FULL_RADIUS);
      }
      expect(rings.at(-1)!.radius).toBeCloseTo(FULL_RADIUS, 2);
    });

    it('fades smoothly toward transparent', () => {
      const rings = ringOverItsLife();
      for (let step = 1; step < rings.length; step++) {
        const fade = rings[step - 1]!.opacity - rings[step]!.opacity;
        expect(fade).toBeGreaterThan(0);
        expect(fade).toBeLessThan(0.05);
      }
      expect(rings.at(-1)!.opacity).toBeCloseTo(0, 1);
    });

    it('has covered seven eighths of its growth and faded to half halfway through', () => {
      const ring = sizeUpRing(sizeUpRingSeconds / 2, BLADE_RADIUS)!;
      expect(ring.radius).toBeCloseTo(BLADE_RADIUS + (FULL_RADIUS - BLADE_RADIUS) * (7 / 8));
      expect(ring.opacity).toBeCloseTo(0.5);
    });

    it('never goes past the full growth or below zero opacity just before it ends', () => {
      const ring = sizeUpRing(sizeUpRingSeconds * 0.999999, BLADE_RADIUS)!;
      expect(ring.radius).toBeLessThanOrEqual(FULL_RADIUS);
      expect(ring.opacity).toBeGreaterThanOrEqual(0);
    });

    it('has radius 0 for a blade of radius 0, so the ring hides', () => {
      expect(sizeUpRing(sizeUpRingSeconds / 2, 0)!.radius).toBe(0);
    });
  });

  describe('once over', () => {
    it.each([
      ['exactly sizeUpRingSeconds', sizeUpRingSeconds],
      ['forever', Infinity],
    ])('is null after %s', (_, age) => {
      expect(sizeUpRing(age, BLADE_RADIUS)).toBeNull();
    });
  });
});
