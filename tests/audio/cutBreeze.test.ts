import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createCutBreeze, type CutBreeze } from '../../src/audio/cutBreeze';

const FRAME = 1 / 60;

/** Whether the breeze blows after `seconds` of frames that all cut, or all do not. */
function afterFrames(breeze: CutBreeze, cut: boolean, seconds: number): boolean {
  let blowing = false;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += FRAME) blowing = breeze.step(cut, FRAME);
  return blowing;
}

describe('cutBreeze', () => {
  it('is quiet while nothing has been cut', () => {
    expect(afterFrames(createCutBreeze(), false, 2)).toBe(false);
  });

  it('blows from the first frame that cuts', () => {
    expect(createCutBreeze().step(true, FRAME)).toBe(true);
  });

  it('keeps blowing through a gap shorter than holdSeconds, so frames without cuts do not make it flutter', () => {
    const breeze = createCutBreeze();
    breeze.step(true, FRAME);
    expect(afterFrames(breeze, false, config.audio.breeze.holdSeconds - 2 * FRAME)).toBe(true);
  });

  it('goes quiet once holdSeconds pass without a cut', () => {
    const breeze = createCutBreeze();
    breeze.step(true, FRAME);
    expect(afterFrames(breeze, false, config.audio.breeze.holdSeconds + FRAME)).toBe(false);
  });

  it('blows again at the next cut', () => {
    const breeze = createCutBreeze();
    breeze.step(true, FRAME);
    afterFrames(breeze, false, 1);
    expect(breeze.step(true, FRAME)).toBe(true);
  });
});
