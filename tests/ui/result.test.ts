import { describe, expect, it } from 'vitest';
import { texts } from '../../src/texts';
import { resultLines } from '../../src/ui/result';

const SUMMARY = { levelCoins: 12_840, bonusCoins: 4_000 };

describe('resultLines', () => {
  it('after a win, shows the coins cut, the time bonus and their total', () => {
    expect(resultLines('won', SUMMARY)).toEqual([
      `${texts.result.coins} 12.840`,
      `${texts.result.timeBonus} 4000`,
      `${texts.result.total} 16.840`,
    ]);
  });

  it('after a defeat, shows only the coins cut', () => {
    expect(resultLines('lost', { levelCoins: 12_840, bonusCoins: 0 })).toEqual([`${texts.result.coins} 12.840`]);
  });

  it('shows a time bonus of 0 after a win with no whole second left', () => {
    expect(resultLines('won', { levelCoins: 50, bonusCoins: 0 })).toEqual([
      `${texts.result.coins} 50`,
      `${texts.result.timeBonus} 0`,
      `${texts.result.total} 50`,
    ]);
  });

  it('never shows a bonus after a defeat', () => {
    expect(resultLines('lost', SUMMARY)).toEqual([`${texts.result.coins} 12.840`]);
  });

  it('groups a total that reaches millions', () => {
    expect(resultLines('won', { levelCoins: 999_000, bonusCoins: 1_000 }).at(-1)).toBe(`${texts.result.total} 1.000.000`);
  });
});
