import { describe, expect, it } from 'vitest';
import { texts } from '../../src/texts';
import { hudDisplay, levelLabel, type HudState } from '../../src/ui/hud';

const STATE: HudState = {
  timeLeft: 45.3,
  timeTotal: 90,
  remainingByTarget: [1284, 3],
  size: 3,
  growthFraction: 0.25,
  sizeLabelX: 195,
  sizeLabelY: 422,
  showBlocked: false,
  coins: 345,
  floatCoins: null,
};

describe('hudDisplay', () => {
  it('shows the coins with Spanish thousands', () => {
    expect(hudDisplay({ ...STATE, coins: 12840 }).coinsLabel).toBe('12.840');
  });

  it('shows the clock and the time ring from the time left', () => {
    const display = hudDisplay(STATE);
    expect(display.clock).toBe('0:46');
    expect(display.timePercent).toBe(50);
  });

  it('shows one counter per target, in the order of the level', () => {
    expect(hudDisplay(STATE).targetCounts).toEqual(['1284', '3']);
  });

  it('keeps showing 0 for a target already cleared while others remain', () => {
    expect(hudDisplay({ ...STATE, remainingByTarget: [0, 3] }).targetCounts).toEqual(['0', '3']);
  });

  it('groups thousands the Spanish way from five digits', () => {
    expect(hudDisplay({ ...STATE, remainingByTarget: [12840] }).targetCounts).toEqual(['12.840']);
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

  it('shows a full ring when no time has passed', () => {
    expect(hudDisplay({ ...STATE, timeLeft: STATE.timeTotal }).timePercent).toBe(100);
  });

  it('shows an empty ring and 0:00 when the time is over', () => {
    const display = hudDisplay({ ...STATE, timeLeft: 0 });
    expect(display.clock).toBe('0:00');
    expect(display.timePercent).toBe(0);
  });

  it.each([
    [0.333, 33],
    [0.666, 67],
  ])('rounds the size pill at %s to the nearest whole percent, %s', (fraction, percent) => {
    expect(hudDisplay({ ...STATE, growthFraction: fraction }).growthPercent).toBe(percent);
  });
});

describe('levelLabel', () => {
  it('names the level by its number', () => {
    expect(levelLabel(7)).toBe(`${texts.hud.level} 7`);
  });
});
