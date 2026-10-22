import { describe, expect, it } from 'vitest';
import { bandPass, highPass, lowPass } from '../../src/audio/filters';

const SAMPLE_RATE = 44_100;

/** RMS of a sine at `hz` after `filter`, skipping the filter's settling time. */
function rmsAfter(filter: (samples: Float32Array) => Float32Array, hz: number): number {
  const sine = Float32Array.from({ length: SAMPLE_RATE }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE));
  const filtered = filter(sine).slice(SAMPLE_RATE / 4);
  return Math.sqrt(filtered.reduce((sum, sample) => sum + sample * sample, 0) / filtered.length);
}

const decibels = (gain: number) => 20 * Math.log10(gain);

describe('bandPass', () => {
  it('lets its centre through and cuts more than 20 dB a decade below and above', () => {
    const filter = (samples: Float32Array) => bandPass(samples, SAMPLE_RATE, 1000, 4000);
    const passed = rmsAfter(filter, 2000);
    expect(decibels(passed / Math.SQRT1_2)).toBeGreaterThan(-1);
    expect(decibels(rmsAfter(filter, 200) / passed)).toBeLessThan(-20);
    expect(decibels(rmsAfter(filter, 20_000) / passed)).toBeLessThan(-20);
  });
});

describe('lowPass and highPass', () => {
  it('lowPass keeps what is below its corner and cuts more than 20 dB a decade above', () => {
    const filter = (samples: Float32Array) => lowPass(samples, SAMPLE_RATE, 1000);
    expect(decibels(rmsAfter(filter, 100) / Math.SQRT1_2)).toBeGreaterThan(-1);
    expect(decibels(rmsAfter(filter, 10_000) / Math.SQRT1_2)).toBeLessThan(-20);
  });

  it('highPass keeps what is above its corner and cuts more than 20 dB a decade below', () => {
    const filter = (samples: Float32Array) => highPass(samples, SAMPLE_RATE, 1000);
    expect(decibels(rmsAfter(filter, 10_000) / Math.SQRT1_2)).toBeGreaterThan(-1);
    expect(decibels(rmsAfter(filter, 100) / Math.SQRT1_2)).toBeLessThan(-20);
  });
});
