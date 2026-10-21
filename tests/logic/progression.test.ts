import { describe, expect, it } from 'vitest';
import { campaignSeeds } from '../../src/campaign';
import { config } from '../../src/config';
import { createGame, remainingTargets } from '../../src/logic/game';
import { fallbackLevel, generateLevel } from '../../src/logic/generator';
import { attemptSeed, firstValidLevel, levelFor } from '../../src/logic/progression';
import { validateLevel } from '../../src/logic/validation';

const LEVELS = Array.from({ length: 60 }, (_, index) => index + 1);
const { maxAttempts, maxTimeSeconds } = config.generator;

describe('attemptSeed', () => {
  it('is deterministic', () => {
    expect(attemptSeed(12, 3)).toBe(attemptSeed(12, 3));
  });

  it('never repeats over levels 1 to 60 and attempts 0 to maxAttempts - 1', () => {
    const seeds = new Set(LEVELS.flatMap((level) => Array.from({ length: maxAttempts }, (_, attempt) => attemptSeed(level, attempt))));
    expect(seeds.size).toBe(LEVELS.length * maxAttempts);
  });

  it('gives 32-bit unsigned seeds', () => {
    for (const level of [1, 30, 60]) expect(Number.isInteger(attemptSeed(level, 0)) && attemptSeed(level, 0) >= 0 && attemptSeed(level, 0) < 2 ** 32).toBe(true);
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

  it('generates the levels the campaign does not list', () => {
    expect(levelFor(4, { 3: 1234 })).toEqual(levelFor(4));
  });
});

describe('firstValidLevel', () => {
  it('is the first attempt from firstAttempt on that validates', () => {
    const { attempt, ...level } = firstValidLevel(10);
    expect(level).toEqual(generateLevel(10, attemptSeed(10, attempt)));
    for (let earlier = 0; earlier < attempt; earlier++) {
      expect(validateLevel(generateLevel(10, attemptSeed(10, earlier))).valid).toBe(false);
    }
  });

  it('starts looking at firstAttempt', () => {
    const first = firstValidLevel(10);
    expect(firstValidLevel(10, first.attempt + 1).attempt).toBeGreaterThan(first.attempt);
  });
});

describe('campaignSeeds', () => {
  it('only lists seeds that give valid levels', () => {
    for (const [number, seed] of Object.entries(campaignSeeds)) {
      expect(validateLevel(generateLevel(Number(number), seed)), `level ${number}`).toEqual({ valid: true });
    }
  });
});

describe('fallbackLevel', () => {
  it('is valid at every level', () => {
    for (const number of [1, 13, 25, 60]) expect(validateLevel(fallbackLevel(number)), `level ${number}`).toEqual({ valid: true });
  });
});
