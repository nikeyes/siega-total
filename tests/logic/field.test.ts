import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createRandom } from '../../src/logic/random';
import {
  createField,
  cutInCircle,
  GRASS_TYPE_ORDER,
  levelFieldOptions,
  type Field,
  type FieldOptions,
  type GrassType,
} from '../../src/logic/field';
import type { LevelDefinition } from '../../src/logic/levels';

const SMALL_WIDTH = 6;
const SMALL_DEPTH = 4;

/** Cells of `cellSize` covering a field of `width` × `depth`, all of one grass type. */
function uniformCells(type: GrassType, width = SMALL_WIDTH, depth = SMALL_DEPTH, cellSize = 1): GrassType[] {
  return new Array<GrassType>(Math.ceil(width / cellSize) * Math.ceil(depth / cellSize)).fill(type);
}

function createSmallField(overrides: Partial<FieldOptions> = {}) {
  return createField({
    width: SMALL_WIDTH,
    depth: SMALL_DEPTH,
    cellSize: 1,
    cells: uniformCells('green'),
    bladeCount: 200,
    gridCellSize: config.field.gridCellSize,
    seed: config.field.seed,
    ...overrides,
  });
}

/** 3 × 2 cells of 2 m: green, ice and sand in the first row, sand, wheat and green in the second. */
const MIXED_CELLS: (GrassType | null)[] = ['green', 'ice', null, null, 'wheat', 'green'];
const MIXED_CELL_SIZE = 2;

function createMixedField(bladeCount = 200) {
  return createSmallField({ cellSize: MIXED_CELL_SIZE, cells: MIXED_CELLS, bladeCount });
}

function cellOf(field: Field, blade: number, cellSize: number): number {
  const columns = Math.ceil(field.width / cellSize);
  return Math.floor(field.positionsZ[blade]! / cellSize) * columns + Math.floor(field.positionsX[blade]! / cellSize);
}

/** A small all-green level; only the fields under test need overriding. */
function smallLevel(overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    number: 1,
    seed: config.field.seed,
    width: SMALL_WIDTH,
    depth: SMALL_DEPTH,
    cellSize: 1,
    cells: uniformCells('green'),
    obstacles: [],
    targets: ['green'],
    timeSeconds: 10,
    ...overrides,
  };
}

describe('levelFieldOptions', () => {
  it('takes the layout and seed from the level, and the blade count and grid from the configuration', () => {
    const cells: (GrassType | null)[] = ['ice', null];
    const level = smallLevel({ seed: 777, width: 4, depth: 2, cellSize: 2, cells });
    const { bladeCount, gridCellSize } = config.field;
    expect(levelFieldOptions(level)).toEqual({ width: 4, depth: 2, cellSize: 2, cells, bladeCount, gridCellSize, seed: 777 });
  });

  it('keeps a level seed of 0 instead of falling back to the configured seed', () => {
    expect(levelFieldOptions(smallLevel({ seed: 0 })).seed).toBe(0);
  });

  describe('with levels that differ only in seed', () => {
    const levelWithSeed = (seed: number) => smallLevel({ seed });

    it('places the blades differently', () => {
      const first = createField(levelFieldOptions(levelWithSeed(1)));
      const second = createField(levelFieldOptions(levelWithSeed(2)));
      expect([...second.positionsX]).not.toEqual([...first.positionsX]);
    });

    it('places the blades at the same positions for the same level seed', () => {
      const first = createField(levelFieldOptions(levelWithSeed(42)));
      const second = createField(levelFieldOptions(levelWithSeed(42)));
      expect([...second.positionsX]).toEqual([...first.positionsX]);
      expect([...second.positionsZ]).toEqual([...first.positionsZ]);
    });
  });
});

