import { describe, expect, it } from 'vitest';
import { createCutBuzz, type CutBuzz } from '../../src/audio/cutBuzz';
import { config } from '../../src/config';
import { spinRadiansPerSecond } from '../../src/logic/blade';
import { nextWinStreak } from '../../src/logic/turbo';
import { bonusesFor } from '../../src/logic/upgrades';

const FRAME = 1 / 60;
const NO_UPGRADES = { startSize: 0, speed: 0, extraTime: 0, growth: 0 };

/** Seconds between the buzzes of `seconds` of steady cutting, after `warmup` seconds of it. */
function gapsBetweenBuzzes(buzz: CutBuzz, warmup: number, seconds: number): number[] {
  for (let elapsed = 0; elapsed < warmup; elapsed += FRAME) buzz.step(true, FRAME);
  const times: number[] = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) if (buzz.step(true, FRAME)) times.push(elapsed);
  return times.slice(1).map((time, index) => time - times[index]!);
}

describe('polish in the nueva build', () => {
  it('spins about half as fast at size 10 as at size 1', () => {
    const ratio = spinRadiansPerSecond(10) / spinRadiansPerSecond(1);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('buzzes at once when the blade starts cutting', () => {
    expect(createCutBuzz().step(true, FRAME)).toBe(true);
  });

  it('buzzes less and less often the longer the blade keeps cutting', () => {
    const early = gapsBetweenBuzzes(createCutBuzz(), 0, 2);
    const late = gapsBetweenBuzzes(createCutBuzz(), 25, 4);
    expect(Math.min(...late)).toBeGreaterThan(Math.max(...early) * 2);
  });

  it('starts the rhythm over after a pause in the cutting', () => {
    const buzz = createCutBuzz();
    for (let elapsed = 0; elapsed < 25; elapsed += FRAME) buzz.step(true, FRAME);
    for (let elapsed = 0; elapsed < 1; elapsed += FRAME) buzz.step(false, FRAME);
    expect(buzz.step(true, FRAME)).toBe(true);
    expect(gapsBetweenBuzzes(buzz, 0, 1)[0]).toBeLessThan(0.3);
  });

  it('turns the turbo on after the set number of wins in a row', () => {
    const wins = config.turbo.afterWins!;
    const plain = bonusesFor(NO_UPGRADES, wins - 1);
    const turbo = bonusesFor(NO_UPGRADES, wins);
    expect(plain.turbo).toBe(false);
    expect(turbo.turbo).toBe(true);
    expect(turbo.speedMultiplier).toBeCloseTo(plain.speedMultiplier * config.turbo.speedMultiplier);
  });

  it('counts a win onto the streak and starts it over with a defeat', () => {
    expect(nextWinStreak(2, 'won')).toBe(3);
    expect(nextWinStreak(5, 'lost')).toBe(0);
  });
});
