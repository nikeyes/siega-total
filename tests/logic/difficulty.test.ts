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
  it('has only green grass and no obstacles in levels 1 to 3', () => {
    for (const level of [1, 2, 3]) {
      const difficulty = difficultyFor(level);
      expect(difficulty.grassTypes).toEqual(['green']);
      expect(difficulty.obstacleTypes).toEqual([]);
      expect([difficulty.rockCount, difficulty.fruitCount, difficulty.cactusCount]).toEqual([0, 0, 0]);
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
    expect(late.obstacleTypes).toEqual(['rock', 'watermelon', 'strawberry', 'cactus']);
    expect(difficultyFor(unlockLevel.fruit - 1).obstacleTypes).toEqual(['rock']);
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

  it('has no obstacles of a kind before it is unlocked', () => {
    expect(difficultyFor(unlockLevel.rock - 1).rockCount).toBe(0);
    expect(difficultyFor(unlockLevel.rock).rockCount).toBeGreaterThan(0);
    expect(difficultyFor(unlockLevel.fruit - 1).fruitCount).toBe(0);
    expect(difficultyFor(unlockLevel.cactus - 1).cactusCount).toBe(0);
    expect(difficultyFor(unlockLevel.cactus).cactusCount).toBeGreaterThan(0);
  });

  it('shrinks the time margin from first to last', () => {
    const { timeMargin } = config.generator;
    expect(difficultyFor(1).timeMargin).toBe(timeMargin.first);
    expect(difficultyFor(60).timeMargin).toBe(timeMargin.last);
  });
});
