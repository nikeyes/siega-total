import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { pickCampaign } from '../../src/logic/campaignPicker';
import { generateLevel } from '../../src/logic/generator';
import { validateLevel } from '../../src/logic/validation';

const LAST_LEVEL = 10;
const campaign = pickCampaign(LAST_LEVEL);
const levels = Object.entries(campaign).map(([number, seed]) => generateLevel(Number(number), seed));

describe('pickCampaign', () => {
  it('gives a seed for exactly the levels 1 to lastLevel, the same ones every time', () => {
    expect(Object.keys(campaign).map(Number)).toEqual(Array.from({ length: LAST_LEVEL }, (_, index) => index + 1));
    expect(pickCampaign(LAST_LEVEL)).toEqual(campaign);
  });

  it('only picks valid levels', () => {
    for (const level of levels) expect(validateLevel(level), `level ${level.number}`).toEqual({ valid: true });
  });

  it('never repeats the pattern of the distinctPatternsBehind levels before', () => {
    const { distinctPatternsBehind } = config.campaign;
    levels.forEach((level, index) => {
      const behind = levels.slice(Math.max(0, index - distinctPatternsBehind), index).map(({ pattern }) => pattern);
      expect(behind, `level ${level.number}`).not.toContain(level.pattern);
    });
  });

  it('never uses the same seed twice', () => {
    expect(new Set(Object.values(campaign)).size).toBe(LAST_LEVEL);
  });
});
