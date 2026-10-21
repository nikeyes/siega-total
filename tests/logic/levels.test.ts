import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import type { GrassType } from '../../src/logic/field';
import { bladeRadius } from '../../src/logic/blade';
import { obstacleRadius } from '../../src/logic/obstacles';
import {
  clearCellsUnderSolidObstacles,
  clearStart,
  isObstacleType,
  sampleLevel,
  SAMPLE_LEVEL_SIDE,
  stripesLevel,
  type LevelDefinition,
  type ObstacleType,
} from '../../src/logic/levels';

const { stripeWidthMeters } = config.level;
/** The sample level clears the start like the generator will. */
const SAMPLE_START_CLEARING_METERS = 3;

function columnCount(level: LevelDefinition): number {
  return level.width / level.cellSize;
}

function columnTypes(level: LevelDefinition, column: number): (GrassType | null)[] {
  const columns = columnCount(level);
  return level.cells.filter((_, cell) => cell % columns === column);
}

/** The grass type of each column, from west to east, when every cell in a column has the same type. */
function typeByColumn(level: LevelDefinition): (GrassType | null)[] {
  return Array.from({ length: columnCount(level) }, (_, column) => {
    const types = new Set(columnTypes(level, column));
    expect(types.size, `column ${column}`).toBe(1);
    return [...types][0]!;
  });
}

function sandCells(cells: readonly (GrassType | null)[]): number[] {
  return cells.flatMap((type, cell) => (type === null ? [cell] : []));
}

/** Runs of neighboring columns with the same grass type, from west to east. */
function stripesOf(level: LevelDefinition): { type: GrassType | null; columns: number }[] {
  const stripes: { type: GrassType | null; columns: number }[] = [];
  for (const type of typeByColumn(level)) {
    const last = stripes.at(-1);
    if (last?.type === type) last.columns++;
    else stripes.push({ type, columns: 1 });
  }
  return stripes;
}

describe('stripesLevel', () => {
  it('covers the configured field with one cell per square meter', () => {
    const level = stripesLevel();
    expect(level.width).toBe(config.field.width);
    expect(level.depth).toBe(config.field.depth);
    expect(level.cells).toHaveLength((level.width / level.cellSize) * (level.depth / level.cellSize));
  });

  it('starts with a green stripe at the west edge and alternates it with ice', () => {
    const types = stripesOf(stripesLevel()).map((stripe) => stripe.type);
    expect(types.length).toBeGreaterThan(2);
    types.forEach((type, stripe) => expect(type, `stripe ${stripe}`).toBe(stripe % 2 === 0 ? 'green' : 'ice'));
  });

  it('makes every stripe stripeWidthMeters wide, but the last one, which ends at the east edge', () => {
    const level = stripesLevel();
    const widths = stripesOf(level).map((stripe) => stripe.columns * level.cellSize);
    const last = widths.pop()!;
    expect(widths.every((width) => width === stripeWidthMeters)).toBe(true);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThanOrEqual(stripeWidthMeters);
  });

  it('targets ice with the configured time', () => {
    const level = stripesLevel();
    expect(level.targets).toEqual(['ice']);
    expect(level.timeSeconds).toBe(config.level.timeSeconds);
  });

  it('is a hand-made level without obstacles, seeded with the configured field seed', () => {
    const level = stripesLevel();
    expect(level.number).toBe(0);
    expect(level.seed).toBe(config.field.seed);
    expect(level.obstacles).toEqual([]);
  });
});

