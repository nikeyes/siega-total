import { describe, expect, it } from 'vitest';
import { synthesizeBreak } from '../../src/audio/breakSounds';
import { fadeEdges, mixAt, normalizePeak } from '../../src/audio/synthesis';
import { createRandom } from '../../src/logic/random';
import { SAMPLE_RATE } from './soundAnalysis';

const peakOf = (samples: Float32Array) => samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);

describe('synthesis edge cases', () => {
  it('leaves silence silent when normalizing', () => {
    expect(normalizePeak(new Float32Array(10), 0.5)).toEqual(new Float32Array(10));
  });

  it('drops what a mix runs past the end of its target', () => {
    const target = new Float32Array(4);
    mixAt(target, Float32Array.from([1, 1, 1, 1]), 2 / SAMPLE_RATE, SAMPLE_RATE);
    expect(Array.from(target)).toEqual([0, 0, 1, 1]);
  });

  it('fades both edges of a very short sound to zero', () => {
    const faded = fadeEdges(Float32Array.from([1, 1, 1, 1, 1]), SAMPLE_RATE);
    expect(Math.abs(faded[0]!)).toBe(0);
    expect(Math.abs(faded.at(-1)!)).toBe(0);
  });

  it.each(['watermelon', 'strawberry', 'cactus'] as const)('starts a %s break without a click whatever the seed', (obstacle) => {
    for (let seed = 0; seed < 40; seed++) {
      const sound = synthesizeBreak(obstacle, SAMPLE_RATE, createRandom(seed));
      expect(peakOf(sound.subarray(0, SAMPLE_RATE * 0.002)), `seed ${seed}`).toBeLessThan(peakOf(sound) * 0.1);
    }
  });

  it('works at a 48 kHz sample rate too', () => {
    const sound = synthesizeBreak('watermelon', 48_000, createRandom(1));
    expect(sound.length).toBe(36_000);
    expect(peakOf(sound)).toBeCloseTo(0.5, 2);
  });
});
