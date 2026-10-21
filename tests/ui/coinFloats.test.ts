import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createCoinFloats } from '../../src/ui/coinFloats';

const { floatIntervalSeconds } = config.economy;
/** Four of these steps fall short of an interval and the fifth goes past it, whatever the rounding. */
const STEP = floatIntervalSeconds / 4.5;

describe('coin floats', () => {
  it('lets out the coins of the steps of one interval added together', () => {
    const floats = createCoinFloats();
    const shown = [3, 0, 5, 2, 1].map((coins) => floats.step(coins, STEP));
    expect(shown).toEqual([null, null, null, null, 11]);
  });

  it('keeps letting one «+N» out per interval while coins keep coming, as in the win wave', () => {
    const floats = createCoinFloats();
    const shown = Array.from({ length: 10 }, () => floats.step(2, STEP));
    expect(shown).toEqual([null, null, null, null, 10, null, null, null, null, 10]);
  });

  it('lets nothing out while no coins come in', () => {
    const floats = createCoinFloats();
    const shown = Array.from({ length: 20 }, () => floats.step(0, STEP));
    expect(shown.every((coins) => coins === null)).toBe(true);
  });

  it('starts counting the interval from the first coins, not from the last «+N»', () => {
    const floats = createCoinFloats();
    for (let step = 0; step < 10; step++) floats.step(0, STEP);
    const shown = [4, 0, 0, 0, 0].map((coins) => floats.step(coins, STEP));
    expect(shown).toEqual([null, null, null, null, 4]);
  });

  it('lets the coins out at once when a single step lasts the whole interval', () => {
    expect(createCoinFloats().step(7, floatIntervalSeconds)).toBe(7);
  });

  it('lets the coins out at once when a single step lasts longer than the interval', () => {
    expect(createCoinFloats().step(7, 3 * floatIntervalSeconds)).toBe(7);
  });

  it('starts a new interval after each «+N», without carrying the time over', () => {
    const floats = createCoinFloats();
    floats.step(1, 3 * floatIntervalSeconds);
    expect(floats.step(1, STEP)).toBeNull();
  });

  it('keeps counting time on steps without coins once some coins are gathered', () => {
    const floats = createCoinFloats();
    expect(floats.step(5, STEP)).toBeNull();
    expect(floats.step(0, 4 * STEP)).toBe(5);
  });

  it('lets out the whole coins of fractional steps and keeps the rest for the next «+N»', () => {
    const floats = createCoinFloats();
    expect(floats.step(0.6, STEP)).toBeNull();
    expect(floats.step(0.6, floatIntervalSeconds)).toBe(1);
    expect(floats.step(0.9, floatIntervalSeconds)).toBe(1);
  });

  it('never lets out a «+0» while the coins gathered add up to less than one', () => {
    expect(createCoinFloats().step(0.4, floatIntervalSeconds)).toBeNull();
  });

  it('lets nothing out for more than half a coin, as only whole coins come out', () => {
    expect(createCoinFloats().step(0.6, floatIntervalSeconds)).toBeNull();
  });

  it('lets out, over many fractional steps, every whole coin gathered', () => {
    const floats = createCoinFloats();
    const shown = Array.from({ length: 100 }, () => floats.step(0.6, floatIntervalSeconds) ?? 0);
    expect(shown.reduce((sum, coins) => sum + coins, 0)).toBe(60);
  });

  it('ignores zero-length steps', () => {
    const floats = createCoinFloats();
    const shown = Array.from({ length: 100 }, () => floats.step(1, 0));
    expect(shown.every((coins) => coins === null)).toBe(true);
  });
});