describe('createField', () => {
  it('places blades at the same positions for the same seed', () => {
    const first = createSmallField();
    const second = createSmallField();
    expect(second.positionsX).toEqual(first.positionsX);
    expect(second.positionsZ).toEqual(first.positionsZ);
  });

  it('gives every blade the grass type of the cell it stands in', () => {
    const field = createMixedField();
    for (let blade = 0; blade < field.bladeCount; blade++) {
      const cellType = MIXED_CELLS[cellOf(field, blade, MIXED_CELL_SIZE)];
      expect(GRASS_TYPE_ORDER[field.types[blade]!], `blade ${blade}`).toBe(cellType);
    }
  });

  it('places no blade on sand', () => {
    const field = createMixedField();
    const onSand = Array.from(field.types.keys()).filter((blade) => MIXED_CELLS[cellOf(field, blade, MIXED_CELL_SIZE)] === null);
    expect(onSand).toEqual([]);
  });

  it('gives every grass cell the same number of blades, give or take one', () => {
    const field = createMixedField(201);
    const bladesPerCell = new Map<number, number>();
    for (let blade = 0; blade < field.bladeCount; blade++) {
      const cell = cellOf(field, blade, MIXED_CELL_SIZE);
      bladesPerCell.set(cell, (bladesPerCell.get(cell) ?? 0) + 1);
    }
    expect([...bladesPerCell.values()].sort()).toEqual([50, 50, 50, 51]);
  });

  it('counts the blades of each type', () => {
    const field = createMixedField(200);
    const countByName = Object.fromEntries(GRASS_TYPE_ORDER.map((type, index) => [type, field.countByType[index]]));
    expect(countByName).toEqual({ green: 100, ice: 50, wheat: 50, lavender: 0, bramble: 0 });
  });

  it('places every blade inside the field', () => {
    const { width, depth } = config.field;
    const field = createField({ ...config.field, cellSize: 1, cells: uniformCells('green', width, depth) });
    const inside = (value: number, limit: number) => value >= 0 && value < limit;
    expect(field.positionsX.every((x) => inside(x, field.width))).toBe(true);
    expect(field.positionsZ.every((z) => inside(z, field.depth))).toBe(true);
  });

  it('keeps a blade inside the field when its random position rounds up to the edge in 32-bit floats', () => {
    // With this seed, the first random value is 0.99999999511…, and 0.99999999511… * 30 rounds to 30 as a Float32.
    const seedWhoseFirstValueRoundsToTheEdge = 52_078_625;
    const field = createSmallField({
      width: 30,
      depth: 30,
      cellSize: 30,
      cells: ['green'],
      bladeCount: 1,
      seed: seedWhoseFirstValueRoundsToTheEdge,
    });
    expect(field.positionsX[0]).toBeLessThan(field.width);
  });

  it('keeps the blades of cells cut short by the field edge inside the field', () => {
    const field = createSmallField({ width: 5, depth: 3, cellSize: 2, cells: uniformCells('green', 5, 3, 2), bladeCount: 600 });
    expect(Math.max(...field.positionsX)).toBeLessThan(field.width);
    expect(Math.max(...field.positionsZ)).toBeLessThan(field.depth);
  });

  it('fills the grass cells in order when there are fewer blades than grass cells', () => {
    const field = createSmallField({ width: 2, depth: 2, cells: ['ice', null, 'green', 'wheat'], bladeCount: 2 });
    expect([...field.types].map((type) => GRASS_TYPE_ORDER[type])).toEqual(['ice', 'green']);
  });

  it('creates an empty field with zero blades', () => {
    const field = createMixedField(0);
    expect(field.bladeCount).toBe(0);
    expect([...field.countByType].every((count) => count === 0)).toBe(true);
  });

  describe('on a field that is all sand', () => {
    const allSand = () => createSmallField({ width: 2, depth: 2, cells: [null, null, null, null], bladeCount: 10 });

    it('places no blades even when blades are requested', () => {
      expect(allSand().bladeCount).toBe(0);
    });

    it('has empty blade arrays and counts', () => {
      const field = allSand();
      expect([field.positionsX.length, field.positionsZ.length, field.types.length, field.cut.length]).toEqual([0, 0, 0, 0]);
      expect([...field.countByType].every((count) => count === 0)).toBe(true);
      expect(field.cutCount).toBe(0);
    });

    it('has a spatial grid with no blades in any cell', () => {
      const { grid } = allSand();
      expect(grid.cellBlades.length).toBe(0);
      expect([...grid.cellStart].every((start) => start === 0)).toBe(true);
    });

    it('cuts nothing with a circle covering the whole field', () => {
      const field = allSand();
      expect(cutInCircle(field, 1, 1, 10, Infinity)).toEqual([]);
      expect(field.cutCount).toBe(0);
    });
  });

  it('places no blades on a field with no cells at all', () => {
    const field = createSmallField({ cells: [], bladeCount: 10 });
    expect(field.bladeCount).toBe(0);
  });

  it('places blades on a field with a single grass cell among sand', () => {
    const field = createSmallField({ width: 2, depth: 2, cells: [null, null, null, 'bramble'], bladeCount: 5 });
    expect(field.bladeCount).toBe(5);
    expect(field.countByType[GRASS_TYPE_ORDER.indexOf('bramble')]).toBe(5);
  });
});