describe('clearCellsUnderSolidObstacles', () => {
  /** 7 × 7 cells of 1 m, all green. */
  const COLUMNS = 7;
  function greenCells(): (GrassType | null)[] {
    return Array<GrassType | null>(COLUMNS * COLUMNS).fill('green');
  }

  it('turns into sand the cells whose center lies inside a rock, and leaves the cells around it', () => {
    const cells = greenCells();
    clearCellsUnderSolidObstacles(cells, 1, COLUMNS, [{ type: 'rock', x: 3.5, z: 3.5 }]);
    const centerInsideRock = (cell: number) =>
      Math.hypot((cell % COLUMNS) + 0.5 - 3.5, Math.floor(cell / COLUMNS) + 0.5 - 3.5) < obstacleRadius('rock');
    const expected = cells.flatMap((_, cell) => (centerInsideRock(cell) ? [cell] : []));
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(cells.length);
    expect(sandCells(cells)).toEqual(expected);
  });

  it('keeps the grass under fruit', () => {
    const cells = greenCells();
    clearCellsUnderSolidObstacles(cells, 1, COLUMNS, [
      { type: 'watermelon', x: 3.5, z: 3.5 },
      { type: 'strawberry', x: 1.5, z: 1.5 },
    ]);
    expect(sandCells(cells)).toEqual([]);
  });

  it('leaves the grass whose center lies exactly on the edge of a rock', () => {
    const cells = greenCells();
    const radius = obstacleRadius('rock');
    // Rock centered so that cell (3, 3)'s center is exactly `radius` to its east.
    clearCellsUnderSolidObstacles(cells, 1, COLUMNS, [{ type: 'rock', x: 3.5 - radius, z: 3.5 }]);
    expect(cells[3 * COLUMNS + 3]).toBe('green');
  });

  it('uses the cell size to find each cell center', () => {
    const cellSize = 2 * obstacleRadius('cactus');
    const cells = greenCells();
    // Center of cell (column 2, row 1) when cells are `cellSize` wide.
    clearCellsUnderSolidObstacles(cells, cellSize, COLUMNS, [{ type: 'cactus', x: 2.5 * cellSize, z: 1.5 * cellSize }]);
    expect(sandCells(cells)).toEqual([1 * COLUMNS + 2]);
  });

  it('works on fields that are not square', () => {
    const columns = 3;
    const cells = Array<GrassType | null>(columns * 5).fill('green');
    clearCellsUnderSolidObstacles(cells, 1, columns, [{ type: 'rock', x: 0.5, z: 4.5 }]);
    expect(sandCells(cells)).toContain(4 * columns + 0);
    expect(sandCells(cells)).not.toContain(0);
  });

  it('clears under every solid obstacle of the list', () => {
    const cells = greenCells();
    clearCellsUnderSolidObstacles(cells, 1, COLUMNS, [
      { type: 'rock', x: 0.5, z: 0.5 },
      { type: 'watermelon', x: 3.5, z: 3.5 },
      { type: 'cactus', x: 6.5, z: 6.5 },
    ]);
    expect(sandCells(cells)).toContain(0);
    expect(sandCells(cells)).toContain(COLUMNS * COLUMNS - 1);
    expect(sandCells(cells)).not.toContain(3 * COLUMNS + 3);
  });

  it('keeps sand as sand and leaves an empty list untouched', () => {
    const cells = greenCells();
    cells[0] = null;
    clearCellsUnderSolidObstacles(cells, 1, COLUMNS, []);
    expect(sandCells(cells)).toEqual([0]);
  });
});

describe('clearStart', () => {
  function greenCells(columns: number, rows: number): (GrassType | null)[] {
    return Array<GrassType | null>(columns * rows).fill('green');
  }

  it('turns into sand the cells whose center lies exactly meters / 2 from the field center', () => {
    // 3 × 3 cells of 1 m: the center cell and its four side neighbors are within 1 m; the corners are not.
    const cells = greenCells(3, 3);
    clearStart(cells, 1, 3, 3, 2);
    expect(sandCells(cells)).toEqual([1, 3, 4, 5, 7]);
  });

  it('uses the cell size to find the field center and each cell center', () => {
    // 3 × 3 cells of 2 m: only the center cell lies within 1 m of the field center.
    const cells = greenCells(3, 3);
    clearStart(cells, 2, 3, 3, 2);
    expect(sandCells(cells)).toEqual([4]);
  });

  it('finds the center of fields that are not square', () => {
    // 5 columns × 3 rows of 1 m: the center is cell (column 2, row 1), plus its four side neighbors.
    const cells = greenCells(5, 3);
    clearStart(cells, 1, 5, 3, 2);
    expect(sandCells(cells)).toEqual([2, 6, 7, 8, 12]);
  });
});

describe('isObstacleType', () => {
  it('is true for the obstacles a level can target', () => {
    expect(isObstacleType('cactus')).toBe(true);
    expect(isObstacleType('watermelon')).toBe(true);
    expect(isObstacleType('strawberry')).toBe(true);
  });

  it('is false for every grass type', () => {
    for (const grass of Object.keys(config.grassTypes) as GrassType[]) {
      expect(isObstacleType(grass), grass).toBe(false);
    }
  });
});

