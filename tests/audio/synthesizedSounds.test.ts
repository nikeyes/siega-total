import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createRandom } from '../../src/logic/random';
import { playbackRate, SYNTHESIZED_SOUND_NAMES, synthesizeVariants, variantsOf } from '../../src/audio/synthesizedSounds';
import { rms, SAMPLE_RATE, shareAbove } from './soundAnalysis';

const peakOf = (samples: Float32Array) => samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);

describe.each(SYNTHESIZED_SOUND_NAMES)('%s keeps the calm', (name) => {
  const variants = synthesizeVariants(name, SAMPLE_RATE);

  it('peaks at 0.5 at most', () => {
    for (const sound of variants) expect(peakOf(sound)).toBeLessThanOrEqual(0.5 + 1e-6);
  });

  it('plays quieter than the effects it replaces: RMS × volume at most 0.12', () => {
    for (const sound of variants) expect(rms(sound) * config.audio.volume[name]).toBeLessThanOrEqual(0.12);
  });

  it('starts without a click: its first 2 ms stay under 10 % of its peak', () => {
    for (const sound of variants) expect(peakOf(sound.subarray(0, SAMPLE_RATE * 0.002))).toBeLessThan(peakOf(sound) * 0.1);
  });

  it('starts and ends at zero', () => {
    for (const sound of variants) {
      expect(Math.abs(sound[0]!)).toBe(0);
      expect(Math.abs(sound.at(-1)!)).toBe(0);
    }
  });

  it('keeps less than 10 % of its energy above 6 kHz', () => {
    for (const sound of variants) expect(shareAbove(sound, 6000)).toBeLessThan(0.1);
  });
});

describe('variants and pitch', () => {
  it('gives each break config.audio.variants versions', () => {
    expect([variantsOf('watermelonBreak'), variantsOf('strawberryBreak'), variantsOf('cactusBreak')]).toEqual([4, 4, 4]);
  });

  it('synthesizes 4 different versions of a break, the same ones every session', () => {
    const versions = synthesizeVariants('watermelonBreak', SAMPLE_RATE);
    expect(new Set(versions.map((version) => version.join(','))).size).toBe(4);
    expect(synthesizeVariants('watermelonBreak', SAMPLE_RATE)).toEqual(versions);
  });

  it('plays a break a little higher or lower each time, within pitchJitter', () => {
    const random = createRandom(5);
    const rates = Array.from({ length: 50 }, () => playbackRate('cactusBreak', random));
    expect(Math.min(...rates)).toBeGreaterThanOrEqual(1 - config.audio.pitchJitter);
    expect(Math.max(...rates)).toBeLessThanOrEqual(1 + config.audio.pitchJitter);
    expect(new Set(rates).size).toBeGreaterThan(1);
  });

  it('plays the downloaded sounds at their own pitch', () => {
    expect(playbackRate('sizeUp', createRandom(5))).toBe(1);
  });
});
