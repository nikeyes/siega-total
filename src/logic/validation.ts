import { config } from '../config';
import { bladeRadius, cutsToNextSize } from './blade';
import { isHardCell, resolveCollisions, type CollisionWorld } from './collision';
import { isObstacleType, type LevelDefinition, type TargetKind } from './levels';
import { canCutObstacle, createObstacleField, obstacleCutSize, obstacleGrowthCuts, obstacleHits, obstacleRadius } from './obstacles';

export interface LevelAnalysis {
  /** Blade size reached after cutting everything reachable. */
  finalSize: number;
  /** Every target unit can be reached and cut with finalSize. */
  targetsReachable: boolean;
  /** Grass cells the player must sweep: the target cells plus the cheapest cells needed to grow. */
  cellsToSweep: number;
}

export type Rejection = 'noTargets' | 'unreachableTargets' | 'tooLong' | 'startBlocked';

/**
 * The blade's center walks on a grid of points this far apart, over the field only: the shore gives room to turn,
 * but a level that needs it as the way to a target would hide its path from the player.
 */
const STEP_METERS = 0.5;
/** A target cell counts as cut when the blade reaches its corners, this far inside it. */
const CORNER_INSET_METERS = 0.05;
/** The game pushes a blade that starts against a wall out to free ground this close to the field center. */
const START_PUSH_METERS = 0.75;

/**
 * The board the analysis walks on: the cells and their blades, and the points the blade's center can stand on,
 * row by row, from the north-west corner of the field.
 */
interface Board {
  readonly level: LevelDefinition;
  readonly columns: number;
  readonly rows: number;
  /** Blades `createField` puts in each cell. */
  readonly bladesInCell: Int32Array;
  /** Blades in an average grass cell; 0 when there is no grass. */
  readonly bladesPerGrassCell: number;
  readonly pointColumns: number;
  readonly pointRows: number;
  /** Where the points start: the field's north-west corner. */
  readonly pointOrigin: number;
  /** The points round the field center, nearest first, where the blade can start once pushed out of a wall. */
  readonly startPoints: readonly number[];
  /** The level as the game's collisions see it, with nothing cut yet. */
  readonly world: CollisionWorld;
}

/**
 * A level every player can finish: whatever start size they bought in the shop, the blade gets out of the start
 * and can reach and cut every target, walking as the game moves it.
 */
export function validateLevel(level: LevelDefinition): { valid: true } | { valid: false; reason: Rejection } {
  const board = boardOf(level);
  if (level.targets.some((target) => unitsOf(board, target) === 0)) return { valid: false, reason: 'noTargets' };
  const reaches = new Map<number, SizeReach>();
  for (const startSize of startSizes()) {
    if (startPointOf(board, startSize) === null) return { valid: false, reason: 'startBlocked' };
    if (!analyzeBoard(board, startSize, reaches).targetsReachable) return { valid: false, reason: 'unreachableTargets' };
  }
  if (level.timeSeconds > config.generator.maxTimeSeconds) return { valid: false, reason: 'tooLong' };
  return { valid: true };
}

export function analyzeLevel(level: LevelDefinition): LevelAnalysis {
  return analyzeBoard(boardOf(level), config.blade.startSize, new Map());
}

/** Every size the blade can start at: the base one, and each start-size upgrade the shop sells. */
function startSizes(): number[] {
  const { max, perLevel } = config.upgrades.startSize;
  return Array.from({ length: max + 1 }, (_, bought) => config.blade.startSize + bought * perLevel);
}

/**
 * Seconds to sweep the cells the level needs at full speed, with the blade widening as it grows,
 * plus the time each target piece takes, its hits included, and the travel between the targets.
 * The generator multiplies it by the level's time margin.
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
  // Each target piece takes its fixed time, plus a hit interval for every blow it takes after the first.
  const pieceSeconds = level.targets.filter(isObstacleType).reduce((total, target) => {
    const perPiece = config.generator.secondsPerTargetPiece + (obstacleHits(target) - 1) * config.collision.hitIntervalSeconds;
    return total + unitsOf(board, target) * perPiece;
  }, 0);
  return seconds + pieceSeconds + travelSeconds(level);
}

/**
 * Seconds at full speed to go from the start to each patch of target grass and each target piece in turn,
 * always to the nearest one left, along the way the blade can go at the size it finishes the level with.
 */
