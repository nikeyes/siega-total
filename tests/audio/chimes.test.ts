import { describe, expect, it } from 'vitest';
import { synthesizeConfetti, synthesizeLevelComplete, synthesizeLowTime, synthesizeStar } from '../../src/audio/chimes';
import { createRandom } from '../../src/logic/random';
import { loudestOf, SAMPLE_RATE, seconds, shareAbove } from './soundAnalysis';

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

describe('star notes', () => {
  it('rise from the first star to the third', () => {
    const notes = [1, 2, 3].map((index) => loudestOf(synthesizeStar(index, SAMPLE_RATE), NOTES));
    expect(notes).toEqual([330, 392, 523]);
  });

  it('ring for 0.9 s each', () => {
    expect(seconds(synthesizeStar(1, SAMPLE_RATE))).toBeCloseTo(0.9, 2);
  });
});

describe('level complete', () => {
  const sound = synthesizeLevelComplete(SAMPLE_RATE);

  it('arpeggiates C5, E5 and G5 in that order', () => {
    const slice = (from: number, to: number) => sound.subarray(Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE));
    expect(loudestOf(slice(0, 0.07), NOTES)).toBe(523);
    expect(loudestOf(slice(0.08, 0.15), [659, 784])).toBe(659);
    expect(loudestOf(slice(0.16, 0.4), [784, 659, 523])).toBe(784);
  });
});

describe('confetti', () => {
  const sound = synthesizeConfetti(SAMPLE_RATE, createRandom(1));

  it('sparkles for 1.2 s', () => {
    expect(seconds(sound)).toBeCloseTo(1.2, 2);
  });

  it('keeps fewer highs than the general rule asks', () => {
    expect(shareAbove(sound, 6000)).toBeLessThan(0.05);
  });
});
