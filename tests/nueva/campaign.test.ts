import { describe, expect, it } from 'vitest';
import { campaignSeeds } from '../../src/campaign';
import { generateLevel } from '../../src/logic/generator';
import { validateLevel } from '../../src/logic/validation';

describe('the campaign in the nueva build', () => {
  it('only gives valid levels with the changes of the new variant', () => {
    for (const [number, seed] of Object.entries(campaignSeeds)) {
      expect(validateLevel(generateLevel(Number(number), seed)), `level ${number}`).toEqual({ valid: true });
    }
  });
});
