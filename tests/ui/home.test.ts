import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../src/logic/save';
import { texts } from '../../src/texts';
import { homeDisplay } from '../../src/ui/home';

describe('homeDisplay', () => {
  it('offers to play the saved level and shows the balance the Spanish way', () => {
    const display = homeDisplay({ ...defaultSave(), level: 7, coins: 12_840 });
    expect(display.coinsLabel).toBe('12.840');
    expect(display.playLabel).toBe(`${texts.home.play} · ${texts.hud.level} 7`);
  });

  it('offers both modes side by side, free play first, with free play chosen for a new player', () => {
    expect(homeDisplay(defaultSave()).modes).toEqual([
      { timed: false, label: texts.home.untimed, chosen: true },
      { timed: true, label: texts.home.timed, chosen: false },
    ]);
  });

  it('marks the clock as chosen once the player picks it, still showing both', () => {
    expect(homeDisplay({ ...defaultSave(), timed: true }).modes).toEqual([
      { timed: false, label: texts.home.untimed, chosen: false },
      { timed: true, label: texts.home.timed, chosen: true },
    ]);
  });
});
