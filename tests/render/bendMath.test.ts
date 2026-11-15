import { describe, expect, it } from 'vitest';
import { BEND_TIP_METERS, bendFraction } from '../../src/render/bendMath';

describe('bendFraction', () => {
  it('bends the grass fully against the blade rim', () => {
    expect(bendFraction(1, 1)).toBe(1);
    expect(bendFraction(0.4, 1)).toBe(1);
  });

  it('bends less and less further from the rim, and not at all out of reach', () => {
    const near = bendFraction(1.2, 1);
    const far = bendFraction(1.5, 1);
    expect(near).toBeLessThan(1);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(0);
    expect(bendFraction(3, 1)).toBe(0);
  });

  it('reaches further around a bigger blade', () => {
    expect(bendFraction(2.6, 2)).toBeGreaterThan(bendFraction(1.6, 1));
  });

  it('pushes a tip a fraction of a meter, well under a spike height', () => {
    expect(BEND_TIP_METERS).toBeGreaterThan(0.1);
    expect(BEND_TIP_METERS).toBeLessThan(0.5);
  });
});
