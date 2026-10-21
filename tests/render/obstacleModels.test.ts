import { describe, expect, it } from 'vitest';
import { normalizedScale } from '../../src/render/obstacleModels';

/** Where a model point lands after the normalization. */
function place(point: { x: number; y: number; z: number }, { scale, offset }: ReturnType<typeof normalizedScale>) {
  return { x: point.x * scale + offset.x, y: point.y * scale + offset.y, z: point.z * scale + offset.z };
}

describe('normalizedScale', () => {
  /** Off the origin on every axis, longer along x (4) than z (2). */
  const box = { min: { x: 2, y: 1, z: 3 }, max: { x: 6, y: 5, z: 5 } };

  it('scales the model so half its longest side on the ground equals the radius', () => {
    expect(normalizedScale(box, 1.5).scale).toBeCloseTo(1.5 / 2, 12);
  });

  it('uses the longer of the x and z sides, whatever the height', () => {
    const deep = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 10, z: 4 } };
    expect(normalizedScale(deep, 1).scale).toBeCloseTo(0.5, 12);
  });

  it('centers the footprint on the origin and stands the model on y = 0', () => {
    const normalized = normalizedScale(box, 1.5);
    const low = place(box.min, normalized);
    const high = place(box.max, normalized);
    expect(low.y).toBeCloseTo(0, 12);
    expect((low.x + high.x) / 2).toBeCloseTo(0, 12);
    expect((low.z + high.z) / 2).toBeCloseTo(0, 12);
    expect(high.x - low.x).toBeCloseTo(2 * 1.5, 12);
  });
});
