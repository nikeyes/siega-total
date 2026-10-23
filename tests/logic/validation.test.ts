import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { bladeRadius, cutsToNextSize } from '../../src/logic/blade';
import type { GrassType } from '../../src/logic/field';
import { clearCellsUnderSolidObstacles, type LevelDefinition, type Obstacle } from '../../src/logic/levels';
import { analyzeLevel, estimateSeconds, travelSeconds, validateLevel } from '../../src/logic/validation';

/** The fixtures are as big as a real field, so their grass has the reference density. */
const SIDE = config.field.width;
const CENTER = SIDE / 2;
/** A time any of these levels fits in, so only the rule under test can reject them. */
const ENOUGH_TIME = 60;

/** Chebyshev distance, in cells, from the cell to the four cells around the field center. */
function ringOf(cell: number): number {
  const column = cell % SIDE;
  const row = Math.floor(cell / SIDE);
  return Math.max(Math.abs(column + 0.5 - CENTER), Math.abs(row + 0.5 - CENTER)) - 0.5;
}

/** A SIDE × SIDE level of 1 m cells whose grass depends on the cell's column and row. */
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

/** Rocks 2 m apart walling in the `cells` × `cells` cells whose top-left cell is (column, row); `cells` is even. */
function rockPen(column: number, row: number, cells: number): Obstacle[] {
  const steps = Array.from({ length: cells / 2 + 2 }, (_, step) => step * 2);
  return steps.flatMap((step): Obstacle[] => [
    { type: 'rock', x: column - 1 + step, z: row - 1 },
    { type: 'rock', x: column - 1 + step, z: row + cells + 1 },
    { type: 'rock', x: column - 1, z: row - 1 + step },
    { type: 'rock', x: column + cells + 1, z: row - 1 + step },
  ]);
}

/** Small enough for a pen in a corner to keep clear of the start. */
const PEN_CELLS = 2;

