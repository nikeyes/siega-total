import { config } from '../config';
import type { GrassType } from './field';
import { obstacleRadius } from './obstacles';

export type ObstacleType = keyof typeof config.obstacles;

/** Anything a level can ask the player to clear. */
export type TargetKind = GrassType | Exclude<ObstacleType, 'rock'>;

export interface Obstacle {
  type: ObstacleType;
  x: number;
  z: number;
}

export interface LevelDefinition {
  /** 1-based position in the progression; 0 for hand-made levels. */
  number: number;
  /** Also places the blades of the field. */
  seed: number;
  width: number;
  depth: number;
  /** Side of each square cell, in meters. */
  cellSize: number;
  /** Row by row (`cell = row * columns + column`); null = sand, no grass. */
  cells: readonly (GrassType | null)[];
  obstacles: readonly Obstacle[];
  /** Everything to clear to win; at least one. */
  targets: readonly TargetKind[];
  /** Not readonly: the debug panel tunes it, and resetGame reads it. */
  timeSeconds: number;
}

export function isObstacleType(kind: TargetKind): kind is Exclude<ObstacleType, 'rock'> {
  return kind in config.obstacles;
}

/**
 * Cells this close to a rock or cactus are cleared too: a blade right against it lies exactly where the blade's
 * circle stops, and rounding can leave it standing forever.
 */
const SOLID_CLEARANCE_METERS = 0.1;

/** Turns into sand every cell a rock or a cactus covers or touches, even in part, so no grass grows where the blade cannot reach. */
export function clearCellsUnderSolidObstacles(
  cells: (GrassType | null)[],
  cellSize: number,
  columns: number,
  obstacles: readonly Obstacle[],
): void {
  for (const { type, x, z } of obstacles) {
    if (type !== 'rock' && type !== 'cactus') continue;
    cells.forEach((_, cell) => {
      const left = (cell % columns) * cellSize;
      const top = Math.floor(cell / columns) * cellSize;
      // The cell's nearest point to the obstacle: any of its grass closer than the radius would sit under it.
      const nearestX = Math.min(Math.max(x, left), left + cellSize);
      const nearestZ = Math.min(Math.max(z, top), top + cellSize);
      if (Math.hypot(nearestX - x, nearestZ - z) < obstacleRadius(type) + SOLID_CLEARANCE_METERS) cells[cell] = null;
    });
  }
}

/** Turns into sand every cell whose center lies within `meters / 2` of the field center, where the blade starts. */
export function clearStart(cells: (GrassType | null)[], cellSize: number, columns: number, rows: number, meters: number): void {
  const centerX = (columns * cellSize) / 2;
  const centerZ = (rows * cellSize) / 2;
  cells.forEach((_, cell) => {
    const cellX = ((cell % columns) + 0.5) * cellSize;
    const cellZ = (Math.floor(cell / columns) + 0.5) * cellSize;
    if (Math.hypot(cellX - centerX, cellZ - centerZ) <= meters / 2) cells[cell] = null;
  });
}

/** Vertical stripes of green and ice across the configured field; ice is the target. */
export function stripesLevel(): LevelDefinition {
  const { width, depth } = config.field;
  const cellSize = 1;
  const columns = width / cellSize;
  const rows = depth / cellSize;
  const columnsPerStripe = config.level.stripeWidthMeters / cellSize;
  const stripeTypeOfCell = (cell: number): GrassType =>
    Math.floor((cell % columns) / columnsPerStripe) % 2 === 0 ? 'green' : 'ice';
  return {
    number: 0,
    seed: config.field.seed,
    width,
    depth,
    cellSize,
    cells: Array.from({ length: columns * rows }, (_, cell) => stripeTypeOfCell(cell)),
    obstacles: [],
    targets: ['ice'],
    timeSeconds: config.level.timeSeconds,
  };
}

/** The sample level keeps the 30 m field its obstacles were placed on by hand. */
export const SAMPLE_LEVEL_SIDE = 30;

/** Positions of the sample level's obstacles, chosen by hand: solid ones on wheat, fruit on green and ice. */
const SAMPLE_ROCKS = [
  { x: 7.5, z: 7.5 },
  { x: 25.5, z: 22.5 },
];
const SAMPLE_CACTUS = { x: 16.5, z: 25.5 };
/** Two columns of watermelons on green stripes. */
const SAMPLE_WATERMELON_COLUMNS = [10.5, 19.5];
const SAMPLE_WATERMELON_ROWS = [5, 15, 25];
/** Two columns of strawberries on ice stripes. */
const SAMPLE_STRAWBERRY_COLUMNS = [4.5, 13.5];
const SAMPLE_STRAWBERRY_ROWS = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29];
const SAMPLE_STRIPE_TYPES: readonly GrassType[] = ['green', 'ice', 'wheat'];
/** The start sits on the edge of a wheat stripe, so a sand clearing keeps the blade free to move at first. */
const SAMPLE_START_CLEARING_METERS = 3;

/** Hand-made level to play obstacles before the generator exists: stripes of green, ice and wheat. */
export function sampleLevel(): LevelDefinition {
  const width = SAMPLE_LEVEL_SIDE;
  const depth = SAMPLE_LEVEL_SIDE;
  const cellSize = 1;
  const columns = width / cellSize;
  const rows = depth / cellSize;
  const columnsPerStripe = config.level.stripeWidthMeters / cellSize;
  const stripeTypeOfCell = (cell: number): GrassType =>
    SAMPLE_STRIPE_TYPES[Math.floor((cell % columns) / columnsPerStripe) % SAMPLE_STRIPE_TYPES.length]!;
  const obstacles: Obstacle[] = [
    ...SAMPLE_ROCKS.map(({ x, z }) => ({ type: 'rock' as const, x, z })),
    { type: 'cactus', ...SAMPLE_CACTUS },
    ...SAMPLE_WATERMELON_COLUMNS.flatMap((x) => SAMPLE_WATERMELON_ROWS.map((z) => ({ type: 'watermelon' as const, x, z }))),
    ...SAMPLE_STRAWBERRY_COLUMNS.flatMap((x) => SAMPLE_STRAWBERRY_ROWS.map((z) => ({ type: 'strawberry' as const, x, z }))),
  ];
  const cells = Array.from({ length: columns * rows }, (_, cell): GrassType | null => stripeTypeOfCell(cell));
  clearCellsUnderSolidObstacles(cells, cellSize, columns, obstacles);
  clearStart(cells, cellSize, columns, rows, SAMPLE_START_CLEARING_METERS);
  return {
    number: 0,
    seed: config.field.seed,
    width,
    depth,
    cellSize,
    cells,
    obstacles,
    targets: ['ice', 'strawberry'],
    timeSeconds: config.level.timeSeconds,
  };
}
