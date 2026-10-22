import { describe, expect, it } from 'vitest';
import { synthesizeLowTime } from '../../src/audio/chimes';
import { loudestOf, SAMPLE_RATE, seconds } from './soundAnalysis';

const NOTES = [330, 392, 440, 523, 659, 784];

describe('low time warning', () => {
  const sound = synthesizeLowTime(SAMPLE_RATE);

  it('lasts 1.2 s', () => {
    expect(seconds(sound)).toBeCloseTo(1.2, 2);
  });

  it('plays two notes, the second lower than the first', () => {
    const half = sound.length / 2;
    expect(loudestOf(sound.subarray(0, half), NOTES)).toBe(440);
    expect(loudestOf(sound.subarray(half), NOTES)).toBe(330);
  });
});
