export const SAND_REGION = -1;

export interface RegionMap {
  readonly columns: number;
  readonly rows: number;
  /** Row by row; SAND_REGION or 0..regionCount-1. */
  readonly regions: Int8Array;
  readonly regionCount: number;
}

export interface PatternParams {
  columns: number;
  rows: number;
  /** How many grass regions the level wants (1 to 4). */
  regionCount: number;
}

export type PatternName = 'stripes' | 'checkerboard' | 'circles' | 'spiral' | 'windingPath' | 'soccerField' | 'islands';

type Pattern = (random: () => number, params: PatternParams) => RegionMap;

/** Splits the field into regions; the generator later gives each region a grass type. */
export const PATTERNS: Record<PatternName, Pattern> = {
  stripes,
  checkerboard,
  circles,
  spiral,
  windingPath,
  soccerField,
  islands,
};

/** Vertical or horizontal stripes from 2 to 5 cells wide, cycling through the regions. */
function stripes(random: () => number, params: PatternParams): RegionMap {
  const vertical = random() < 0.5;
  const width = randomInt(random, 2, 5);
  return mapFrom(params, (column, row) => Math.floor((vertical ? column : row) / width) % params.regionCount);
}

/** Square tiles from 3 to 6 cells wide; neighboring tiles never share a region. */
function checkerboard(random: () => number, params: PatternParams): RegionMap {
  const side = randomInt(random, 3, 6);
  return mapFrom(params, (column, row) => (Math.floor(column / side) + Math.floor(row / side)) % params.regionCount);
}

/** Rings from 2 to 4 cells wide around a center in the middle third of the field. */
function circles(random: () => number, params: PatternParams): RegionMap {
  const { x, z } = centerInMiddleThird(random, params);
  const width = randomInt(random, 2, 4);
  return mapFrom(params, (column, row) => Math.floor(distanceFromCellCenter(column, row, x, z) / width) % params.regionCount);
}

/** Archimedean spiral arms around the field center, one per region, 4 to 7 cells wide, either way round. */
function spiral(random: () => number, params: PatternParams): RegionMap {
  const pitch = randomInt(random, 4, 7);
  const turn = random() < 0.5 ? 1 : -1;
  const x = params.columns / 2;
  const z = params.rows / 2;
  return mapFrom(params, (column, row) => {
    const angle = Math.atan2(row + 0.5 - z, column + 0.5 - x) * turn;
    // One arm per region: the angle term then jumps by regionCount at the ±π seam, which leaves the region unchanged.
    const band = Math.floor((angle / (2 * Math.PI)) * params.regionCount + distanceFromCellCenter(column, row, x, z) / pitch);
    return positiveModulo(band, params.regionCount);
  });
}

/** Half the width of a winding path, in cells: paths are 3 cells wide. */
const PATH_HALF_WIDTH = 1.5;

/**
 * Region 0 with sine-wave paths of the other regions crossing it from west to east,
 * each in its own horizontal band so no path cuts another.
 */
function windingPath(random: () => number, params: PatternParams): RegionMap {
  const { columns, rows, regionCount } = params;
  const regions = new Int8Array(columns * rows);
  const pathCount = regionCount - 1;
  for (let path = 0; path < pathCount; path++) {
    const bandHeight = rows / pathCount;
    const middle = bandHeight * (path + 0.5);
    const amplitude = random() * Math.max(0, bandHeight / 2 - PATH_HALF_WIDTH - 1);
    const frequency = ((1 + random() * 2) * 2 * Math.PI) / columns;
    const phase = random() * 2 * Math.PI;
    const centerAt = (column: number) => middle + amplitude * Math.sin(frequency * (column + 0.5) + phase);
    for (let column = 0; column < columns; column++) {
      // Spanning from the previous column's center keeps the path connected on steep stretches.
      const previous = centerAt(column > 0 ? column - 1 : column);
      const top = Math.min(previous, centerAt(column)) - PATH_HALF_WIDTH;
      const bottom = Math.max(previous, centerAt(column)) + PATH_HALF_WIDTH;
      for (let row = 0; row < rows; row++) {
        if (row + 0.5 >= top && row + 0.5 <= bottom) regions[row * columns + column] = path + 1;
      }
    }
  }
  return { columns, rows, regions, regionCount };
}

/**
 * Horizontal stripes 2 or 3 cells wide, with the lines of a soccer field in sand:
 * the border, the halfway line, the center circle and both penalty areas.
 */
