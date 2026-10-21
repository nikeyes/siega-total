import { describe, expect, it } from 'vitest';
import { bladeRadius } from '../../src/logic/blade';
import { COMPASS_GAP_METERS, compassPlacement } from '../../src/render/compassMath';

const BLADE = { x: 10, z: 10, size: 1 };

/** Unit vector from the blade toward the arrow. */
function directionOf(placement: { x: number; z: number }): { x: number; z: number } {
  const length = Math.hypot(placement.x - BLADE.x, placement.z - BLADE.z);
  return { x: (placement.x - BLADE.x) / length, z: (placement.z - BLADE.z) / length };
}

describe('compass placement', () => {
  it('points toward −z for a target to the north', () => {
    const placement = compassPlacement(BLADE, { x: 10, z: 2 });
    expect(directionOf(placement).x).toBeCloseTo(0, 9);
    expect(directionOf(placement).z).toBeCloseTo(-1, 9);
    expect(Math.cos(placement.angle)).toBeCloseTo(0, 9);
    expect(Math.sin(placement.angle)).toBeCloseTo(-1, 9);
  });

  it('points toward +x for a target to the east', () => {
    const placement = compassPlacement(BLADE, { x: 25, z: 10 });
    expect(directionOf(placement).x).toBeCloseTo(1, 9);
    expect(directionOf(placement).z).toBeCloseTo(0, 9);
    expect(placement.angle).toBeCloseTo(0, 9);
  });

  it('sits just outside the blade, farther out the bigger the blade', () => {
    const target = { x: 25, z: 10 };
    const small = compassPlacement(BLADE, target);
    const big = compassPlacement({ ...BLADE, size: 5 }, target);
    expect(small.x - BLADE.x).toBeCloseTo(bladeRadius(1) + COMPASS_GAP_METERS, 9);
    expect(big.x - BLADE.x).toBeCloseTo(bladeRadius(5) + COMPASS_GAP_METERS, 9);
  });

  it('points along a diagonal toward a target to the southwest', () => {
    const placement = compassPlacement(BLADE, { x: 5, z: 15 });
    expect(directionOf(placement).x).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(directionOf(placement).z).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it('keeps the same distance however far the target is', () => {
    const near = compassPlacement(BLADE, { x: 11, z: 10 });
    const far = compassPlacement(BLADE, { x: 1000, z: 10 });
    expect(near.x).toBeCloseTo(far.x, 9);
  });
});
