import { describe, expect, it } from 'vitest';
import { createCutBuzz, type CutBuzz } from '../../src/audio/cutBuzz';

const FRAME = 1 / 60;

/** Seconds between the buzzes of `seconds` of steady cutting, after `warmup` seconds of it. */
function gapsBetweenBuzzes(buzz: CutBuzz, warmup: number, seconds: number): number[] {
  for (let elapsed = 0; elapsed < warmup; elapsed += FRAME) buzz.step(true, FRAME);
  const times: number[] = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) if (buzz.step(true, FRAME)) times.push(elapsed);
  return times.slice(1).map((time, index) => time - times[index]!);
}

describe('cutBuzz', () => {
  it('buzzes at once when the blade starts cutting', () => {
    expect(createCutBuzz().step(true, FRAME)).toBe(true);
  });

  it('never buzzes while the blade does not cut', () => {
    const buzz = createCutBuzz();
    let pulses = 0;
    for (let frame = 0; frame < 600; frame++) if (buzz.step(false, FRAME)) pulses++;
    expect(pulses).toBe(0);
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
});
