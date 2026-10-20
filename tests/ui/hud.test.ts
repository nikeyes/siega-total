import { describe, expect, it } from 'vitest';
import { texts } from '../../src/texts';
import { hudDisplay, type HudState } from '../../src/ui/hud';

const STATE: HudState = {
  timeLeft: 45.3,
  timeTotal: 90,
  remainingFraction: 0.5,
  size: 3,
  growthFraction: 0.25,
  sizeLabelX: 195,
  sizeLabelY: 422,
};

describe('hudDisplay', () => {
  it('shows the clock and the time ring from the time left', () => {
    const display = hudDisplay(STATE);
    expect(display.clock).toBe('0:46');
    expect(display.timePercent).toBe(50);
  });

  it('fills the target bar with the target grass still standing', () => {
    expect(hudDisplay({ ...STATE, remainingFraction: 0.5 }).targetPercent).toBe(50);
  });

  it('labels the size pill with the blade size and fills it toward the next size', () => {
    const display = hudDisplay(STATE);
    expect(display.sizeLabel).toBe(`${texts.hud.size} 3`);
    expect(display.growthPercent).toBe(25);
  });

  it('places the size pill on whole pixels, so subpixel blade moves need no DOM write', () => {
    const display = hudDisplay({ ...STATE, sizeLabelX: 195.4, sizeLabelY: 421.6 });
    expect([display.sizeLabelX, display.sizeLabelY]).toEqual([195, 422]);
  });

  it('shows the same display for states the player cannot tell apart', () => {
    const later = { ...STATE, timeLeft: STATE.timeLeft - 0.05, sizeLabelX: STATE.sizeLabelX + 0.2 };
    expect(hudDisplay(later)).toEqual(hudDisplay(STATE));
  });

  it('shows a full ring and an empty bar at the extremes', () => {
    const display = hudDisplay({ ...STATE, timeLeft: STATE.timeTotal, remainingFraction: 0 });
    expect(display.timePercent).toBe(100);
    expect(display.targetPercent).toBe(0);
  });

  it('shows an empty ring and 0:00 when the time is over', () => {
    const display = hudDisplay({ ...STATE, timeLeft: 0 });
    expect(display.clock).toBe('0:00');
    expect(display.timePercent).toBe(0);
  });

  it.each([
    [0.333, 33],
    [0.666, 67],
  ])('rounds a bar at %s to the nearest whole percent, %s', (fraction, percent) => {
    const display = hudDisplay({ ...STATE, remainingFraction: fraction, growthFraction: fraction });
    expect([display.targetPercent, display.growthPercent]).toEqual([percent, percent]);
  });
});
