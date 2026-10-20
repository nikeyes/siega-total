import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createRandom } from '../../src/logic/random';
import { createField, cutInCircle, type Field, type GrassType, type FieldOptions } from '../../src/logic/field';

function createSmallField(overrides: Partial<FieldOptions> = {}) {
  return createField({
    width: 6,
    depth: 4,
    bladeCount: 200,
    gridCellSize: config.field.gridCellSize,
    seed: config.field.seed,
    grassType: 'green',
    ...overrides,
  });
}

describe('createField', () => {
  it('places blades at the same positions for the same seed', () => {
    const first = createSmallField();
    const second = createSmallField();
    expect(second.positionsX).toEqual(first.positionsX);
    expect(second.positionsZ).toEqual(first.positionsZ);
  });

  it('places every blade inside the field', () => {
    const field = createField({ ...config.field, grassType: 'green' });
    const inside = (value: number, limit: number) => value >= 0 && value < limit;
    expect(field.positionsX.every((x) => inside(x, field.width))).toBe(true);
    expect(field.positionsZ.every((z) => inside(z, field.depth))).toBe(true);
  });

  it('keeps a blade inside the field when its random position rounds up to the edge in 32-bit floats', () => {
    // With this seed, the first random value is 0.99999999511…, and 0.99999999511… * 30 rounds to 30 as a Float32.
    const seedWhoseFirstValueRoundsToTheEdge = 52_078_625;
    const field = createSmallField({ width: 30, depth: 30, bladeCount: 1, seed: seedWhoseFirstValueRoundsToTheEdge });
    expect(field.positionsX[0]).toBeLessThan(field.width);
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

  it.each(Object.keys(config.grassTypes) as GrassType[])('cuts %s only when the blade size reaches its minimum size', (grassType) => {
    const minSize = config.grassTypes[grassType].minSize;
    const field = createSmallField({ bladeCount: 1, grassType });
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
    expectCutsToMatchBruteForce(createSmallField({ width: 5.5, depth: 3.3, bladeCount: 2_000, gridCellSize: 0.7 }), 1.5);
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
});
