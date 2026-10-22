import { describe, expect, it } from 'vitest';
import { synthesizeBreak } from '../../src/audio/breakSounds';
import { createRandom } from '../../src/logic/random';
import { bandShare, envelopePeakSeconds, SAMPLE_RATE, seconds } from './soundAnalysis';

describe('watermelon break', () => {
  const sound = synthesizeBreak('watermelon', SAMPLE_RATE, createRandom(1));

  it('lasts 0.75 s and peaks early, as the splash hits', () => {
    expect(seconds(sound)).toBeCloseTo(0.75, 2);
    expect(envelopePeakSeconds(sound)).toBeGreaterThanOrEqual(0.05);
    expect(envelopePeakSeconds(sound)).toBeLessThanOrEqual(0.12);
  });

  it('has both a low thump below 300 Hz and a splash between 1.5 and 5 kHz', () => {
    expect(bandShare(sound, 40, 300)).toBeGreaterThan(0.1);
    expect(bandShare(sound, 1500, 5000)).toBeGreaterThan(0.25);
  });
});

describe('strawberry break', () => {
  const sound = synthesizeBreak('strawberry', SAMPLE_RATE, createRandom(1));

  it('is a short pop of 0.5 s that peaks at once', () => {
    expect(seconds(sound)).toBeCloseTo(0.5, 2);
    expect(envelopePeakSeconds(sound)).toBeLessThanOrEqual(0.1);
  });

  it('sits mostly between 1 and 4 kHz', () => {
    expect(bandShare(sound, 1000, 4000)).toBeGreaterThan(0.3);
    expect(bandShare(sound, 1000, 4000)).toBeGreaterThan(bandShare(sound, 300, 1000));
  });
});

describe('cactus break', () => {
  const sound = synthesizeBreak('cactus', SAMPLE_RATE, createRandom(1));

  it('is a dry crack of 0.4 s, loudest within its first crackles', () => {
    expect(seconds(sound)).toBeCloseTo(0.4, 2);
    expect(envelopePeakSeconds(sound)).toBeLessThanOrEqual(0.18);
  });

  it('crackles mostly between 1 and 3.5 kHz', () => {
    expect(bandShare(sound, 1000, 3500)).toBeGreaterThan(0.3);
    expect(bandShare(sound, 1000, 3500)).toBeGreaterThan(bandShare(sound, 40, 300));
  });
});

describe.each(['watermelon', 'strawberry', 'cactus'] as const)('%s break variants', (obstacle) => {
  it('sounds the same for the same seed and different for each of 4 seeds', () => {
    expect(synthesizeBreak(obstacle, SAMPLE_RATE, createRandom(7))).toEqual(synthesizeBreak(obstacle, SAMPLE_RATE, createRandom(7)));
    const variants = [1, 2, 3, 4].map((seed) => synthesizeBreak(obstacle, SAMPLE_RATE, createRandom(seed)).join(','));
    expect(new Set(variants).size).toBe(4);
  });
});