/** referenceBladeCount / 100 grass cells, so each holds 100 blades: 2 cells grow size 1 to 2, 4 more grow 2 to 3. */
const GRASS_CELLS_OF_100_BLADES = config.field.referenceBladeCount / 100;
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
    const level = ringLevel(() => 'green', { obstacles: rockPen(1, 1, PEN_CELLS) });
    const cells = [...level.cells];
    for (let row = 1; row <= PEN_CELLS; row++) for (let column = 1; column <= PEN_CELLS; column++) cells[row * SIDE + column] = 'ice';
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
    const level = ringLevel(() => 'green', {
      obstacles: [...rockPen(1, SIDE - 1 - PEN_CELLS, PEN_CELLS), { type: 'strawberry', x: 2, z: SIDE - PEN_CELLS }],
      targets: ['strawberry'],
    });
    expect(validateLevel(level)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a strawberry target in the middle of grass the blade cannot enter, even right next to grass it can', () => {
    // Bramble pushes the blade back to its edge, out of reach of a strawberry half a cell inside.
    const strawberryInBramble: Obstacle[] = [{ type: 'strawberry', x: CENTER + 3.5, z: CENTER + 0.5 }];
    const level = greenCenterThen(3, 'bramble', { obstacles: strawberryInBramble, targets: ['strawberry'] });
    expect(analyzeLevel(level).finalSize).toBeLessThan(config.grassTypes.bramble.minSize);
    expect(validateLevel(level)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a strawberry target the blade never grows big enough to cut', () => {
    // In the green by the start, but clear of where the blade starts.
    const strawberryByTheStart: Obstacle[] = [{ type: 'strawberry', x: CENTER - 0.8, z: CENTER + 0.8 }];
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
    // 44 green cells of 13 or 14 blades give 588 cuts, short of the 600 to size 3; six strawberries add 30.
    const greenRow = CENTER - 4;
    const typeOfCell = (column: number, row: number) => {
      const ring = ringOf(row * SIDE + column);
      return ring < 3 || (ring === 3 && row === greenRow) ? 'green' : 'lavender';
    };
    const strawberriesAt = (row: number): Obstacle[] =>
      Array.from({ length: 6 }, (_, index) => ({ type: 'strawberry', x: CENTER - 2.5 + index, z: row + 0.5 }));
    const overrides = { targets: ['lavender'] as const };
    // In the green south of the start, where they block no way into the strip.
    const inReachRow = CENTER + 2;
    expect(validateLevel(cellLevel(typeOfCell, { ...overrides, obstacles: strawberriesAt(inReachRow) }))).toEqual({ valid: true });
    expect(validateLevel(cellLevel(typeOfCell, { ...overrides, obstacles: strawberriesAt(2) }))).toEqual({
      valid: false,
      reason: 'unreachableTargets',
    });
  });

  it('does not reach across the left and right edges of the field', () => {
    // Green runs from the start to one edge; the ice sits at the other edge, one row off, walled by bramble.
    const greenToTheLeftIceRightAbove = cellLevel((column, row) =>
      row === CENTER && column <= CENTER ? 'green' : column === SIDE - 1 && row === CENTER - 1 ? 'ice' : 'bramble',
    );
    const greenToTheRightIceLeftBelow = cellLevel((column, row) =>
      row === CENTER && column >= CENTER ? 'green' : column === 0 && row === CENTER + 1 ? 'ice' : 'bramble',
    );
    expect(validateLevel(greenToTheLeftIceRightAbove)).toEqual({ valid: false, reason: 'unreachableTargets' });
    expect(validateLevel(greenToTheRightIceLeftBelow)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a target with no units on the field', () => {
    expect(validateLevel(ringLevel(() => 'green'))).toEqual({ valid: false, reason: 'noTargets' });
    const onlyRocks = ringLevel(() => 'green', { obstacles: rockPen(1, 1, PEN_CELLS), targets: ['strawberry'] });
    expect(validateLevel(onlyRocks)).toEqual({ valid: false, reason: 'noTargets' });
  });

  it('rejects a level whose time is longer than maxTimeSeconds', () => {
    const { maxTimeSeconds } = config.generator;
    expect(validateLevel(greenCenterThen(3, 'ice', { timeSeconds: maxTimeSeconds }))).toEqual({ valid: true });
    expect(validateLevel(greenCenterThen(3, 'ice', { timeSeconds: maxTimeSeconds + 1 }))).toEqual({ valid: false, reason: 'tooLong' });
  });

  /**
   * Bramble everywhere but green round the start (the 2 × 2 cells around the field center) and a green corridor
   * `width` cells wide heading east from it, to an ice target by the east edge with a strip of sand round it.
   */
  function corridorToIce(width: number): LevelDefinition {
    const corridorRows = width === 1 ? [CENTER] : [CENTER - 1, CENTER];
    return cellLevel((column, row) => {
      const fromCenterRow = Math.abs(row + 0.5 - CENTER);
      if (column >= SIDE - 3 && fromCenterRow <= 2) return 'ice';
      if (column >= SIDE - 4 && fromCenterRow <= 3) return null;
      if ((column === CENTER - 1 || column === CENTER) && (row === CENTER - 1 || row === CENTER)) return 'green';
      if (column > CENTER && corridorRows.includes(row)) return 'green';
      return 'bramble';
    });
  }

  it('accepts a corridor wide enough for a blade of every start size the shop sells', () => {
    expect(validateLevel(corridorToIce(2))).toEqual({ valid: true });
  });

  it('rejects a corridor only a size-1 blade fits through, since a player who bought a bigger start would be stuck', () => {
    expect(bladeRadius(config.blade.startSize) * 2).toBeLessThanOrEqual(1);
    expect(bladeRadius(config.blade.startSize + config.upgrades.startSize.perLevel) * 2).toBeGreaterThan(1);
    expect(validateLevel(corridorToIce(1))).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('does not count on the shore: a target the blade could only get to round the edge of the field is rejected', () => {
    // Ice in the north-west corner with sand round it, walled from the start by bramble but open to the edge of the field;
    // sand everywhere else, so the blade never grows enough to cut the bramble.
    const level = cellLevel((column, row) => {
      if (column <= 1 && row <= 1) return 'ice';
      if (column <= 2 && row <= 2) return null;
      if (column <= 3 && row <= 3) return 'bramble';
      return null;
    });
    expect(validateLevel(level)).toEqual({ valid: false, reason: 'unreachableTargets' });
  });

  it('rejects a level whose start is a wall', () => {
    expect(validateLevel(ringLevel(() => 'bramble', { targets: ['bramble'] }))).toEqual({ valid: false, reason: 'startBlocked' });
  });
});

describe('analyzeLevel', () => {
  it('reaches the size that every reachable cut adds up to', () => {
    const { finalSize, targetsReachable } = analyzeLevel(ringLevel(() => 'green', { targets: ['green'] }));
    let size = config.blade.startSize;
    for (let cuts = config.field.referenceBladeCount; cuts >= cutsToNextSize(size); size++) cuts -= cutsToNextSize(size);
    expect(finalSize).toBe(size);
    expect(targetsReachable).toBe(true);
  });

  it('grows the moment the cuts reach the next size', () => {
    // Two green cells of 100 blades give exactly the 200 cuts to size 2, which opens the wheat around them.
    const isGreen = (cell: number) => cell === CENTER * SIDE + CENTER || cell === (CENTER - 1) * SIDE + CENTER;
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
  it('sweeps each cell at full speed with the blade as wide as it has grown, and adds the travel between the targets', () => {
    // 2 cells at size 1 and 4 at size 2 grow the blade to size 3, then the 6 lavender cells are swept at size 3.
    const secondsPerCell = (size: number) => 1 / (2 * bladeRadius(size) * config.blade.maxSpeed);
    const sweep = 2 * secondsPerCell(1) + 4 * secondsPerCell(2) + LAVENDER_IN_THE_CORNER * secondsPerCell(3);
    const level = lavenderCornerLevel(['lavender']);
    expect(estimateSeconds(level)).toBeCloseTo(sweep + travelSeconds(level), 9);
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
    expect(many - few).toBeGreaterThanOrEqual(4 * config.generator.secondsPerTargetPiece);
  });

  it('gives a target piece that takes several hits the time to land them', () => {
    const pieceAt = (type: 'strawberry' | 'watermelon'): Obstacle[] => [{ type, x: CENTER + 2, z: CENTER }];
    // Lavender targets ask for size 3 either way, so the blade grows alike and only the hits tell the levels apart.
    const level = (type: 'strawberry' | 'watermelon') => greenCenterThen(4, 'lavender', { obstacles: pieceAt(type), targets: ['lavender', type] });
    const extraHits = config.obstacles.watermelon.hits - 1;
    expect(estimateSeconds(level('watermelon')) - travelSeconds(level('watermelon'))).toBeCloseTo(
      estimateSeconds(level('strawberry')) - travelSeconds(level('strawberry')) + extraHits * config.collision.hitIntervalSeconds,
      9,
    );
  });

  it('takes longer when the targets need a bigger blade first', () => {
    const ice = estimateSeconds(greenCenterThen(3, 'ice'));
    const bramble = estimateSeconds(greenCenterThen(3, 'bramble', { targets: ['bramble'] }));
    expect(bramble).toBeGreaterThan(ice);
  });
});

describe('travelSeconds', () => {
  /** Ice cells in the given columns of the row just north of the start, green everywhere else. */
  const iceAt = (columns: number[], row = CENTER - 1) => cellLevel((column, cellRow) => (cellRow === row && columns.includes(column) ? 'ice' : 'green'));

  it('is next to nothing for a target right by the start', () => {
    expect(travelSeconds(iceAt([CENTER - 1, CENTER]))).toBeLessThan(0.2);
  });

  it('grows with how far the targets lie from the start', () => {
    expect(travelSeconds(iceAt([0, 1], 0))).toBeGreaterThan(travelSeconds(iceAt([CENTER - 1, CENTER])));
  });

  it('takes longer when the same target area is split into patches far apart', () => {
    const together = cellLevel((column, row) => (row === 1 && column <= 3 ? 'ice' : 'green'));
    const apart = cellLevel((column, row) => (row === 1 && (column <= 1 || column >= SIDE - 2) ? 'ice' : row === SIDE - 2 && column === 1 ? 'ice' : 'green'));
    expect(travelSeconds(apart)).toBeGreaterThan(travelSeconds(together));
  });

  it('follows the way the blade can go, round walls, not a straight line', () => {
    // The same ice to the east of the start: open in one level, behind a bramble wall with a gap at the far north in the other.
    const ice = (column: number, row: number) => column >= SIDE - 2 && row >= CENTER - 1 && row <= CENTER;
    const open = cellLevel((column, row) => (ice(column, row) ? 'ice' : null));
    const walled = cellLevel((column, row) => (ice(column, row) ? 'ice' : column === CENTER + 3 && row > 1 ? 'bramble' : null));
    expect(validateLevel(walled)).toEqual({ valid: true });
    expect(travelSeconds(walled)).toBeGreaterThan(travelSeconds(open) + 1);
  });
});
