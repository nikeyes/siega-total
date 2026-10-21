import { describe, expect, it } from 'vitest';
import { campaignSeeds } from '../../src/campaign';
import { config } from '../../src/config';
import { createGame, remainingTargets } from '../../src/logic/game';
import { fallbackLevel, generateLevel } from '../../src/logic/generator';
import { attemptSeed, firstValidLevel, levelFor, rebuildsFromSeed } from '../../src/logic/progression';
import { validateLevel } from '../../src/logic/validation';

const LEVELS = Array.from({ length: 60 }, (_, index) => index + 1);
const { maxAttempts, maxTimeSeconds } = config.generator;

function isValidAttempt(levelNumber: number, attempt: number): boolean {
  return validateLevel(generateLevel(levelNumber, attemptSeed(levelNumber, attempt))).valid;
}

/** Runs `check` with the generator allowed only `attempts` tries per level. */
function withMaxAttempts(attempts: number, check: () => void): void {
  const original = config.generator.maxAttempts;
  config.generator.maxAttempts = attempts;
  try {
    check();
  } finally {
    config.generator.maxAttempts = original;
  }
}

function levelNeedingMostAttempts(): { number: number; attempt: number } {
  return LEVELS.map((number) => ({ number, attempt: firstValidLevel(number).attempt })).reduce((most, level) =>
    level.attempt > most.attempt ? level : most,
  );
}

describe('attemptSeed', () => {
  it('is deterministic', () => {
    expect(attemptSeed(12, 3)).toBe(attemptSeed(12, 3));
  });

  it('never repeats over levels 1 to 60 and attempts 0 to maxAttempts - 1', () => {
    const seeds = new Set(LEVELS.flatMap((level) => Array.from({ length: maxAttempts }, (_, attempt) => attemptSeed(level, attempt))));
    expect(seeds.size).toBe(LEVELS.length * maxAttempts);
  });

  it('gives 32-bit unsigned seeds', () => {
    for (const level of [1, 30, 60]) {
      const seed = attemptSeed(level, 0);
      expect(Number.isInteger(seed), `level ${level}`).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});

describe('levelFor', () => {
  it('gives a valid level, in time, with targets to cut, for every level from 1 to 60', () => {
    for (const number of LEVELS) {
      const level = levelFor(number);
      expect(level.number).toBe(number);
      expect(validateLevel(level), `level ${number}`).toEqual({ valid: true });
      expect(level.timeSeconds).toBeLessThanOrEqual(maxTimeSeconds);
      expect(remainingTargets(createGame(level)), `level ${number}`).toBeGreaterThan(0);
    }
  });

  it('uses the campaign seed of a level when there is one', () => {
    expect(levelFor(3, { 3: 1234 })).toEqual(generateLevel(3, 1234));
  });

  it('generates the first valid level from attempt 0 for the levels the campaign does not list', () => {
    const { attempt } = firstValidLevel(4);
    expect(levelFor(4, { 3: 1234 })).toEqual(generateLevel(4, attemptSeed(4, attempt)));
  });

  it('gives the fallback level when no seed validates', () => {
    withMaxAttempts(0, () => {
      expect(levelFor(10)).toEqual(fallbackLevel(10));
    });
  });
});

describe('firstValidLevel', () => {
  it('is the first attempt from attempt 0 on that validates, at every level', () => {
    for (const number of LEVELS) {
      const { attempt, ...level } = firstValidLevel(number);
      expect(level, `level ${number}`).toEqual(generateLevel(number, attemptSeed(number, attempt)));
      for (let earlier = 0; earlier < attempt; earlier++) {
        expect(isValidAttempt(number, earlier), `level ${number}, attempt ${earlier}`).toBe(false);
      }
    }
  });

  it('starts looking at firstAttempt', () => {
    const first = firstValidLevel(10);
    expect(firstValidLevel(10, first.attempt).attempt).toBe(first.attempt);
    expect(firstValidLevel(10, first.attempt + 1).attempt).toBeGreaterThan(first.attempt);
  });

  describe('with only a few attempts', () => {
    const { number, attempt: firstValid } = levelNeedingMostAttempts();

    it('still finds a valid level at the last attempt allowed', () => {
      withMaxAttempts(firstValid + 1, () => {
        expect(firstValidLevel(number)).toEqual({ ...generateLevel(number, attemptSeed(number, firstValid)), attempt: firstValid });
      });
    });

    it('gives the fallback level, with the last attempt tried, when none of them validates', () => {
      expect(firstValid, 'needs a level whose first two attempts fail').toBeGreaterThanOrEqual(2);
      withMaxAttempts(firstValid, () => {
        expect(firstValidLevel(number)).toEqual({ ...fallbackLevel(number), attempt: firstValid - 1 });
      });
    });
  });
});

describe('campaignSeeds', () => {
  it('lists exactly the campaign levels, from 1 to config.campaign.levels', () => {
    const expected = Array.from({ length: config.campaign.levels }, (_, index) => index + 1);
    expect(Object.keys(campaignSeeds).map(Number)).toEqual(expected);
  });

  it('only lists seeds that give valid levels', () => {
    for (const [number, seed] of Object.entries(campaignSeeds)) {
      expect(validateLevel(generateLevel(Number(number), seed)), `level ${number}`).toEqual({ valid: true });
    }
  });
});

describe('levels after the campaign', () => {
  it('are valid, have targets and repeat no seed of the campaign or of each other, up to level 100', () => {
    const seeds = new Set(Object.values(campaignSeeds));
    for (let number = config.campaign.levels + 1; number <= 100; number++) {
      const level = levelFor(number, campaignSeeds);
      expect(validateLevel(level), `level ${number}`).toEqual({ valid: true });
      expect(remainingTargets(createGame(level)), `level ${number}`).toBeGreaterThan(0);
      expect(seeds.has(level.seed), `level ${number}`).toBe(false);
      seeds.add(level.seed);
    }
  });
});

describe('fallbackLevel', () => {
  it('is valid at every level', () => {
    for (const number of [1, 13, 25, 60]) expect(validateLevel(fallbackLevel(number)), `level ${number}`).toEqual({ valid: true });
  });
});

describe('rebuildsFromSeed', () => {
  it('is true for a generated level, so its seed can go into the campaign', () => {
    expect(rebuildsFromSeed(firstValidLevel(12))).toBe(true);
  });

  it('is false for the fallback level, whose seed gives a different level', () => {
    expect(rebuildsFromSeed(fallbackLevel(12))).toBe(false);
  });
});
