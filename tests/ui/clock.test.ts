import { describe, expect, it } from 'vitest';
import { formatClock } from '../../src/ui/clock';

describe('formatClock', () => {
  it('shows whole minutes and seconds', () => {
    expect(formatClock(60)).toBe('1:00');
  });

  it.each([
    [89.2, '1:30'],
    [59.5, '1:00'],
    [0.1, '0:01'],
    [0, '0:00'],
  ])('rounds %s seconds up to %s, so 0:00 only shows when the time is over', (seconds, shown) => {
    expect(formatClock(seconds)).toBe(shown);
  });

  it('pads the seconds to two digits', () => {
    expect(formatClock(9)).toBe('0:09');
  });

  it('shows minutes past one hour without wrapping', () => {
    expect(formatClock(3_600)).toBe('60:00');
  });

  it('shows 0:00 for a tiny negative leftover of floating-point subtraction', () => {
    expect(formatClock(-1e-9)).toBe('0:00');
  });
});
