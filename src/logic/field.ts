import { config } from '../config';
import { createRandom } from './random';

export type GrassType = keyof typeof config.grassTypes;

export const GRASS_TYPE_ORDER: readonly GrassType[] = ['green', 'ice', 'wheat', 'lavender', 'bramble'];

const MIN_SIZE_BY_TYPE = GRASS_TYPE_ORDER.map((type) => config.grassTypes[type].minSize);

export interface FieldOptions {
  width: number;
  depth: number;
  bladeCount: number;
  gridCellSize: number;
  seed: number;
  grassType: GrassType;
}

/**
 * Uniform grid in CSR format: the blades of cell `c` are
 * `cellBlades[cellStart[c]]` up to (not including) `cellBlades[cellStart[c + 1]]`.
 * Cells are numbered row by row: `c = row * columns + column`.
 */
export interface SpatialGrid {
  readonly cellSize: number;
  readonly columns: number;
  readonly rows: number;
  readonly cellStart: Int32Array;
  readonly cellBlades: Int32Array;
}

export interface Field {
  readonly width: number;
  readonly depth: number;
  readonly bladeCount: number;
  readonly positionsX: Float32Array;
  readonly positionsZ: Float32Array;
  /** Index into GRASS_TYPE_ORDER. */
  readonly types: Uint8Array;
  /** 0 = standing, 1 = cut. */
  readonly cut: Uint8Array;
  readonly grid: SpatialGrid;
  cutCount: number;
}

export function createField(options: FieldOptions): Field {
  const { width, depth, bladeCount, gridCellSize, seed, grassType } = options;
  const random = createRandom(seed);
  const positionsX = new Float32Array(bladeCount);
  const positionsZ = new Float32Array(bladeCount);
  for (let blade = 0; blade < bladeCount; blade++) {
    positionsX[blade] = randomFloat32Below(random, width);
    positionsZ[blade] = randomFloat32Below(random, depth);
  }
  return {
    width,
    depth,
    bladeCount,
    positionsX,
    positionsZ,
    types: new Uint8Array(bladeCount).fill(GRASS_TYPE_ORDER.indexOf(grassType)),
    cut: new Uint8Array(bladeCount),
    grid: buildSpatialGrid(positionsX, positionsZ, width, depth, gridCellSize),
    cutCount: 0,
  };
}

/**
 * A random value in [0, limit) that stays below `limit` after rounding to a 32-bit float.
 * Values close to `limit` would otherwise round up to `limit` itself.
 */
function randomFloat32Below(random: () => number, limit: number): number {
  const value = Math.fround(random() * limit);
  return value < limit ? value : previousFloat32(value);
}

/** The 32-bit float just below a positive `value`. */
function previousFloat32(value: number): number {
  const float = new Float32Array([value]);
  new Uint32Array(float.buffer)[0]!--;
  return float[0]!;
}

function buildSpatialGrid(
  positionsX: Float32Array,
  positionsZ: Float32Array,
  width: number,
  depth: number,
  cellSize: number,
): SpatialGrid {
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(depth / cellSize);
  const bladeCount = positionsX.length;

  const bladeCell = new Int32Array(bladeCount);
  const cellStart = new Int32Array(columns * rows + 1);
  for (let blade = 0; blade < bladeCount; blade++) {
    const column = Math.floor(positionsX[blade]! / cellSize);
    const row = Math.floor(positionsZ[blade]! / cellSize);
    const cell = row * columns + column;
    bladeCell[blade] = cell;
    cellStart[cell + 1]!++;
  }
  for (let cell = 0; cell < columns * rows; cell++) {
    cellStart[cell + 1]! += cellStart[cell]!;
  }

  const cellBlades = new Int32Array(bladeCount);
  const nextSlot = cellStart.slice(0, columns * rows);
  for (let blade = 0; blade < bladeCount; blade++) {
    const cell = bladeCell[blade]!;
    cellBlades[nextSlot[cell]!++] = blade;
  }

  return { cellSize, columns, rows, cellStart, cellBlades };
}

export function cutInCircle(
  field: Field,
  centerX: number,
  centerZ: number,
  radius: number,
  bladeSize: number,
): number[] {
  const { grid } = field;
  const newlyCut: number[] = [];
  const firstColumn = Math.max(0, Math.floor((centerX - radius) / grid.cellSize));
  const lastColumn = Math.min(grid.columns - 1, Math.floor((centerX + radius) / grid.cellSize));
  const firstRow = Math.max(0, Math.floor((centerZ - radius) / grid.cellSize));
  const lastRow = Math.min(grid.rows - 1, Math.floor((centerZ + radius) / grid.cellSize));
  const radiusSquared = radius * radius;

  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const cell = row * grid.columns + column;
      for (let slot = grid.cellStart[cell]!; slot < grid.cellStart[cell + 1]!; slot++) {
        const blade = grid.cellBlades[slot]!;
        if (field.cut[blade] === 1) continue;
        if (MIN_SIZE_BY_TYPE[field.types[blade]!]! > bladeSize) continue;
        const dx = field.positionsX[blade]! - centerX;
        const dz = field.positionsZ[blade]! - centerZ;
        if (dx * dx + dz * dz <= radiusSquared) {
          field.cut[blade] = 1;
          field.cutCount++;
          newlyCut.push(blade);
        }
      }
    }
  }
  return newlyCut;
}
