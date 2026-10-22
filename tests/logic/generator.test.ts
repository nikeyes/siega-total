import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { difficultyFor, type Unlockable } from '../../src/logic/difficulty';
import { fallbackLevel, generateLevel } from '../../src/logic/generator';
import { isObstacleType } from '../../src/logic/levels';
import { obstacleRadius } from '../../src/logic/obstacles';
import { PATTERNS } from '../../src/logic/patterns';
import { estimateSeconds, validateLevel } from '../../src/logic/validation';

const { unlockLevel, startClearingMeters, obstacleGapMeters, roundTimeToSeconds } = config.generator;
const COLUMNS = config.field.width;
const CENTER = config.field.width / 2;
const SEEDS = Array.from({ length: 12 }, (_, index) => 1000 + index * 37);
/** Levels that cover every stage of the curve, including after it flattens. */
const LEVELS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 40];

const isInStartClearing = (cell: number) =>
  Math.hypot((cell % COLUMNS) + 0.5 - CENTER, Math.floor(cell / COLUMNS) + 0.5 - CENTER) <= startClearingMeters / 2;

describe('generateLevel', () => {
  it('generates the same level from the same seed', () => {
    expect(generateLevel(22, 99)).toEqual(generateLevel(22, 99));
  });

  it('generates different levels from different seeds', () => {
    const fields = new Set(SEEDS.map((seed) => {
      const { cells, obstacles } = generateLevel(22, seed);
      return JSON.stringify([cells, obstacles]);
    }));
    expect(fields.size).toBeGreaterThan(1);
  });

  it('draws the field from more than one pattern, and names the pattern it used', () => {
    const patterns = new Set(SEEDS.map((seed) => generateLevel(22, seed).pattern));
    expect(patterns.size).toBeGreaterThan(1);
    for (const pattern of patterns) expect(Object.keys(PATTERNS)).toContain(pattern);
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

  it('gives each region a different grass type, so the field shows grassTypeCount types', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const types = new Set(generateLevel(level, seed).cells.filter((type) => type !== null));
        expect(types.size, `level ${level} seed ${seed}`).toBe(difficultyFor(level).grassTypeCount);
      }
    }
  });

  it('draws the pattern with green and sand in the one-grass levels 1 to 3', () => {
    for (const level of [1, 2, 3]) {
      for (const seed of SEEDS) {
        const { cells } = generateLevel(level, seed);
        const description = `level ${level} seed ${seed}`;
        expect(new Set(cells.filter((type) => type !== null)), description).toEqual(new Set(['green']));
        expect(cells.some((type, cell) => type === null && !isInStartClearing(cell)), description).toBe(true);
      }
    }
  });

  it('draws levels with two grass types or more as before', () => {
    expect(difficultyFor(10).grassTypeCount).toBeGreaterThanOrEqual(2);
    expect(generateLevel(10, SEEDS[0]!).cells).toMatchSnapshot();
  });

  it('shuffles the unlocked grass types, so every one of them shows up across seeds', () => {
    const shown = new Set(SEEDS.flatMap((seed) => generateLevel(40, seed).cells));
    for (const type of difficultyFor(40).grassTypes) expect(shown, type).toContain(type);
  });

  it('makes each fruit a watermelon or a strawberry at random', () => {
    const fruits = new Set(SEEDS.flatMap((seed) => generateLevel(40, seed).obstacles.map(({ type }) => type)));
    expect(fruits).toContain('watermelon');
    expect(fruits).toContain('strawberry');
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

  it('otherwise asks for targetCount targets, chosen at random among the grass and the cuttable pieces on the field', () => {
    const chosen = new Set<string>();
    for (const level of [unlockLevel.rock, 25, 40]) {
      for (const seed of SEEDS) {
        const generated = generateLevel(level, seed);
        const present = new Set([...generated.cells, ...generated.obstacles.map(({ type }) => type)]);
        present.delete(null);
        present.delete('rock');
        expect(generated.targets, `level ${level} seed ${seed}`).toHaveLength(Math.min(difficultyFor(level).targetCount, present.size));
        for (const target of generated.targets) expect(present, `level ${level} seed ${seed}`).toContain(target);
        if (level === 40) for (const target of generated.targets) chosen.add(isObstacleType(target) ? 'piece' : 'grass');
      }
    }
    expect(chosen).toEqual(new Set(['grass', 'piece']));
  });

  it('leaves the start clearing as sand, with no obstacle on it', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const generated = generateLevel(level, seed);
        generated.cells.forEach((type, cell) => {
          if (isInStartClearing(cell)) expect(type, `level ${level} seed ${seed} cell ${cell}`).toBeNull();
        });
        for (const { type, x, z } of generated.obstacles) {
          expect(Math.hypot(x - CENTER, z - CENTER), `level ${level} seed ${seed}`).toBeGreaterThan(startClearingMeters / 2 + obstacleRadius(type));
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
        const cell = level.cells[Math.floor(z) * COLUMNS + Math.floor(x)];
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

  it("gives the estimate times the level's margin, rounded up to roundTimeToSeconds, plus extraSeconds", () => {
    for (const level of LEVELS) {
      const generated = generateLevel(level, 7);
      const exact = estimateSeconds(generated) * difficultyFor(level).timeMargin + config.generator.extraSeconds;
      expect(generated.timeSeconds % roundTimeToSeconds, `level ${level}`).toBe(0);
      expect(generated.timeSeconds, `level ${level}`).toBeGreaterThanOrEqual(exact);
      expect(generated.timeSeconds, `level ${level}`).toBeLessThan(exact + roundTimeToSeconds);
    }
  });
});

describe('fallbackLevel', () => {
  const level = fallbackLevel(30);
  const [firstType] = difficultyFor(30).grassTypes;

  it('is the first unlocked grass everywhere but the sand start clearing, with no obstacles', () => {
    expect(level.number).toBe(30);
    expect(level.obstacles).toEqual([]);
    expect(level.cells).toEqual(level.cells.map((_, cell) => (isInStartClearing(cell) ? null : firstType)));
  });

  it('asks for that grass only, with the time margin of level 1 and extraSeconds', () => {
    const exact = estimateSeconds(level) * difficultyFor(1).timeMargin + config.generator.extraSeconds;
    expect(level.targets).toEqual([firstType]);
    expect(level.timeSeconds).toBeGreaterThanOrEqual(exact);
    expect(level.timeSeconds).toBeLessThan(exact + roundTimeToSeconds);
  });

  it('passes validation, so it can always stand in for a level', () => {
    expect(validateLevel(level)).toEqual({ valid: true });
  });
});
