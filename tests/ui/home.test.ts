import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../src/logic/save';
import { texts } from '../../src/texts';
import { homeDisplay } from '../../src/ui/home';

describe('homeDisplay', () => {
  it('offers to play the saved level and shows the balance the Spanish way', () => {
    expect(homeDisplay({ ...defaultSave(), level: 7, coins: 12_840 })).toEqual({
      coinsLabel: '12.840',
      playLabel: `${texts.home.play} · ${texts.hud.level} 7`,
      modeLabel: texts.home.timed,
    });
  });

  it('names the mode switch for playing without time once it is chosen', () => {
    expect(homeDisplay({ ...defaultSave(), timed: false }).modeLabel).toBe(texts.home.untimed);
  });
});
