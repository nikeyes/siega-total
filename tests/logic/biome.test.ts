import { describe, expect, it } from 'vitest';
import { dominantGrassType } from '../../src/logic/biome';

describe('dominantGrassType', () => {
  it('is the grass type with the most cells', () => {
    expect(dominantGrassType(['green', 'wheat', 'wheat', 'ice'])).toBe('wheat');
  });

  it('breaks a tie in favour of the first type in GRASS_TYPE_ORDER', () => {
    expect(dominantGrassType(['bramble', 'lavender', 'lavender', 'bramble'])).toBe('lavender');
  });

  it('does not count sand cells', () => {
    expect(dominantGrassType([null, null, null, 'ice'])).toBe('ice');
  });

  it('is green for a field with no grass', () => {
    expect(dominantGrassType([null, null])).toBe('green');
    expect(dominantGrassType([])).toBe('green');
  });
});