const greenMinSize = config.grassTypes.green.minSize;

function standingBladesWithin(field: Field, centerX: number, centerZ: number, radius: number): number[] {
  const found: number[] = [];
  for (let blade = 0; blade < field.bladeCount; blade++) {
    const distance = Math.hypot(field.positionsX[blade]! - centerX, field.positionsZ[blade]! - centerZ);
    if (field.cut[blade] === 0 && distance <= radius) found.push(blade);
  }
  return found;
}

function sorted(indices: number[]): number[] {
  return [...indices].sort((a, b) => a - b);
}

/** Cuts 200 seeded random circles (some overlapping the field edges) and compares each cut with a brute-force search. */
function expectCutsToMatchBruteForce(field: Field, maxRadius: number): void {
  const random = createRandom(config.field.seed);
  for (let circle = 0; circle < 200; circle++) {
    const centerX = random() * (field.width + 2) - 1;
    const centerZ = random() * (field.depth + 2) - 1;
    const radius = random() * maxRadius;
    const expected = standingBladesWithin(field, centerX, centerZ, radius);
    const circleDescription = `circle ${circle} at (${centerX}, ${centerZ}) with radius ${radius}`;
    expect(sorted(cutInCircle(field, centerX, centerZ, radius, greenMinSize)), circleDescription).toEqual(expected);
  }
}

