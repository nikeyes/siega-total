import { describe, expect, it } from 'vitest';
import { formatCount } from '../../src/ui/formatCount';

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [1284, '1284'],
    [12840, '12.840'],
    [1_000_000, '1.000.000'],
  ])('shows %d as %s', (count, shown) => {
    expect(formatCount(count)).toBe(shown);
  });
});
