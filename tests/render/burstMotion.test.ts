import { describe, expect, it } from 'vitest';
import { burstPiecePosition } from '../../src/render/burstMotion';

const origin = { x: 2, y: 0.3, z: 5 };
const velocity = { x: 1, y: 4, z: -2 };

describe('burstPiecePosition', () => {
  it('starts at the origin', () => {
    expect(burstPiecePosition(origin, velocity, 0)).toEqual(origin);
  });

  it('rises and then falls back', () => {
    const heights = [0.1, 0.3, 0.6].map((age) => burstPiecePosition(origin, velocity, age).y);
    expect(heights[0]).toBeGreaterThan(origin.y);
    expect(heights[1]).toBeGreaterThan(heights[0]!);
    expect(heights[2]).toBeLessThan(heights[1]!);
  });

  it('flies along its horizontal velocity while in the air', () => {
    const { x, z } = burstPiecePosition(origin, velocity, 0.2);
    expect(x).toBeCloseTo(origin.x + velocity.x * 0.2, 9);
    expect(z).toBeCloseTo(origin.z + velocity.z * 0.2, 9);
  });

  it('never goes below the ground and stays where it landed', () => {
    const landed = burstPiecePosition(origin, velocity, 5);
    const later = burstPiecePosition(origin, velocity, 50);
    expect(landed.y).toBe(0);
    expect(later).toEqual(landed);
    for (let age = 0; age < 3; age += 0.05) expect(burstPiecePosition(origin, velocity, age).y).toBeGreaterThanOrEqual(0);
  });
});