function soccerField(random: () => number, params: PatternParams): RegionMap {
  const { columns, rows } = params;
  const stripeWidth = randomInt(random, 2, 3);
  const circleRadius = Math.min(columns, rows) / 6;
  const areaDepth = Math.round(columns / 6);
  // Each area spans 2/5 of the field height, between two rows mirrored about the middle.
  const areaTopRow = Math.round(rows / 2 - rows / 5);
  const areaBottomRow = rows - 1 - areaTopRow;
  const isLine = (column: number, row: number): boolean => {
    const fromGoal = Math.min(column, columns - 1 - column);
    const border = fromGoal === 0 || row === 0 || row === rows - 1;
    const halfway = Math.abs(column + 0.5 - columns / 2) <= 0.5;
    const centerCircle = Math.abs(distanceFromCellCenter(column, row, columns / 2, rows / 2) - circleRadius) <= 0.5;
    const areaFront = fromGoal === areaDepth && row >= areaTopRow && row <= areaBottomRow;
    const areaSides = fromGoal <= areaDepth && (row === areaTopRow || row === areaBottomRow);
    return border || halfway || centerCircle || areaFront || areaSides;
  };
  return mapFrom(params, (column, row) =>
    isLine(column, row) ? SAND_REGION : Math.floor(row / stripeWidth) % params.regionCount,
  );
}

const MIN_ISLANDS = 4;
const MAX_ISLANDS = 8;
const MIN_ISLAND_RADIUS = 2;
const MAX_ISLAND_RADIUS = 5;
/** On a smaller field the islands shrink: their radius is at most this share of the shorter side. */
const MAX_ISLAND_RADIUS_SHARE = 1 / 5;
/** Cells of region 0 kept between two islands, so they never touch. */
const ISLAND_GAP = 2;
const ISLAND_PLACEMENT_TRIES = 50;

/** Region 0 with 4 to 8 round islands, 2 to 5 cells in radius (smaller on a small field), of the other regions in turn. */
function islands(random: () => number, params: PatternParams): RegionMap {
  const { columns, rows, regionCount } = params;
  const maxRadius = Math.max(MIN_ISLAND_RADIUS, Math.min(MAX_ISLAND_RADIUS, Math.floor(Math.min(columns, rows) * MAX_ISLAND_RADIUS_SHARE)));
  const placed: { x: number; z: number; radius: number }[] = [];
  const islandCount = randomInt(random, MIN_ISLANDS, MAX_ISLANDS);
  for (let island = 0; island < islandCount; island++) {
    for (let attempt = 0; attempt < ISLAND_PLACEMENT_TRIES; attempt++) {
      // A new radius on each try lets a smaller island fit where a big one does not.
      const radius = randomInt(random, MIN_ISLAND_RADIUS, maxRadius);
      const x = randomInt(random, radius, columns - 1 - radius) + 0.5;
      const z = randomInt(random, radius, rows - 1 - radius) + 0.5;
      const apart = placed.every((other) => Math.hypot(other.x - x, other.z - z) >= other.radius + radius + ISLAND_GAP);
      if (!apart) continue;
      placed.push({ x, z, radius });
      break;
    }
  }
  const islandRegion = (index: number) => (regionCount > 1 ? 1 + (index % (regionCount - 1)) : 0);
  return mapFrom(params, (column, row) => {
    const index = placed.findIndex(({ x, z, radius }) => distanceFromCellCenter(column, row, x, z) <= radius);
    return index === -1 ? 0 : islandRegion(index);
  });
}

/** A point in the middle third, on a cell center or corner so the rings stay symmetric on the grid. */
function centerInMiddleThird(random: () => number, { columns, rows }: PatternParams): { x: number; z: number } {
  const toHalfCell = (value: number) => Math.round(value * 2) / 2;
  return { x: toHalfCell(columns / 3 + random() * (columns / 3)), z: toHalfCell(rows / 3 + random() * (rows / 3)) };
}

function distanceFromCellCenter(column: number, row: number, x: number, z: number): number {
  return Math.hypot(column + 0.5 - x, row + 0.5 - z);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** A whole number from `min` to `max`, both included. */
function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function mapFrom(params: PatternParams, regionAt: (column: number, row: number) => number): RegionMap {
  const { columns, rows, regionCount } = params;
  const regions = new Int8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) regions[row * columns + column] = regionAt(column, row);
  }
  return { columns, rows, regions, regionCount };
}
