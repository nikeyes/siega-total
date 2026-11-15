import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createCutBuzz } from '../../src/audio/cutBuzz';

describe('cutBuzz', () => {
  it('never buzzes while no cut rhythm is set', () => {
    expect(config.vibration.cutRhythm).toEqual([]);
    const buzz = createCutBuzz();
    let pulses = 0;
    for (let frame = 0; frame < 600; frame++) if (buzz.step(true, 1 / 60)) pulses++;
    expect(pulses).toBe(0);
  });
});
