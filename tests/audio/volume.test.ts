import { describe, expect, it } from 'vitest';
import { sliderGain } from '../../src/audio/volume';

describe('slider gain', () => {
  it('is silent at the bottom and untouched at the top', () => {
    expect(sliderGain(0)).toBe(0);
    expect(sliderGain(1)).toBe(1);
  });

  it('drops faster than the slider, so halfway already sounds clearly quieter', () => {
    expect(sliderGain(0.5)).toBeCloseTo(0.25);
  });
});