export function travelSeconds(level: LevelDefinition): number {
  const board = boardOf(level);
  const reaches = new Map<number, SizeReach>();
  const { finalSize } = analyzeBoard(board, config.blade.startSize, reaches);
  const { reached } = reachOf(board, finalSize, reaches);
  let current = startPointOf(board, finalSize);
  if (current === null) return 0;
  const stops = targetStops(board).map((spots) => goalPoints(board, reached, finalSize, spots));
  const visited = stops.map(() => false);
  let steps = 0;
  for (;;) {
    const distance = stepsFrom(board, reached, current);
    let nearest: { stop: number; point: number; steps: number } | null = null;
    stops.forEach((points, stop) => {
      if (visited[stop]) return;
      for (const point of points) {
        if (distance[point]! >= 0 && (!nearest || distance[point]! < nearest.steps)) nearest = { stop, point, steps: distance[point]! };
      }
    });
    if (!nearest) break;
    const { stop, point, steps: stepsToStop } = nearest;
    visited[stop] = true;
    steps += stepsToStop;
    current = point;
  }
  return (steps * STEP_METERS) / config.blade.maxSpeed;
}

/** Each place the player must go: a patch of touching target-grass cells, or a target piece, as the spots to reach and how near. */
function targetStops(board: Board): { x: number; z: number; margin: number }[][] {
  const { level, columns, rows } = board;
  const stops: { x: number; z: number; margin: number }[][] = [];
  const inPatch = new Uint8Array(level.cells.length);
  level.cells.forEach((type, cell) => {
    if (type === null || !level.targets.includes(type) || inPatch[cell] === 1) return;
    const patch: { x: number; z: number; margin: number }[] = [];
    const pending = [cell];
    inPatch[cell] = 1;
    while (pending.length > 0) {
      const next = pending.pop()!;
      patch.push({ ...cellCenter(board, next), margin: 0 });
      const column = next % columns;
      const row = Math.floor(next / columns);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const neighborColumn = column + dc;
        const neighborRow = row + dr;
        if (neighborColumn < 0 || neighborRow < 0 || neighborColumn >= columns || neighborRow >= rows) continue;
        const neighbor = neighborRow * columns + neighborColumn;
        if (inPatch[neighbor] === 0 && level.cells[neighbor] === type) {
          inPatch[neighbor] = 1;
          pending.push(neighbor);
        }
      }
    }
    stops.push(patch);
  });
  level.obstacles.forEach(({ type, x, z }) => {
    if (level.targets.some((target) => target === type)) stops.push([{ x, z, margin: obstacleRadius(type) }]);
  });
  return stops;
}

/** The reached points from which a blade of `size` covers one of the spots. */
function goalPoints(board: Board, reached: Uint8Array, size: number, spots: { x: number; z: number; margin: number }[]): number[] {
  const points = new Set<number>();
  for (const { x, z, margin } of spots) for (const point of reachedPointsNear(board, reached, x, z, bladeRadius(size) + margin)) points.add(point);
  return [...points];
}

/** Steps, half a meter each, from `from` to every reached point; −1 where it cannot get. */
function stepsFrom(board: Board, reached: Uint8Array, from: number): Int32Array {
  const steps = new Int32Array(reached.length).fill(-1);
  steps[from] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const point = queue[head]!;
    for (const next of neighbors(board, point)) {
      if (reached[next] !== 1 || steps[next]! >= 0) continue;
      steps[next] = steps[point]! + 1;
      queue.push(next);
    }
  }
  return steps;
}

function boardOf(level: LevelDefinition): Board {
  const columns = Math.ceil(level.width / level.cellSize);
  const rows = Math.ceil(level.depth / level.cellSize);
  const bladesInCell = bladesInCells(level.cells);
  const grassCells = bladesInCell.filter((blades) => blades > 0).length;
  const pointColumns = Math.floor(level.width / STEP_METERS) + 1;
  const pointRows = Math.floor(level.depth / STEP_METERS) + 1;
  const centerColumn = Math.round(level.width / 2 / STEP_METERS);
  const centerRow = Math.round(level.depth / 2 / STEP_METERS);
  const reachSteps = Math.floor(START_PUSH_METERS / STEP_METERS);
  const startPoints: number[] = [];
  for (let row = centerRow - reachSteps; row <= centerRow + reachSteps; row++) {
    for (let column = centerColumn - reachSteps; column <= centerColumn + reachSteps; column++) {
      if (Math.hypot(row - centerRow, column - centerColumn) * STEP_METERS <= START_PUSH_METERS) startPoints.push(row * pointColumns + column);
    }
  }
  startPoints.sort((a, b) => distanceInSteps(a) - distanceInSteps(b));
  function distanceInSteps(point: number): number {
    return Math.hypot(Math.floor(point / pointColumns) - centerRow, (point % pointColumns) - centerColumn);
  }
  return {
    level,
    columns,
    rows,
    bladesInCell,
    bladesPerGrassCell: grassCells === 0 ? 0 : config.field.referenceBladeCount / grassCells,
    pointColumns,
    pointRows,
    pointOrigin: 0,
    startPoints,
    world: { level, obstacles: createObstacleField(level.obstacles) },
  };
}

