import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { curveValue, difficultyFor, type Unlockable } from '../../src/logic/difficulty';

const { unlockLevel, curveLastLevel, rockCount } = config.generator;
const LEVELS = Array.from({ length: 60 }, (_, index) => index + 1);

describe('curveValue', () => {
  it('goes from first at level 1 to last at curveLastLevel, and stays there', () => {
    expect(curveValue(rockCount, 1)).toBe(rockCount.first);
    expect(curveValue(rockCount, curveLastLevel)).toBe(rockCount.last);
    expect(curveValue(rockCount, 60)).toBe(rockCount.last);
  });

  it('is linear in between', () => {
    const middle = (1 + curveLastLevel) / 2;
    expect(curveValue(rockCount, middle)).toBeCloseTo((rockCount.first + rockCount.last) / 2, 9);
  });
});

describe('difficultyFor', () => {
  it('has only green grass and no obstacles in level 1', () => {
    const difficulty = difficultyFor(1);
    expect(difficulty.levelNumber).toBe(1);
    expect(difficulty.grassTypes).toEqual(['green']);
    expect(difficulty.obstacleTypes).toEqual([]);
    expect([difficulty.rockCount, difficulty.fruitCount, difficulty.cactusCount]).toEqual([0, 0, 0]);
  });

  it('brings something new in each of the first five levels', () => {
    expect([2, 3, 4, 5].map((level) => difficultyFor(level).newElement)).toEqual(['fruit', 'ice', 'wheat', 'rock']);
  });

  it('brings a grass the starting blade can cut along with a new grass it cannot', () => {
    for (const type of ['wheat', 'lavender', 'bramble'] as const) {
      expect(config.grassTypes[type].minSize).toBeGreaterThan(config.blade.startSize);
      expect(difficultyFor(unlockLevel[type]).grassTypeCount, type).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(Object.entries(unlockLevel) as [Unlockable, number][])('introduces %s at level %i, and only there', (element, level) => {
    expect(difficultyFor(level).newElement).toBe(element);
    expect(difficultyFor(level + 1).newElement).not.toBe(element);
  });

  it('has no new element between the unlock levels', () => {
    const unlockLevels = new Set(Object.values(unlockLevel));
    for (const level of LEVELS.filter((level) => !unlockLevels.has(level))) expect(difficultyFor(level).newElement).toBeNull();
  });

  it('lists the unlocked grass types and obstacles in order of appearance, fruit as both kinds', () => {
    const late = difficultyFor(60);
    expect(late.grassTypes).toEqual(['green', 'ice', 'wheat', 'lavender', 'bramble']);
    expect(late.obstacleTypes).toEqual(['watermelon', 'strawberry', 'rock', 'cactus']);
    expect(difficultyFor(unlockLevel.rock - 1).obstacleTypes).toEqual(['watermelon', 'strawberry']);
  });

  it('never asks for more grass types than are unlocked', () => {
    for (const level of LEVELS) {
      const difficulty = difficultyFor(level);
      expect(difficulty.grassTypeCount).toBeLessThanOrEqual(difficulty.grassTypes.length);
      expect(difficulty.grassTypeCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives whole counts that never drop from one level to the next', () => {
    const counts = (level: number) => {
      const { grassTypeCount, targetCount, rockCount, fruitCount, cactusCount } = difficultyFor(level);
      return [grassTypeCount, targetCount, rockCount, fruitCount, cactusCount];
    };
    for (const level of LEVELS) {
      expect(counts(level).every(Number.isInteger), `level ${level}`).toBe(true);
      if (level > 1) counts(level).forEach((count, index) => expect(count, `level ${level}`).toBeGreaterThanOrEqual(counts(level - 1)[index]!));
    }
  });

  it('rounds the curve to the nearest whole for the grass type and target counts, but for a grass too tough to start with', () => {
    const { grassTypeCount, targetCount } = config.generator;
    const toughGrassLevels = new Set([unlockLevel.wheat, unlockLevel.lavender, unlockLevel.bramble]);
    for (const level of LEVELS) {
      const difficulty = difficultyFor(level);
      const fromCurve = Math.min(Math.round(curveValue(grassTypeCount, level)), difficulty.grassTypes.length);
      const expected = toughGrassLevels.has(level) ? Math.max(2, fromCurve) : fromCurve;
      expect(difficulty.grassTypeCount, `level ${level}`).toBe(expected);
      expect(difficulty.targetCount, `level ${level}`).toBe(Math.round(curveValue(targetCount, level)));
    }
  });

  it.each(['rock', 'fruit', 'cactus'] as const)('has no %s before it unlocks, then the curve rounded to the nearest whole', (kind) => {
    const range = config.generator[`${kind}Count`];
    for (const level of LEVELS) {
      const expected = level < unlockLevel[kind] ? 0 : Math.round(curveValue(range, level));
      expect(difficultyFor(level)[`${kind}Count`], `level ${level}`).toBe(expected);
    }
    expect(difficultyFor(unlockLevel[kind])[`${kind}Count`]).toBeGreaterThan(0);
  });

  it('shrinks the time margin from first to last', () => {
    const { timeMargin } = config.generator;
    expect(difficultyFor(1).timeMargin).toBe(timeMargin.first);
    expect(difficultyFor(60).timeMargin).toBe(timeMargin.last);
  });
});
