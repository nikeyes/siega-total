import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import type { GrassType } from '../../src/logic/field';
import { clearCellsUnderSolidObstacles, type LevelDefinition, type Obstacle } from '../../src/logic/levels';
import { analyzeLevel, estimateSeconds, validateLevel } from '../../src/logic/validation';

const SIDE = 30;
const CENTER = SIDE / 2;
/** A time any of these levels fits in, so only the rule under test can reject them. */
const ENOUGH_TIME = 60;

/** Chebyshev distance, in cells, from the cell to the four cells around the field center. */
function ringOf(cell: number): number {
  const column = cell % SIDE;
  const row = Math.floor(cell / SIDE);
  return Math.max(Math.abs(column + 0.5 - CENTER), Math.abs(row + 0.5 - CENTER)) - 0.5;
}

/** A 30 × 30 level of 1 m cells whose grass depends on the cell's ring around the center. */
function ringLevel(typeOfRing: (ring: number) => GrassType | null, overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  const obstacles = overrides.obstacles ?? [];
  const cells = Array.from({ length: SIDE * SIDE }, (_, cell) => typeOfRing(ringOf(cell)));
  clearCellsUnderSolidObstacles(cells, 1, SIDE, obstacles);
  return {
    number: 0,
    seed: config.field.seed,
    width: SIDE,
    depth: SIDE,
    cellSize: 1,
    cells,
    obstacles,
    targets: ['ice'],
    timeSeconds: ENOUGH_TIME,
    ...overrides,
  };
}

/** Green in the center `greenRings` rings around the start, then `type` everywhere else. */
function greenCenterThen(greenRings: number, type: GrassType, overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return ringLevel((ring) => (ring < greenRings ? 'green' : type), overrides);
}

describe('validateLevel', () => {
  it('accepts a level whose targets can all be reached and cut', () => {
    expect(validateLevel(greenCenterThen(3, 'ice'))).toEqual({ valid: true });
  });

  it('rejects an ice island walled in by rocks', () => {
    const wall = [2, 4, 6, 8].flatMap((a) => [
      { x: a, z: 2 },
      { x: a, z: 8 },
      { x: 2, z: a },
      { x: 8, z: a },
    ]);
    const rocks: Obstacle[] = wall.map(({ x, z }) => ({ type: 'rock', x, z }));
    const level = ringLevel(() => 'green', { obstacles: rocks });
    const cells = [...level.cells];
    for (let row = 3; row <= 6; row++) for (let column = 3; column <= 6; column++) cells[row * SIDE + column] = 'ice';
    expect(validateLevel({ ...level, cells })).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a lavender target when the green around the start cannot grow the blade to size 3', () => {
    expect(validateLevel(greenCenterThen(2, 'lavender', { targets: ['lavender'] }))).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('accepts a lavender target when enough green is in reach', () => {
    expect(validateLevel(greenCenterThen(4, 'lavender', { targets: ['lavender'] }))).toEqual({ valid: true });
  });

  it('accepts ice behind wheat only when the green in reach grows the blade to size 2', () => {
    const wheatThenIce = (greenRings: number) =>
      ringLevel((ring) => (ring < greenRings ? 'green' : ring < greenRings + 2 ? 'wheat' : 'ice'));
    expect(validateLevel(wheatThenIce(3))).toEqual({ valid: true });
    expect(validateLevel(wheatThenIce(1))).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('accepts a strawberry target inside wheat only when the blade can grow to size 2', () => {
    const strawberry: Obstacle[] = [{ type: 'strawberry', x: 5.5, z: 5.5 }];
    const overrides = { obstacles: strawberry, targets: ['strawberry'] as const };
    expect(validateLevel(greenCenterThen(3, 'wheat', overrides))).toEqual({ valid: true });
    expect(validateLevel(greenCenterThen(1, 'wheat', overrides))).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a target with no units on the field', () => {
    expect(validateLevel(ringLevel(() => 'green'))).toEqual({ valid: false, reason: 'noTargets' });
  });

  it('rejects a level whose time is longer than maxTimeSeconds', () => {
    const level = greenCenterThen(3, 'ice', { timeSeconds: config.generator.maxTimeSeconds + 1 });
    expect(validateLevel(level)).toEqual({ valid: false, reason: 'tooLong' });
  });

  it('rejects a level whose start is a wall', () => {
    expect(validateLevel(ringLevel(() => 'bramble', { targets: ['bramble'] }))).toEqual({ valid: false, reason: 'startBlocked' });
  });
});

describe('analyzeLevel', () => {
  it('reaches the size that every reachable cut adds up to', () => {
    const { finalSize, targetsReachable } = analyzeLevel(ringLevel(() => 'green', { targets: ['green'] }));
    expect(finalSize).toBeGreaterThan(config.blade.startSize + 5);
    expect(targetsReachable).toBe(true);
  });

  it('stays at the start size when there is nothing to cut in reach', () => {
    expect(analyzeLevel(ringLevel((ring) => (ring < 1 ? null : 'bramble'), { targets: ['bramble'] })).finalSize).toBe(config.blade.startSize);
  });
});

describe('estimateSeconds', () => {
  it('grows with the target area', () => {
    const small = estimateSeconds(ringLevel((ring) => (ring < 5 ? 'ice' : 'green')));
    const large = estimateSeconds(ringLevel((ring) => (ring < 10 ? 'ice' : 'green')));
    expect(large).toBeGreaterThan(small);
  });

  it('grows with each target piece', () => {
    const strawberries = (count: number): Obstacle[] =>
      Array.from({ length: count }, (_, index) => ({ type: 'strawberry', x: 3.5 + 3 * index, z: 3.5 }));
    const targets = ['ice', 'strawberry'] as const;
    const few = estimateSeconds(greenCenterThen(3, 'ice', { obstacles: strawberries(2), targets }));
    const many = estimateSeconds(greenCenterThen(3, 'ice', { obstacles: strawberries(6), targets }));
    expect(many - few).toBeCloseTo(4 * config.generator.secondsPerTargetPiece, 9);
  });

  it('takes longer when the targets need a bigger blade first', () => {
    const ice = estimateSeconds(greenCenterThen(3, 'ice'));
    const bramble = estimateSeconds(greenCenterThen(3, 'bramble', { targets: ['bramble'] }));
    expect(bramble).toBeGreaterThan(ice);
  });
});
