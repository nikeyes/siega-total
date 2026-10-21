import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createCutRhythm, type CutRhythm } from '../../src/audio/cutRhythm';

const FRAME = 1 / 60;

/** The rates of the zips played in `steps` steps of `dt` seconds, all with the same `cut`. */
function zipRates(rhythm: CutRhythm, cut: boolean, steps: number, dt: number): number[] {
  const rates: number[] = [];
  for (let step = 0; step < steps; step++) {
    const rate = rhythm.step(cut, dt);
    if (rate !== null) rates.push(rate);
  }
  return rates;
}

describe('cutRhythm', () => {
  it('plays no zip while nothing is cut', () => {
    expect(zipRates(createCutRhythm(), false, 120, FRAME)).toEqual([]);
  });

  it('plays the first cut at once at the base pitch', () => {
    expect(createCutRhythm().step(true, FRAME)).toBe(1);
  });

  it('raises each zip of a streak by cutPitchStep, never above cutMaxPitch', () => {
    const { cutMinIntervalSeconds, cutPitchStep, cutMaxPitch } = config.audio;
    const zipsToTheTop = Math.ceil((cutMaxPitch - 1) / cutPitchStep) + 5;
    const rates = zipRates(createCutRhythm(), true, zipsToTheTop, cutMinIntervalSeconds);
    expect(rates).toHaveLength(zipsToTheTop);
    expect(rates[1]).toBeCloseTo(1 + cutPitchStep);
    expect(rates[2]).toBeCloseTo(1 + 2 * cutPitchStep);
    expect(Math.max(...rates)).toBe(cutMaxPitch);
    expect(rates.at(-1)).toBe(cutMaxPitch);
  });

  it('plays no second zip in a burst of zero-length cutting steps', () => {
    const rhythm = createCutRhythm();
    expect(zipRates(rhythm, true, 10, 0)).toEqual([1]);
  });

  it('waits until a full cutMinIntervalSeconds has passed before the second zip', () => {
    const { cutMinIntervalSeconds, cutPitchStep } = config.audio;
    const rhythm = createCutRhythm();
    rhythm.step(true, FRAME);
    expect(rhythm.step(true, cutMinIntervalSeconds * 0.99)).toBeNull();
    expect(rhythm.step(true, cutMinIntervalSeconds * 0.02)).toBeCloseTo(1 + cutPitchStep);
  });

  it('zips every fourth frame at 60 fps, never sooner', () => {
    const rhythm = createCutRhythm();
    const played: number[] = [];
    for (let frame = 0; frame < 40; frame++) if (rhythm.step(true, FRAME) !== null) played.push(frame);
    const gaps = played.slice(1).map((frame, index) => frame - played[index]!);
    const framesPerZip = Math.ceil(config.audio.cutMinIntervalSeconds / FRAME - 1e-9);
    expect(new Set(gaps)).toEqual(new Set([framesPerZip]));
  });

  it('does not bank the overshoot of a long step into the next zip', () => {
    const { cutMinIntervalSeconds } = config.audio;
    const rhythm = createCutRhythm();
    rhythm.step(true, FRAME);
    expect(rhythm.step(true, cutMinIntervalSeconds * 1.9)).not.toBeNull();
    expect(rhythm.step(true, cutMinIntervalSeconds * 0.5)).toBeNull();
  });

  it('ends the streak when the pause adds up to cutStreakResetSeconds over many frames', () => {
    const { cutMinIntervalSeconds, cutStreakResetSeconds } = config.audio;
    const rhythm = createCutRhythm();
    zipRates(rhythm, true, 3, cutMinIntervalSeconds);
    const pauseFrames = Math.ceil(cutStreakResetSeconds / FRAME - 1e-9);
    zipRates(rhythm, false, pauseFrames, FRAME);
    expect(rhythm.step(true, FRAME)).toBe(1);
  });

  it('keeps the streak through a pause one frame short of cutStreakResetSeconds', () => {
    const { cutMinIntervalSeconds, cutPitchStep, cutStreakResetSeconds } = config.audio;
    const rhythm = createCutRhythm();
    zipRates(rhythm, true, 3, cutMinIntervalSeconds);
    const pauseFrames = Math.ceil(cutStreakResetSeconds / FRAME - 1e-9) - 1;
    zipRates(rhythm, false, pauseFrames, FRAME);
    expect(rhythm.step(true, FRAME)).toBeCloseTo(1 + 3 * cutPitchStep);
  });

  it('keeps the streak through many short pauses that add up past cutStreakResetSeconds', () => {
    const { cutMinIntervalSeconds, cutPitchStep, cutStreakResetSeconds } = config.audio;
    const rhythm = createCutRhythm();
    rhythm.step(true, FRAME);
    const shortPause = cutStreakResetSeconds * 0.9;
    for (let pause = 0; pause < 6; pause++) {
      rhythm.step(false, shortPause);
      rhythm.step(true, FRAME);
    }
    // Each short pause is longer than cutMinIntervalSeconds, so each cut after it zips one step higher.
    expect(shortPause).toBeGreaterThan(cutMinIntervalSeconds);
    rhythm.step(false, shortPause);
    expect(rhythm.step(true, FRAME)).toBeCloseTo(1 + 7 * cutPitchStep);
  });

  it('plays the first zip after a short pause at once when the interval has passed meanwhile', () => {
    const { cutMinIntervalSeconds, cutPitchStep } = config.audio;
    const rhythm = createCutRhythm();
    rhythm.step(true, FRAME);
    rhythm.step(false, cutMinIntervalSeconds);
    expect(rhythm.step(true, 0)).toBeCloseTo(1 + cutPitchStep);
  });

  it('goes back to the base pitch after cutStreakResetSeconds without cutting, then climbs again', () => {
    const { cutMinIntervalSeconds, cutPitchStep, cutStreakResetSeconds } = config.audio;
    const rhythm = createCutRhythm();
    zipRates(rhythm, true, 10, cutMinIntervalSeconds);
    rhythm.step(false, cutStreakResetSeconds);
    const rates = zipRates(rhythm, true, 3, cutMinIntervalSeconds);
    expect(rates[0]).toBe(1);
    expect(rates[1]).toBeCloseTo(1 + cutPitchStep);
    expect(rates[2]).toBeCloseTo(1 + 2 * cutPitchStep);
  });

  it('never plays a zip on a step without a cut, even mid-streak with the interval elapsed', () => {
    const { cutMinIntervalSeconds } = config.audio;
    const rhythm = createCutRhythm();
    rhythm.step(true, FRAME);
    expect(zipRates(rhythm, false, 3, cutMinIntervalSeconds)).toEqual([]);
  });

  describe('when the debug panel tunes the rhythm', () => {
    const originalAudio = structuredClone(config.audio);
    afterEach(() => {
      // config is shared by every test: put back what a test changed.
      Object.assign(config.audio, originalAudio);
    });

    it('uses the new pitch step at once, in a rhythm created before', () => {
      const rhythm = createCutRhythm();
      config.audio.cutPitchStep = 0.25;
      rhythm.step(true, FRAME);
      expect(rhythm.step(true, config.audio.cutMinIntervalSeconds)).toBeCloseTo(1.25);
    });
  });

  it('keeps separate rhythms independent', () => {
    const { cutMinIntervalSeconds } = config.audio;
    const first = createCutRhythm();
    zipRates(first, true, 5, cutMinIntervalSeconds);
    expect(createCutRhythm().step(true, FRAME)).toBe(1);
  });
});