describe('sampleLevel', () => {
  const level = sampleLevel();
  const columns = columnCount(level);
  const cellUnder = (x: number, z: number) => level.cells[Math.floor(z / level.cellSize) * columns + Math.floor(x / level.cellSize)];
  const solid = level.obstacles.filter((obstacle) => obstacle.type === 'rock' || obstacle.type === 'cactus');

  it('covers a SAMPLE_LEVEL_SIDE square field with one cell per square meter', () => {
    expect(level.width).toBe(SAMPLE_LEVEL_SIDE);
    expect(level.depth).toBe(SAMPLE_LEVEL_SIDE);
    expect(level.cellSize).toBe(1);
    expect(level.cells).toHaveLength(columns * (level.depth / level.cellSize));
  });

  it('has no grass under its rocks and its cactus', () => {
    expect(solid.map(({ x, z }) => cellUnder(x, z))).toEqual(solid.map(() => null));
  });

  it('puts the fruit on green or ice', () => {
    const fruit = level.obstacles.filter((obstacle) => obstacle.type === 'watermelon' || obstacle.type === 'strawberry');
    expect(fruit.every(({ x, z }) => cellUnder(x, z) === 'green' || cellUnder(x, z) === 'ice')).toBe(true);
  });

  it('keeps the obstacles apart, so none overlaps another', () => {
    const { obstacles } = level;
    obstacles.forEach((a, i) =>
      obstacles.slice(i + 1).forEach((b) =>
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(obstacleRadius(a.type) + obstacleRadius(b.type)),
      ),
    );
  });

  const countOf = (type: ObstacleType) => level.obstacles.filter((obstacle) => obstacle.type === type).length;

  it('has 2 rocks, 1 cactus, 6 watermelons and 20 strawberries', () => {
    expect([countOf('rock'), countOf('cactus'), countOf('watermelon'), countOf('strawberry')]).toEqual([2, 1, 6, 20]);
  });

  it('repeats stripes of green, ice and wheat, stripeWidthMeters wide, from the west edge', () => {
    const order: GrassType[] = ['green', 'ice', 'wheat'];
    Array.from({ length: columns }, (_, column) => column).forEach((column) => {
      const expected = order[Math.floor((column * level.cellSize) / stripeWidthMeters) % order.length];
      const grass = columnTypes(level, column).filter((type) => type !== null);
      expect(new Set(grass), `column ${column}`).toEqual(new Set([expected]));
    });
  });

  it('puts every obstacle wholly inside the field', () => {
    for (const { type, x, z } of level.obstacles) {
      const radius = obstacleRadius(type);
      expect(x - radius, `${type} at ${x},${z}`).toBeGreaterThanOrEqual(0);
      expect(z - radius, `${type} at ${x},${z}`).toBeGreaterThanOrEqual(0);
      expect(x + radius, `${type} at ${x},${z}`).toBeLessThanOrEqual(level.width);
      expect(z + radius, `${type} at ${x},${z}`).toBeLessThanOrEqual(level.depth);
    }
  });

  it('keeps the rocks and the cactus away from the center, where the blade starts', () => {
    for (const { type, x, z } of solid) {
      const reach = obstacleRadius(type) + stripeWidthMeters;
      expect(Math.hypot(x - level.width / 2, z - level.depth / 2), `${type} at ${x},${z}`).toBeGreaterThan(reach);
    }
  });

  it('only turns into sand the cells under the rocks and the cactus, and the start clearing', () => {
    level.cells.forEach((type, cell) => {
      const centerX = ((cell % columns) + 0.5) * level.cellSize;
      const centerZ = (Math.floor(cell / columns) + 0.5) * level.cellSize;
      const underSolid = solid.some(({ type: kind, x, z }) => Math.hypot(centerX - x, centerZ - z) < obstacleRadius(kind));
      const inClearing = Math.hypot(centerX - level.width / 2, centerZ - level.depth / 2) <= SAMPLE_START_CLEARING_METERS / 2;
      expect(type === null, `cell ${cell}`).toBe(underSolid || inClearing);
    });
  });

  it('starts the blade on sand, clear of every wall', () => {
    const radius = bladeRadius(config.blade.startSize);
    const center = { x: level.width / 2, z: level.depth / 2 };
    for (const dx of [-radius, 0, radius]) {
      for (const dz of [-radius, 0, radius]) expect(cellUnder(center.x + dx * 0.99, center.z + dz * 0.99)).toBeNull();
    }
  });

  it('builds a fresh level on every call, so clearing cells in one does not touch another', () => {
    const other = sampleLevel();
    expect(other.cells).not.toBe(level.cells);
    expect(other.obstacles).not.toBe(level.obstacles);
    expect(other.cells).toEqual(level.cells);
  });

  it('is a hand-made level seeded with the configured field seed', () => {
    expect(level.number).toBe(0);
    expect(level.seed).toBe(config.field.seed);
  });

  it('targets ice and strawberries with the configured time', () => {
    expect(level.targets).toEqual(['ice', 'strawberry']);
    expect(level.timeSeconds).toBe(config.level.timeSeconds);
  });
});
