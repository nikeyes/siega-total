import { describe, expect, it } from 'vitest';
import { texts } from '../../src/texts';
import { config } from '../../src/config';
import { defaultSave } from '../../src/logic/save';
import { formatCount } from '../../src/ui/formatCount';
import { continueButton, resultLines, resultStarDelays } from '../../src/ui/result';
import { victorySteps } from '../../src/ui/victorySequence';

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

describe('continueButton', () => {
  const { price } = config.boosters.clock;

  it('shows the clocks left when there are some', () => {
    const save = defaultSave();
    save.boosters.clock = 2;
    expect(continueButton(save)).toEqual({ label: texts.result.continue, detail: `${texts.boosters.clock} 2`, showsPrice: false, disabled: false });
  });

  it('shows the price of a clock when none are left', () => {
    const save = { ...defaultSave(), coins: price };
    save.boosters.clock = 0;
    expect(continueButton(save)).toEqual({ label: texts.result.continue, detail: formatCount(price), showsPrice: true, disabled: false });
  });

  it('is on with a clock left even without coins', () => {
    const save = { ...defaultSave(), coins: 0 };
    save.boosters.clock = 1;
    expect(continueButton(save).disabled).toBe(false);
  });

  it('is off without clocks or coins for one', () => {
    const save = { ...defaultSave(), coins: price - 1 };
    save.boosters.clock = 0;
    expect(continueButton(save).disabled).toBe(true);
  });
});

describe('resultStarDelays', () => {
  it('after a win, brings in three stars one after another', () => {
    const delays = resultStarDelays('won');
    expect(delays).toHaveLength(3);
    expect(delays[1]).toBeGreaterThan(delays[0]!);
    expect(delays[2]).toBeGreaterThan(delays[1]!);
  });

  it('pops each star in at the moment its note plays', () => {
    const starNotes = victorySteps().filter(({ step }) => step.kind === 'star').map(({ at }) => at);
    expect(resultStarDelays('won')).toEqual(starNotes);
  });

  it('shows no stars after a defeat', () => {
    expect(resultStarDelays('lost')).toEqual([]);
  });
});