function pointX(board: Board, point: number): number {
  return board.pointOrigin + (point % board.pointColumns) * STEP_METERS;
}

function pointZ(board: Board, point: number): number {
  return board.pointOrigin + Math.floor(point / board.pointColumns) * STEP_METERS;
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

/** What a blade of one size reaches from the start: where it can go, and the cells and obstacles it can cut. */
interface SizeReach {
  readonly reached: Uint8Array;
  readonly cutCells: Uint8Array;
  readonly cutObstacles: Uint8Array;
}

/** The reach of `size`, worked out once and shared by every start size, since it does not depend on how the blade got there. */
function reachOf(board: Board, size: number, reaches: Map<number, SizeReach>): SizeReach {
  let reach = reaches.get(size);
  if (!reach) {
    const reached = floodFrom(board, size);
    reach = { reached, ...cutsWithin(board, reached, size) };
    reaches.set(size, reach);
  }
  return reach;
}

/**
 * Walks from the start with the size the cuts in reach give, again and again until the size stops growing.
 * What the blade cuts while small stays cut once it grows, even where a bigger blade no longer fits.
 */
function analyzeBoard(board: Board, startSize: number, reaches: Map<number, SizeReach>): LevelAnalysis {
  const cutCells = new Uint8Array(board.level.cells.length);
  const cutObstacles = new Uint8Array(board.level.obstacles.length);
  let size = startSize;
  for (;;) {
    const reach = reachOf(board, size, reaches);
    reach.cutCells.forEach((isCut, cell) => (cutCells[cell] ||= isCut));
    reach.cutObstacles.forEach((isCut, obstacle) => (cutObstacles[obstacle] ||= isCut));
    const grown = sizeAfterCuts(cutsOf(board, cutCells, cutObstacles), startSize);
    if (grown <= size) break;
    size = grown;
  }
  const { reached } = reachOf(board, size, reaches);
  return {
    finalSize: size,
    targetsReachable: board.level.targets.every((target) => isTargetReachable(board, target, reached, size)),
    cellsToSweep: cellsToSweep(board),
  };
}

/** Where a blade of `size` starts: the free point nearest the field center, or null when the start is walled in. */
function startPointOf(board: Board, size: number): number | null {
  return board.startPoints.find((point) => isWalkable(board, point, size)) ?? null;
}

/** The points the blade's center can get to from the start at `size`, moving half a meter at a time. */
function floodFrom(board: Board, size: number): Uint8Array {
  const reached = new Uint8Array(board.pointColumns * board.pointRows);
  const start = startPointOf(board, size);
  if (start === null) return reached;
  reached[start] = 1;
  const pending = [start];
  while (pending.length > 0) {
    const point = pending.pop()!;
    for (const next of neighbors(board, point)) {
      if (reached[next] === 1 || !isWalkable(board, next, size)) continue;
      reached[next] = 1;
      pending.push(next);
    }
  }
  return reached;
}

/** A point the blade's center can stand on at `size`: its circle overlaps no grass and no obstacle it cannot cut. */
function isWalkable(board: Board, point: number, size: number): boolean {
  const { level, columns, rows } = board;
  const x = pointX(board, point);
  const z = pointZ(board, point);
  const radius = bladeRadius(size);
  const { cellSize } = level;
  for (let row = Math.max(0, Math.floor((z - radius) / cellSize)); row <= Math.min(rows - 1, Math.floor((z + radius) / cellSize)); row++) {
    for (let column = Math.max(0, Math.floor((x - radius) / cellSize)); column <= Math.min(columns - 1, Math.floor((x + radius) / cellSize)); column++) {
      if (!isHardCell(level, row * columns + column, size)) continue;
      const nearestX = Math.min(Math.max(x, column * cellSize), (column + 1) * cellSize);
      const nearestZ = Math.min(Math.max(z, row * cellSize), (row + 1) * cellSize);
      if (Math.hypot(x - nearestX, z - nearestZ) < radius) return false;
    }
  }
  return level.obstacles.every(
    ({ type, x: obstacleX, z: obstacleZ }) => canCutObstacle(type, size) || Math.hypot(x - obstacleX, z - obstacleZ) >= radius + obstacleRadius(type),
  );
}

function neighbors(board: Board, point: number): number[] {
  const { pointColumns, pointRows } = board;
  const column = point % pointColumns;
  const row = Math.floor(point / pointColumns);
  const found: number[] = [];
  if (column > 0) found.push(point - 1);
  if (column < pointColumns - 1) found.push(point + 1);
  if (row > 0) found.push(point - pointColumns);
  if (row < pointRows - 1) found.push(point + pointColumns);
  return found;
}

/**
 * True when the blade's circle, at `size`, can cover the spot (x, z) widened by `margin`: from a reached point, or
 * from where the game's collisions push a blade centered on the spot, when that lies next to a reached point.
 * The second way finds the spots by walls that the half-meter grid misses.
 */
function isWithinReach(board: Board, reached: Uint8Array, size: number, x: number, z: number, margin = 0): boolean {
  const reach = bladeRadius(size) + margin;
  if (hasReachedPointNear(board, reached, x, z, reach)) return true;
  const pushed = resolveCollisions(board.world, x, z, bladeRadius(size), size);
  return Math.hypot(pushed.x - x, pushed.z - z) <= reach && hasReachedPointNear(board, reached, pushed.x, pushed.z, STEP_METERS);
}

/** Some reached point lies within `distance` of (x, z). */
function hasReachedPointNear(board: Board, reached: Uint8Array, x: number, z: number, distance: number): boolean {
  return reachedPointsNear(board, reached, x, z, distance).length > 0;
}

/** The reached points within `distance` of (x, z). */
function reachedPointsNear(board: Board, reached: Uint8Array, x: number, z: number, distance: number): number[] {
  const firstColumn = Math.max(0, Math.ceil((x - distance - board.pointOrigin) / STEP_METERS));
  const lastColumn = Math.min(board.pointColumns - 1, Math.floor((x + distance - board.pointOrigin) / STEP_METERS));
  const firstRow = Math.max(0, Math.ceil((z - distance - board.pointOrigin) / STEP_METERS));
  const lastRow = Math.min(board.pointRows - 1, Math.floor((z + distance - board.pointOrigin) / STEP_METERS));
  const found: number[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const point = row * board.pointColumns + column;
      if (reached[point] === 1 && Math.hypot(pointX(board, point) - x, pointZ(board, point) - z) <= distance) found.push(point);
    }
  }
  return found;
}

