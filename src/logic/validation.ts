import { config } from '../config';
import { bladeRadius, cutsToNextSize } from './blade';
import { isHardCell } from './collision';
import { isObstacleType, type LevelDefinition, type TargetKind } from './levels';
import { canCutObstacle, obstacleCutSize, obstacleGrowthCuts, obstacleRadius } from './obstacles';

export interface LevelAnalysis {
  /** Blade size reached after cutting everything reachable. */
  finalSize: number;
  /** Every target unit can be reached and cut with finalSize. */
  targetsReachable: boolean;
  /** Grass cells the player must sweep: the target cells plus the cheapest cells needed to grow. */
  cellsToSweep: number;
}

export type Rejection = 'noTargets' | 'unreachableTargets' | 'tooLong' | 'startBlocked';

/** The board the analysis walks on: cells, their blades and where the blade starts. */
interface Board {
  readonly level: LevelDefinition;
  readonly columns: number;
  readonly rows: number;
  /** Blades `createField` puts in each cell. */
  readonly bladesInCell: Int32Array;
  /** Blades in an average grass cell; 0 when there is no grass. */
  readonly bladesPerGrassCell: number;
  readonly startCell: number;
  /** Cell under each obstacle's center. */
  readonly obstacleCell: Int32Array;
}

export function validateLevel(level: LevelDefinition): { valid: true } | { valid: false; reason: Rejection } {
  const board = boardOf(level);
  if (level.targets.some((target) => unitsOf(board, target) === 0)) return { valid: false, reason: 'noTargets' };
  if (!isWalkable(board, board.startCell, config.blade.startSize)) return { valid: false, reason: 'startBlocked' };
  if (!analyzeBoard(board).targetsReachable) return { valid: false, reason: 'unreachableTargets' };
  if (level.timeSeconds > config.generator.maxTimeSeconds) return { valid: false, reason: 'tooLong' };
  return { valid: true };
}

export function analyzeLevel(level: LevelDefinition): LevelAnalysis {
  return analyzeBoard(boardOf(level));
}

/**
 * Seconds to sweep the cells the level needs at full speed, with the blade widening as it grows,
 * plus a fixed time for each target piece. The generator multiplies it by the level's time margin.
 */
export function estimateSeconds(level: LevelDefinition): number {
  const board = boardOf(level);
  const sweptCells = cellsToSweep(board);
  const cellArea = level.cellSize * level.cellSize;
  let size = config.blade.startSize;
  let growth = 0;
  let seconds = 0;
  for (let cell = 0; cell < sweptCells; cell++) {
    seconds += cellArea / (2 * bladeRadius(size) * config.blade.maxSpeed);
    growth += board.bladesPerGrassCell;
    while (growth >= cutsToNextSize(size)) {
      growth -= cutsToNextSize(size);
      size++;
    }
  }
  const targetPieces = level.targets.filter(isObstacleType).reduce((pieces, target) => pieces + unitsOf(board, target), 0);
  return seconds + targetPieces * config.generator.secondsPerTargetPiece;
}

function boardOf(level: LevelDefinition): Board {
  const columns = Math.ceil(level.width / level.cellSize);
  const rows = Math.ceil(level.depth / level.cellSize);
  const cellAt = (x: number, z: number) =>
    Math.min(rows - 1, Math.floor(z / level.cellSize)) * columns + Math.min(columns - 1, Math.floor(x / level.cellSize));
  const bladesInCell = bladesInCells(level.cells);
  const grassCells = bladesInCell.filter((blades) => blades > 0).length;
  return {
    level,
    columns,
    rows,
    bladesInCell,
    bladesPerGrassCell: grassCells === 0 ? 0 : config.field.referenceBladeCount / grassCells,
    startCell: cellAt(level.width / 2, level.depth / 2),
    obstacleCell: Int32Array.from(level.obstacles, ({ x, z }) => cellAt(x, z)),
  };
}

/**
 * Same split as createField: blade `i` goes to grass cell `i % grassCellCount`.
 * Always at the reference density, since every quality plays the same.
 */
function bladesInCells(cells: LevelDefinition['cells']): Int32Array {
  const grassCells = cells.flatMap((type, cell) => (type === null ? [] : [cell]));
  const blades = new Int32Array(cells.length);
  if (grassCells.length === 0) return blades;
  const bladeCount = config.field.referenceBladeCount;
  const base = Math.floor(bladeCount / grassCells.length);
  grassCells.forEach((cell, order) => (blades[cell] = base + (order < bladeCount % grassCells.length ? 1 : 0)));
  return blades;
}

