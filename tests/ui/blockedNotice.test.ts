import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createBlockedNotice } from '../../src/ui/blockedNotice';

const { blockedMessageSeconds } = config.collision;
const FRAME = 1 / 60;

/** How many of `frames` frames of `blocked` show the notice. */
function shownCount(notice: ReturnType<typeof createBlockedNotice>, blocked: boolean, frames: number): number {
  let shown = 0;
  for (let frame = 0; frame < frames; frame++) if (notice.step(blocked, FRAME)) shown++;
  return shown;
}

describe('blockedNotice', () => {
  it('does not show while the blade moves freely', () => {
    expect(shownCount(createBlockedNotice(), false, 120)).toBe(0);
  });

  it('shows on the first blocked step', () => {
    expect(createBlockedNotice().step(true, FRAME)).toBe(true);
  });

  it('does not repeat before blockedMessageSeconds of being blocked', () => {
    const notice = createBlockedNotice();
    notice.step(true, FRAME);
    expect(shownCount(notice, true, Math.floor(blockedMessageSeconds / FRAME) - 2)).toBe(0);
  });

  it('repeats every blockedMessageSeconds while the blade keeps pushing', () => {
    const notice = createBlockedNotice();
    const framesInThreePeriods = Math.round((3 * blockedMessageSeconds) / FRAME);
    expect(shownCount(notice, true, framesInThreePeriods)).toBe(3);
  });

  it('shows again at once when the blade is blocked again after moving freely', () => {
    const notice = createBlockedNotice();
    notice.step(true, FRAME);
    notice.step(false, FRAME);
    expect(notice.step(true, FRAME)).toBe(true);
  });
});
