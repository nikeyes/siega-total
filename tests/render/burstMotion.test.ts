import { describe, expect, it } from 'vitest';
import { burstPiecePosition } from '../../src/render/burstMotion';

const origin = { x: 2, y: 0.3, z: 5 };
const velocity = { x: 1, y: 4, z: -2 };
const still = { x: 0, y: 0, z: 0 };

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

  it('falls with Earth gravity', () => {
    const dropped = { x: 0, y: 4.9, z: 0 };
    expect(burstPiecePosition(dropped, still, 0.5).y).toBeCloseTo(4.9 - 4.9 * 0.25, 9);
    expect(burstPiecePosition(dropped, still, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('never goes below the ground', () => {
    for (let age = 0; age < 3; age += 0.05) {
      expect(burstPiecePosition(origin, velocity, age).y).toBeGreaterThanOrEqual(0);
    }
  });

  it('lands exactly on the ground even when rounding would put it just below', () => {
    // From 0.1 m at 4 m/s up, the parabola evaluated at the landing time gives about -4e-16.
    const landed = burstPiecePosition({ x: 0, y: 0.1, z: 0 }, { x: 0, y: 4, z: 0 }, 10);
    expect(landed.y).toBe(0);
  });

  it('touches the ground smoothly instead of jumping to it', () => {
    const step = 0.001;
    let previous = burstPiecePosition(origin, velocity, 0);
    for (let age = step; age < 2; age += step) {
      const current = burstPiecePosition(origin, velocity, age);
      expect(Math.abs(current.y - previous.y)).toBeLessThan(0.02);
      expect(Math.abs(current.x - previous.x)).toBeLessThan(0.02);
      previous = current;
    }
    expect(previous.y).toBe(0);
  });

  it('stays where it landed', () => {
    const landed = burstPiecePosition(origin, velocity, 5);
    expect(landed.y).toBe(0);
    expect(burstPiecePosition(origin, velocity, 50)).toEqual(landed);
  });

  it('does not move when launched from the ground without upward speed', () => {
    const onGround = { x: 3, y: 0, z: 4 };
    expect(burstPiecePosition(onGround, { x: 2, y: 0, z: 1 }, 0.5)).toEqual(onGround);
  });
});