/** The cell's center: where its blades are on average. */
function cellCenter(board: Board, cell: number): { x: number; z: number } {
  const { cellSize } = board.level;
  return { x: ((cell % board.columns) + 0.5) * cellSize, z: (Math.floor(cell / board.columns) + 0.5) * cellSize };
}

/** Every corner of the cell, just inside it, is within reach: all its blades get cut. */
function isCellSwept(board: Board, cell: number, reached: Uint8Array, size: number): boolean {
  const { cellSize } = board.level;
  const left = (cell % board.columns) * cellSize + CORNER_INSET_METERS;
  const top = Math.floor(cell / board.columns) * cellSize + CORNER_INSET_METERS;
  const right = left + cellSize - 2 * CORNER_INSET_METERS;
  const bottom = top + cellSize - 2 * CORNER_INSET_METERS;
  return [left, right].every((x) => [top, bottom].every((z) => isWithinReach(board, reached, size, x, z)));
}

function isCuttableCell(board: Board, cell: number, size: number): boolean {
  const type = board.level.cells[cell];
  return type !== null && type !== undefined && config.grassTypes[type].minSize <= size;
}

/** The cuttable cells whose center a blade of `size` reaches, and the obstacles it can reach and cut. */
function cutsWithin(board: Board, reached: Uint8Array, size: number): { cutCells: Uint8Array; cutObstacles: Uint8Array } {
  const cutCells = new Uint8Array(board.level.cells.length);
  board.bladesInCell.forEach((blades, cell) => {
    if (blades === 0 || !isCuttableCell(board, cell, size)) return;
    const { x, z } = cellCenter(board, cell);
    if (isWithinReach(board, reached, size, x, z)) cutCells[cell] = 1;
  });
  const cutObstacles = Uint8Array.from(board.level.obstacles, ({ type, x, z }) =>
    canCutObstacle(type, size) && isWithinReach(board, reached, size, x, z, obstacleRadius(type)) ? 1 : 0,
  );
  return { cutCells, cutObstacles };
}

/** Growth the cut cells and obstacles give. */
function cutsOf(board: Board, cutCells: Uint8Array, cutObstacles: Uint8Array): number {
  let cuts = 0;
  cutCells.forEach((isCut, cell) => (cuts += isCut * board.bladesInCell[cell]!));
  board.level.obstacles.forEach(({ type }, obstacle) => (cuts += cutObstacles[obstacle]! * obstacleGrowthCuts(type)));
  return cuts;
}

function sizeAfterCuts(cuts: number, startSize: number): number {
  let size = startSize;
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
      ({ type, x, z }) => type !== target || (canCutObstacle(type, size) && isWithinReach(board, reached, size, x, z, obstacleRadius(type))),
    );
  }
  return level.cells.every((type, cell) => type !== target || (isCuttableCell(board, cell, size) && isCellSwept(board, cell, reached, size)));
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
