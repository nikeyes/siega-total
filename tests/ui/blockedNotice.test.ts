import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createBlockedNotice, type BlockedNotice } from '../../src/ui/blockedNotice';

const { blockedMessageSeconds } = config.collision;
const FRAME = 1 / 60;
/** A quarter period is exact in binary, so four of them add up to exactly blockedMessageSeconds. */
const QUARTER = blockedMessageSeconds / 4;

/** Which of `steps` steps of `dt` seconds show the notice, by index. */
function shownSteps(notice: BlockedNotice, blocked: boolean, steps: number, dt: number): number[] {
  const shown: number[] = [];
  for (let step = 0; step < steps; step++) if (notice.step(blocked, dt)) shown.push(step);
  return shown;
}

describe('blockedNotice', () => {
  it('does not show while the blade moves freely', () => {
    expect(shownSteps(createBlockedNotice(), false, 120, FRAME)).toEqual([]);
  });

  it('shows on the first blocked step', () => {
    expect(createBlockedNotice().step(true, FRAME)).toBe(true);
  });

  it('does not repeat before blockedMessageSeconds of being blocked', () => {
    const notice = createBlockedNotice();
    notice.step(true, QUARTER);
    expect(shownSteps(notice, true, 3, QUARTER)).toEqual([]);
  });

  it('repeats on the step that completes blockedMessageSeconds since it was shown', () => {
    const notice = createBlockedNotice();
    expect(shownSteps(notice, true, 9, QUARTER)).toEqual([0, 4, 8]);
  });

  it('repeats once per blockedMessageSeconds at 60 fps', () => {
    const framesInThreePeriods = Math.round((3 * blockedMessageSeconds) / FRAME);
    expect(shownSteps(createBlockedNotice(), true, framesInThreePeriods, FRAME)).toHaveLength(3);
  });

  it('shows again at once when the blade is blocked again after moving freely', () => {
    const notice = createBlockedNotice();
    notice.step(true, QUARTER);
    notice.step(true, QUARTER);
    notice.step(false, QUARTER);
    expect(notice.step(true, QUARTER)).toBe(true);
  });
});
