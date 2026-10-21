import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { difficultyFor, type Unlockable } from '../../src/logic/difficulty';
import { GRASS_TYPE_ORDER } from '../../src/logic/field';
import { fallbackLevel, generateLevel } from '../../src/logic/generator';
import { obstacleRadius } from '../../src/logic/obstacles';

const { unlockLevel, startClearingMeters, obstacleGapMeters, maxTimeSeconds, roundTimeToSeconds } = config.generator;
const SEEDS = Array.from({ length: 12 }, (_, index) => 1000 + index * 37);
/** Levels that cover every stage of the curve, including after it flattens. */
const LEVELS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 40];

describe('generateLevel', () => {
  it('generates the same level from the same seed', () => {
    expect(generateLevel(22, 99)).toEqual(generateLevel(22, 99));
  });

  it('generates different levels from different seeds', () => {
    const fields = new Set(SEEDS.map((seed) => JSON.stringify([generateLevel(22, seed).cells, generateLevel(22, seed).obstacles])));
    expect(fields.size).toBeGreaterThan(1);
  });

  it('keeps the level number and the seed, on a 30 × 30 field of 1 m cells', () => {
    const level = generateLevel(7, 1234);
    expect([level.number, level.seed, level.width, level.depth, level.cellSize]).toEqual([7, 1234, config.field.width, config.field.depth, 1]);
    expect(level.cells).toHaveLength(config.field.width * config.field.depth);
  });

  const introductions = (Object.entries(unlockLevel) as [Unlockable, number][]).filter(([element]) => element !== 'rock');

  it.each(introductions)('makes %s, new at level %i, the only target and puts it on the field', (element, level) => {
    for (const seed of SEEDS) {
      const generated = generateLevel(level, seed);
      expect(generated.targets).toHaveLength(1);
      const [target] = generated.targets;
      if (element === 'fruit') expect(['watermelon', 'strawberry']).toContain(target);
      else expect(target).toBe(element);
      const onField = generated.cells.includes(target as never) || generated.obstacles.some(({ type }) => type === target);
      expect(onField, `seed ${seed}`).toBe(true);
    }
  });

  it('targets the most numerous fruit when fruit is new', () => {
    for (const seed of SEEDS) {
      const level = generateLevel(unlockLevel.fruit, seed);
      const count = (type: string) => level.obstacles.filter((obstacle) => obstacle.type === type).length;
      expect(count(level.targets[0]!), `seed ${seed}`).toBe(Math.max(count('watermelon'), count('strawberry')));
    }
  });

  it('targets green in levels 1 to 3', () => {
    for (const level of [1, 2, 3]) expect(generateLevel(level, 5).targets).toEqual(['green']);
  });

  it('puts rocks on the field from their unlock level', () => {
    for (const seed of SEEDS) expect(generateLevel(unlockLevel.rock, seed).obstacles.some(({ type }) => type === 'rock'), `seed ${seed}`).toBe(true);
  });

  it('asks for at most targetCount distinct targets, never rocks', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const { targets } = generateLevel(level, seed);
        expect(new Set(targets).size).toBe(targets.length);
        expect(targets.length).toBeLessThanOrEqual(Math.max(1, difficultyFor(level).targetCount));
        expect(targets).not.toContain('rock');
      }
    }
  });

  it('leaves the start clearing as sand, with no obstacle on it', () => {
    const center = config.field.width / 2;
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const generated = generateLevel(level, seed);
        generated.cells.forEach((type, cell) => {
          const distance = Math.hypot((cell % 30) + 0.5 - center, Math.floor(cell / 30) + 0.5 - center);
          if (distance <= startClearingMeters / 2) expect(type, `level ${level} seed ${seed} cell ${cell}`).toBeNull();
        });
        for (const { type, x, z } of generated.obstacles) {
          expect(Math.hypot(x - center, z - center), `level ${level} seed ${seed}`).toBeGreaterThan(startClearingMeters / 2 + obstacleRadius(type));
        }
      }
    }
  });

  it('keeps every pair of obstacles at least their radii plus obstacleGapMeters apart, inside the field', () => {
    for (const seed of SEEDS) {
      const { obstacles } = generateLevel(40, seed);
      expect(obstacles.length).toBeGreaterThan(0);
      obstacles.forEach((a, i) => {
        const radius = obstacleRadius(a.type);
        expect(a.x - radius).toBeGreaterThanOrEqual(0);
        expect(a.x + radius).toBeLessThanOrEqual(config.field.width);
        expect(a.z - radius).toBeGreaterThanOrEqual(0);
        expect(a.z + radius).toBeLessThanOrEqual(config.field.depth);
        obstacles.slice(i + 1).forEach((b) => {
          expect(Math.hypot(a.x - b.x, a.z - b.z), `seed ${seed}`).toBeGreaterThanOrEqual(radius + obstacleRadius(b.type) + obstacleGapMeters);
        });
      });
    }
  });

  it('puts fruit on grass, and no grass under rocks or cacti', () => {
    for (const seed of SEEDS) {
      const level = generateLevel(40, seed);
      for (const { type, x, z } of level.obstacles) {
        const cell = level.cells[Math.floor(z) * 30 + Math.floor(x)];
        if (type === 'watermelon' || type === 'strawberry') expect(cell, `seed ${seed}`).not.toBeNull();
        else expect(cell, `seed ${seed}`).toBeNull();
      }
    }
  });

  it('only uses unlocked grass types and obstacles', () => {
    for (const level of LEVELS) {
      const difficulty = difficultyFor(level);
      for (const seed of SEEDS) {
        const generated = generateLevel(level, seed);
        for (const type of generated.cells) if (type !== null) expect(difficulty.grassTypes).toContain(type);
        for (const { type } of generated.obstacles) expect(difficulty.obstacleTypes).toContain(type);
      }
    }
  });

  it('gives a time rounded up to roundTimeToSeconds', () => {
    for (const level of LEVELS) expect(generateLevel(level, 7).timeSeconds % roundTimeToSeconds).toBe(0);
  });
});

describe('fallbackLevel', () => {
  it('is the first unlocked grass everywhere but the start, as the only target, in time', () => {
    const level = fallbackLevel(30);
    const [firstType] = difficultyFor(30).grassTypes;
    expect(level.number).toBe(30);
    expect(level.targets).toEqual([firstType]);
    expect(new Set(level.cells.filter((type) => type !== null))).toEqual(new Set([firstType]));
    expect(level.obstacles).toEqual([]);
    expect(level.timeSeconds).toBeLessThanOrEqual(maxTimeSeconds);
    expect(GRASS_TYPE_ORDER).toContain(firstType);
  });
});
