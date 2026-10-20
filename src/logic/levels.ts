import { config } from '../config';
import type { GrassType } from './field';

export interface LevelDefinition {
  width: number;
  depth: number;
  /** Side of each square cell, in meters. */
  cellSize: number;
  /** Row by row (`cell = row * columns + column`); null = sand, no grass. */
  cells: readonly (GrassType | null)[];
  target: GrassType;
  /** Not readonly: the debug panel tunes it, and resetGame reads it. */
  timeSeconds: number;
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
    width,
    depth,
    cellSize,
    cells: Array.from({ length: columns * rows }, (_, cell) => stripeTypeOfCell(cell)),
    target: 'ice',
    timeSeconds: config.level.timeSeconds,
  };
}