describe('cutInCircle', () => {
  it('cuts a blade inside the radius', () => {
    const field = createSmallField({ bladeCount: 1 });
    const x = field.positionsX[0]!;
    const z = field.positionsZ[0]!;
    expect(cutInCircle(field, x + 0.1, z, 0.5, greenMinSize)).toEqual([0]);
    expect(field.cut[0]).toBe(1);
    expect(field.cutCount).toBe(1);
  });

  it('does not cut a blade outside the radius', () => {
    const field = createSmallField({ bladeCount: 1 });
    const x = field.positionsX[0]!;
    const z = field.positionsZ[0]!;
    expect(cutInCircle(field, x + 0.6, z, 0.5, greenMinSize)).toEqual([]);
    expect(field.cut[0]).toBe(0);
    expect(field.cutCount).toBe(0);
  });

  it('cuts a blade exactly at the radius distance', () => {
    const field = createSmallField({ bladeCount: 1 });
    const radius = 0.25;
    const centerX = field.positionsX[0]! - radius;
    expect(cutInCircle(field, centerX, field.positionsZ[0]!, radius, greenMinSize)).toEqual([0]);
  });

  describe('when the debug panel tunes a minimum size', () => {
    const originalGrassTypes = structuredClone(config.grassTypes);
    const originalGreenMinSize = originalGrassTypes.green.minSize;
    const originalBrambleMinSize = originalGrassTypes.bramble.minSize;
    afterEach(() => {
      // config is shared by every test: put back the whole table, whatever a test changed.
      for (const type of GRASS_TYPE_ORDER) Object.assign(config.grassTypes[type], originalGrassTypes[type]);
    });

    it('lets a small blade cut tough grass once its minimum size is lowered', () => {
      const field = createSmallField({ bladeCount: 1, cells: uniformCells('bramble') });
      config.grassTypes.bramble.minSize = 1;
      expect(cutInCircle(field, field.positionsX[0]!, field.positionsZ[0]!, 0.5, 1)).toEqual([0]);
    });

    it('leaves the other grass types as they were', () => {
      const field = createSmallField({ bladeCount: 1 });
      config.grassTypes.bramble.minSize = originalBrambleMinSize + 10;
      expect(cutInCircle(field, field.positionsX[0]!, field.positionsZ[0]!, 0.5, originalGreenMinSize)).toEqual([0]);
    });

    it('uses the new minimum size on the next cut', () => {
      const field = createSmallField({ bladeCount: 1 });
      const x = field.positionsX[0]!;
      const z = field.positionsZ[0]!;
      config.grassTypes.green.minSize = originalGreenMinSize + 1;
      expect(cutInCircle(field, x, z, 0.5, originalGreenMinSize)).toEqual([]);
      expect(cutInCircle(field, x, z, 0.5, originalGreenMinSize + 1)).toEqual([0]);
    });
  });

  it.each(Object.keys(config.grassTypes) as GrassType[])('cuts %s only when the blade size reaches its minimum size', (grassType) => {
    const minSize = config.grassTypes[grassType].minSize;
    const field = createSmallField({ bladeCount: 1, cells: uniformCells(grassType) });
    const x = field.positionsX[0]!;
    const z = field.positionsZ[0]!;
    expect(cutInCircle(field, x, z, 0.5, minSize - 1)).toEqual([]);
    expect(cutInCircle(field, x, z, 0.5, minSize)).toEqual([0]);
  });

  it('does not return or count an already cut blade again', () => {
    const field = createSmallField({ bladeCount: 1 });
    const x = field.positionsX[0]!;
    const z = field.positionsZ[0]!;
    cutInCircle(field, x, z, 0.5, greenMinSize);
    expect(cutInCircle(field, x, z, 0.5, greenMinSize)).toEqual([]);
    expect(field.cutCount).toBe(1);
  });

  it('cuts only the blades inside a circle that extends past the field corner', () => {
    const field = createSmallField();
    const radius = 1.5;
    const expected = standingBladesWithin(field, 0, 0, radius);
    expect(expected.length).toBeGreaterThan(0);
    expect(sorted(cutInCircle(field, 0, 0, radius, greenMinSize))).toEqual(expected);
  });

  it('cuts nothing with a circle entirely outside the field', () => {
    const field = createSmallField();
    expect(cutInCircle(field, -10, -10, 1.5, greenMinSize)).toEqual([]);
    expect(field.cutCount).toBe(0);
  });

  it('matches a brute-force search for random circles', () => {
    expectCutsToMatchBruteForce(createSmallField({ bladeCount: 2_000 }), 2);
  });

  it('matches a brute-force search when the cell size does not divide the field', () => {
    const field = createSmallField({
      width: 5.5,
      depth: 3.3,
      cells: uniformCells('green', 5.5, 3.3),
      bladeCount: 2_000,
      gridCellSize: 0.7,
    });
    expectCutsToMatchBruteForce(field, 1.5);
  });

  it('cuts every blade once with a circle covering the whole field', () => {
    const field = createSmallField();
    const radius = Math.hypot(field.width, field.depth);
    const centerX = field.width / 2;
    const centerZ = field.depth / 2;
    cutInCircle(field, centerX, centerZ, radius, greenMinSize);
    expect(field.cutCount).toBe(field.bladeCount);
    cutInCircle(field, centerX, centerZ, radius, greenMinSize);
    expect(field.cutCount).toBe(field.bladeCount);
  });

  it('counts each cut blade under its own type only', () => {
    const field = createMixedField();
    const firstIce = field.types.indexOf(GRASS_TYPE_ORDER.indexOf('ice'));
    cutInCircle(field, field.positionsX[firstIce]!, field.positionsZ[firstIce]!, 0, config.grassTypes.ice.minSize);
    const expected = GRASS_TYPE_ORDER.map((type) => (type === 'ice' ? 1 : 0));
    expect([...field.cutByType]).toEqual(expected);
  });

  it('cuts every blade of every type with an infinite blade size and a circle covering the whole field', () => {
    const field = createMixedField();
    cutInCircle(field, field.width / 2, field.depth / 2, Math.hypot(field.width, field.depth), Infinity);
    expect(field.cutCount).toBe(field.bladeCount);
    expect([...field.cutByType]).toEqual([...field.countByType]);
  });
});
