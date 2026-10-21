import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { bladeRadius } from '../../src/logic/blade';
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

/** A 30 × 30 level of 1 m cells whose grass depends on the cell's column and row. */
function cellLevel(
  typeOfCell: (column: number, row: number) => GrassType | null,
  overrides: Partial<LevelDefinition> = {},
): LevelDefinition {
  const obstacles = overrides.obstacles ?? [];
  const cells = Array.from({ length: SIDE * SIDE }, (_, cell) => typeOfCell(cell % SIDE, Math.floor(cell / SIDE)));
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

/** A level whose grass depends on the cell's ring around the center. */
function ringLevel(typeOfRing: (ring: number) => GrassType | null, overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return cellLevel((column, row) => typeOfRing(ringOf(row * SIDE + column)), overrides);
}

/** Rocks walling in the 4 × 4 cells whose top-left cell is (column, row). */
function rockPen(column: number, row: number): Obstacle[] {
  return [0, 2, 4, 6].flatMap((step): Obstacle[] => [
    { type: 'rock', x: column - 1 + step, z: row - 1 },
    { type: 'rock', x: column - 1 + step, z: row + 5 },
    { type: 'rock', x: column - 1, z: row - 1 + step },
    { type: 'rock', x: column + 5, z: row - 1 + step },
  ]);
}

/** 120 grass cells, so each holds 100 of the 12 000 blades: 2 cells grow size 1 to 2, 4 more grow 2 to 3. */
const GRASS_CELLS_OF_100_BLADES = config.field.bladeCount / 100;
const LAVENDER_IN_THE_CORNER = 6;

/** The first 6 cells lavender, green up to 120 grass cells, and sand everywhere else. */
function lavenderCornerLevel(targets: LevelDefinition['targets']): LevelDefinition {
  return cellLevel(
    (column, row) => {
      const cell = row * SIDE + column;
      return cell < LAVENDER_IN_THE_CORNER ? 'lavender' : cell < GRASS_CELLS_OF_100_BLADES ? 'green' : null;
    },
    { targets },
  );
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
    const level = ringLevel(() => 'green', { obstacles: rockPen(3, 3) });
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

  it('rejects a strawberry target walled in by rocks', () => {
    // The pen is off the diagonal, so mixing up x and z would put the strawberry in the open.
    const level = ringLevel(() => 'green', { obstacles: [...rockPen(3, 20), { type: 'strawberry', x: 4.5, z: 21.5 }], targets: ['strawberry'] });
    expect(validateLevel(level)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a strawberry target in the middle of grass the blade cannot enter, even right next to grass it can', () => {
    // Bramble pushes the blade back to its edge, out of reach of a strawberry half a cell inside.
    const strawberryInBramble: Obstacle[] = [{ type: 'strawberry', x: 18.5, z: 15.5 }];
    const level = greenCenterThen(3, 'bramble', { obstacles: strawberryInBramble, targets: ['strawberry'] });
    expect(analyzeLevel(level).finalSize).toBeLessThan(config.grassTypes.bramble.minSize);
    expect(validateLevel(level)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a strawberry target the blade never grows big enough to cut', () => {
    const strawberryByTheStart: Obstacle[] = [{ type: 'strawberry', x: 14.5, z: 14.5 }];
    const level = greenCenterThen(1, 'bramble', { obstacles: strawberryByTheStart, targets: ['strawberry'] });
    expect(validateLevel(level)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('accepts a target cell under a fruit, since the grown blade cuts the fruit', () => {
    const watermelonOnIce: Obstacle[] = [{ type: 'watermelon', x: 5.5, z: 5.5 }];
    expect(validateLevel(greenCenterThen(3, 'ice', { obstacles: watermelonOnIce }))).toEqual({ valid: true });
  });

  it('accepts a lavender target behind wheat, grown in two steps: green to size 2, then wheat to size 3', () => {
    const level = ringLevel((ring) => (ring < 2 ? 'green' : ring < 5 ? 'wheat' : 'lavender'), { targets: ['lavender'] });
    expect(validateLevel(level)).toEqual({ valid: true });
  });

  it('counts the growth of the fruit in reach, and not of the fruit out of it', () => {
    // 44 green cells of 13 blades give 572 cuts, short of the 600 to size 3; six strawberries add 30.
    const greenRow = 11;
    const typeOfCell = (column: number, row: number) => {
      const ring = ringOf(row * SIDE + column);
      return ring < 3 || (ring === 3 && row === greenRow) ? 'green' : 'lavender';
    };
    const strawberriesAt = (row: number): Obstacle[] =>
      Array.from({ length: 6 }, (_, index) => ({ type: 'strawberry', x: 12.5 + index, z: row + 0.5 }));
    const overrides = { targets: ['lavender'] as const };
    expect(validateLevel(cellLevel(typeOfCell, { ...overrides, obstacles: strawberriesAt(greenRow) }))).toEqual({ valid: true });
    expect(validateLevel(cellLevel(typeOfCell, { ...overrides, obstacles: strawberriesAt(2) }))).toEqual({
      valid: false,
      reason: 'unreachableTargets',
    });
  });

  it('does not reach across the left and right edges of the field', () => {
    // Green runs from the start to one edge; the ice sits at the other edge, one row off, walled by bramble.
    const greenToTheLeftIceRightAbove = cellLevel((column, row) =>
      row === 15 && column <= 15 ? 'green' : column === 29 && row === 14 ? 'ice' : 'bramble',
    );
    const greenToTheRightIceLeftBelow = cellLevel((column, row) =>
      row === 15 && column >= 15 ? 'green' : column === 0 && row === 16 ? 'ice' : 'bramble',
    );
    expect(validateLevel(greenToTheLeftIceRightAbove)).toEqual({ valid: false, reason: 'unreachableTargets' });
    expect(validateLevel(greenToTheRightIceLeftBelow)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a target with no units on the field', () => {
    expect(validateLevel(ringLevel(() => 'green'))).toEqual({ valid: false, reason: 'noTargets' });
    const onlyRocks = ringLevel(() => 'green', { obstacles: rockPen(3, 3), targets: ['strawberry'] });
    expect(validateLevel(onlyRocks)).toEqual({ valid: false, reason: 'noTargets' });
  });

  it('rejects a level whose time is longer than maxTimeSeconds', () => {
    const { maxTimeSeconds } = config.generator;
    expect(validateLevel(greenCenterThen(3, 'ice', { timeSeconds: maxTimeSeconds }))).toEqual({ valid: true });
    expect(validateLevel(greenCenterThen(3, 'ice', { timeSeconds: maxTimeSeconds + 1 }))).toEqual({ valid: false, reason: 'tooLong' });
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

  it('grows the moment the cuts reach the next size', () => {
    // Two green cells of 100 blades give exactly the 200 cuts to size 2, which opens the wheat around them.
    const isGreen = (cell: number) => cell === 15 * SIDE + 15 || cell === 14 * SIDE + 15;
    const wheatAroundGreen = 6;
    const wheatInTheCorner = GRASS_CELLS_OF_100_BLADES - 2 - wheatAroundGreen;
    const level = cellLevel((column, row) => {
      const cell = row * SIDE + column;
      if (isGreen(cell)) return 'green';
      const isAroundGreen = [cell - 1, cell + 1, cell - SIDE, cell + SIDE].some(isGreen);
      return isAroundGreen || cell < wheatInTheCorner ? 'wheat' : null;
    });
    expect(analyzeLevel(level).finalSize).toBeGreaterThan(config.blade.startSize);
  });

  it('counts the target cells plus the cells that grow the blade to the size the targets need', () => {
    const cellsToSweep = (targets: LevelDefinition['targets']) => analyzeLevel(lavenderCornerLevel(targets)).cellsToSweep;
    expect(cellsToSweep(['green'])).toBe(GRASS_CELLS_OF_100_BLADES - LAVENDER_IN_THE_CORNER);
    expect(cellsToSweep(['lavender'])).toBe(LAVENDER_IN_THE_CORNER + 2 + 4);
    expect(cellsToSweep(['strawberry'])).toBe(2);
  });

  it('stays at the start size when there is nothing to cut in reach', () => {
    expect(analyzeLevel(ringLevel((ring) => (ring < 1 ? null : 'bramble'), { targets: ['bramble'] })).finalSize).toBe(config.blade.startSize);
  });
});

describe('estimateSeconds', () => {
  it('sweeps each cell at full speed with the blade as wide as it has grown', () => {
    // 2 cells at size 1 and 4 at size 2 grow the blade to size 3, then the 6 lavender cells are swept at size 3.
    const secondsPerCell = (size: number) => 1 / (2 * bladeRadius(size) * config.blade.maxSpeed);
    const expected = 2 * secondsPerCell(1) + 4 * secondsPerCell(2) + LAVENDER_IN_THE_CORNER * secondsPerCell(3);
    expect(estimateSeconds(lavenderCornerLevel(['lavender']))).toBeCloseTo(expected, 9);
  });

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
