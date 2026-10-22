import { describe, expect, it } from 'vitest';
import { createRandom } from '../../src/logic/random';
import { synthesizeCutLoop } from '../../src/audio/cutLoop';

const SAMPLE_RATE = 48000;
const SECONDS = 4;

const rms = (samples: ArrayLike<number>) => Math.sqrt(Array.from(samples).reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
const steps = (samples: Float32Array) => samples.slice(1).map((sample, index) => sample - samples[index]!);

/** RMS of each 10 ms slice. */
function sliceLevels(samples: Float32Array): number[] {
  const slice = SAMPLE_RATE / 100;
  return Array.from({ length: Math.floor(samples.length / slice) }, (_, index) => rms(samples.subarray(index * slice, (index + 1) * slice)));
}

describe('cut loop', () => {
  const loop = synthesizeCutLoop(SAMPLE_RATE, SECONDS, createRandom(1));

  it('lasts the seconds asked for', () => {
    expect(loop.length).toBe(SAMPLE_RATE * SECONDS);
  });

  it('has unit RMS, so its gain alone sets how loud it plays', () => {
    expect(rms(loop)).toBeCloseTo(1, 3);
  });

  it('is crisp: most of its sound is high, so it changes nearly as much from sample to sample as it swings', () => {
    expect(rms(steps(loop)) / rms(loop)).toBeGreaterThan(0.6);
  });

  it('comes in snips: the loudest moments stand well above the hiss between them', () => {
    const levels = sliceLevels(loop).sort((a, b) => a - b);
    const median = levels[Math.floor(levels.length / 2)]!;
    expect(levels.at(-1)! / median).toBeGreaterThan(2.5);
  });

  it('goes round without a click: from its end to its start is an ordinary step', () => {
    const wrap = Math.abs(loop[0]! - loop.at(-1)!);
    expect(wrap).toBeLessThan(3 * rms(steps(loop)));
  });
});
