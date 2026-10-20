import { describe, expect, it } from 'vitest';
import { createRandom } from '../../src/logic/random';

function take(random: () => number, count: number): number[] {
  return Array.from({ length: count }, () => random());
}

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createRandom(42), 20)).toEqual(take(createRandom(42), 20));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(createRandom(1), 20)).not.toEqual(take(createRandom(2), 20));
  });

  it('produces the reference mulberry32 sequence', () => {
    expect(take(createRandom(1), 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it('keeps every value in [0, 1)', () => {
    const values = take(createRandom(7), 10_000);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