/** Repeats a flood fill from the start with the size the cuts in reach give, until the size stops growing. */
function analyzeBoard(board: Board): LevelAnalysis {
  let size = config.blade.startSize;
  let reached = floodFrom(board, size);
  for (;;) {
    const grown = sizeAfterCuts(reachableCuts(board, reached, size));
    if (grown <= size) break;
    size = grown;
    reached = floodFrom(board, size);
  }
  return {
    finalSize: size,
    targetsReachable: board.level.targets.every((target) => isTargetReachable(board, target, reached, size)),
    cellsToSweep: cellsToSweep(board),
  };
}

function floodFrom(board: Board, size: number): Uint8Array {
  const reached = new Uint8Array(board.level.cells.length);
  if (!isWalkable(board, board.startCell, size)) return reached;
  reached[board.startCell] = 1;
  const pending = [board.startCell];
  while (pending.length > 0) {
    const cell = pending.pop()!;
    for (const next of neighbors(board, cell)) {
      if (reached[next] === 1 || !isWalkable(board, next, size)) continue;
      reached[next] = 1;
      pending.push(next);
    }
  }
  return reached;
}

/** A cell the blade can stand on: not hard grass, and its center not inside an obstacle it cannot cut. */
function isWalkable(board: Board, cell: number, size: number): boolean {
  const { level, columns } = board;
  if (isHardCell(level, cell, size)) return false;
  const centerX = ((cell % columns) + 0.5) * level.cellSize;
  const centerZ = (Math.floor(cell / columns) + 0.5) * level.cellSize;
  return level.obstacles.every(
    ({ type, x, z }) => canCutObstacle(type, size) || Math.hypot(centerX - x, centerZ - z) >= obstacleRadius(type),
  );
}

function neighbors(board: Board, cell: number): number[] {
  const { columns, rows } = board;
  const column = cell % columns;
  const row = Math.floor(cell / columns);
  const found: number[] = [];
  if (column > 0) found.push(cell - 1);
  if (column < columns - 1) found.push(cell + 1);
  if (row > 0) found.push(cell - columns);
  if (row < rows - 1) found.push(cell + columns);
  return found;
}

/**
 * An obstacle the blade can touch: its own cell is reached. A reached neighbor is not enough,
 * since the cell the obstacle sits on is then a wall that keeps the blade away from it.
 */
function isWithinReach(board: Board, obstacle: number, reached: Uint8Array): boolean {
  return reached[board.obstacleCell[obstacle]!] === 1;
}

function reachableCuts(board: Board, reached: Uint8Array, size: number): number {
  let cuts = 0;
  reached.forEach((isReached, cell) => (cuts += isReached * board.bladesInCell[cell]!));
  board.level.obstacles.forEach(({ type }, obstacle) => {
    if (canCutObstacle(type, size) && isWithinReach(board, obstacle, reached)) cuts += obstacleGrowthCuts(type);
  });
  return cuts;
}

function sizeAfterCuts(cuts: number): number {
  let size = config.blade.startSize;
  let left = cuts;
  while (left >= cutsToNextSize(size)) {
    left -= cutsToNextSize(size);
    size++;
  }
  return size;
}

function isTargetReachable(board: Board, target: TargetKind, reached: Uint8Array, size: number): boolean {
  const { level } = board;
  if (isObstacleType(target)) {
    return level.obstacles.every(
      ({ type }, obstacle) => type !== target || (canCutObstacle(type, size) && isWithinReach(board, obstacle, reached)),
    );
  }
  return level.cells.every((type, cell) => type !== target || reached[cell] === 1);
}

/** Units (grass cells' blades, or pieces) of `target` on the level. */
function unitsOf(board: Board, target: TargetKind): number {
  if (isObstacleType(target)) return board.level.obstacles.filter(({ type }) => type === target).length;
  return board.level.cells.reduce((blades, type, cell) => blades + (type === target ? board.bladesInCell[cell]! : 0), 0);
}

/** The target cells, plus enough cells of average grass to grow to the biggest size the targets ask for. */
function cellsToSweep(board: Board): number {
  const { level, bladesPerGrassCell } = board;
  const targetCells = level.cells.filter((type) => type !== null && level.targets.includes(type)).length;
  const neededSize = Math.max(config.blade.startSize, ...level.targets.map(minSizeOf));
  let cutsToGrow = 0;
  for (let size = config.blade.startSize; size < neededSize; size++) cutsToGrow += cutsToNextSize(size);
  // Without grass there is nothing to grow on; validation rejects such levels, the estimate just skips growth.
  const growthCells = cutsToGrow === 0 || bladesPerGrassCell === 0 ? 0 : Math.ceil(cutsToGrow / bladesPerGrassCell);
  return targetCells + growthCells;
}

function minSizeOf(target: TargetKind): number {
  return isObstacleType(target) ? obstacleCutSize(target) : config.grassTypes[target].minSize;
}
