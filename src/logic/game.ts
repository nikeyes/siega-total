import { config } from '../config';
import { addCuts, bladeRadius, createBlade, moveBlade, type Blade, type Direction } from './blade';
import { resolveCollisions } from './collision';
import { createField, cutBlade, cutInCircle, GRASS_TYPE_ORDER, levelFieldOptions, type Field } from './field';
import { isObstacleType, sampleLevel, type LevelDefinition, type TargetKind } from './levels';
import {
  createObstacleField,
  cutObstaclesInCircle,
  obstacleGrowthCuts,
  resetObstacleField,
  standingCount,
  type ObstacleField,
} from './obstacles';

export type GameStatus = 'ready' | 'playing' | 'winWave' | 'won' | 'lost';

export interface WinWave {
  x: number;
  z: number;
  radius: number;
}

export interface Game {
  readonly level: LevelDefinition;
  readonly field: Field;
  readonly obstacles: ObstacleField;
  readonly blade: Blade;
  status: GameStatus;
  timeLeft: number;
  winWave: WinWave | null;
}

export interface StepResult {
  /** Blades cut during this step. */
  cutIndices: number[];
  /** Obstacles cut during this step. */
  cutObstacles: number[];
  sizesGained: number;
  /** True while the blade pushes against something it cannot cut yet. */
  blocked: boolean;
}

function nothingHappened(): StepResult {
  return { cutIndices: [], cutObstacles: [], sizesGained: 0, blocked: false };
}

/** The field of `level`, with the blade at its center, waiting for the first move. */
export function createGame(level: LevelDefinition = sampleLevel()): Game {
  const field = createField(levelFieldOptions(level));
  return {
    level,
    field,
    obstacles: createObstacleField(level.obstacles),
    blade: bladeAtCenter(field),
    status: 'ready',
    timeLeft: level.timeSeconds,
    winWave: null,
  };
}

function bladeAtCenter(field: Field): Blade {
  return createBlade(field.width / 2, field.depth / 2);
}

/** Puts the level back to its start: all grass standing, a new blade at the center and the whole time left. */
export function resetGame(game: Game): void {
  const { field, blade, level } = game;
  field.cut.fill(0);
  field.cutCount = 0;
  field.cutByType.fill(0);
  resetObstacleField(game.obstacles);
  Object.assign(blade, bladeAtCenter(field));
  game.timeLeft = level.timeSeconds;
  game.status = 'ready';
  game.winWave = null;
}

export function stepGame(game: Game, direction: Direction | null, dt: number): StepResult {
  if (game.status === 'ready') {
    if (!direction) return nothingHappened();
    game.status = 'playing';
  }
  const { field, blade } = game;
  if (game.status === 'winWave') return stepWinWave(game, game.winWave!, dt);
  if (game.status === 'won' || game.status === 'lost') {
    moveBlade(blade, null, dt, field.width, field.depth);
    return nothingHappened();
  }
  game.timeLeft -= dt;
  moveBlade(blade, direction, dt, field.width, field.depth);
  const { x, z, blocked } = resolveCollisions(game, blade.x, blade.z, bladeRadius(blade.size), blade.size);
  blade.x = x;
  blade.z = z;
  const radius = bladeRadius(blade.size);
  const cutIndices = cutInCircle(field, blade.x, blade.z, radius, blade.size);
  const cutObstacles = cutObstaclesInCircle(game.obstacles, blade.x, blade.z, radius, blade.size);
  const sizesGained = addCuts(blade, cutIndices.length + growthCutsOf(game.obstacles, cutObstacles));
  if (remainingTargets(game) === 0) {
    game.status = 'winWave';
    game.winWave = { x: blade.x, z: blade.z, radius: 0 };
  } else if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    game.status = 'lost';
  }
  return { cutIndices, cutObstacles, sizesGained, blocked };
}

function growthCutsOf(obstacles: ObstacleField, indices: number[]): number {
  return indices.reduce((cuts, index) => cuts + obstacleGrowthCuts(obstacles.obstacles[index]!.type), 0);
}

/** The wave grows from where the last target was cut and cuts everything but rocks, until it covers the whole field. */
function stepWinWave(game: Game, wave: WinWave, dt: number): StepResult {
  const { field, blade } = game;
  moveBlade(blade, null, dt, field.width, field.depth);
  wave.radius += config.level.winWaveSpeed * dt;
  const cutIndices = cutInCircle(field, wave.x, wave.z, wave.radius, Infinity);
  const cutObstacles = cutObstaclesInCircle(game.obstacles, wave.x, wave.z, wave.radius, Infinity);
  if (wave.radius >= distanceToFarthestCorner(field, wave.x, wave.z)) game.status = 'won';
  return { cutIndices, cutObstacles, sizesGained: 0, blocked: false };
}

function distanceToFarthestCorner(field: Field, x: number, z: number): number {
  return Math.hypot(Math.max(x, field.width - x), Math.max(z, field.depth - z));
}

/** Units (blades or pieces) of each target still standing, in the order of `level.targets`. */
export function remainingByTarget(game: Game): number[] {
  return game.level.targets.map((target) => remainingOf(game, target));
}

function remainingOf(game: Game, target: TargetKind): number {
  if (isObstacleType(target)) return standingCount(game.obstacles, target);
  const type = GRASS_TYPE_ORDER.indexOf(target);
  return game.field.countByType[type]! - game.field.cutByType[type]!;
}

/** Units of every target still standing. */
export function remainingTargets(game: Game): number {
  return remainingByTarget(game).reduce((sum, remaining) => sum + remaining, 0);
}

/** Grass types (indices into GRASS_TYPE_ORDER) among the targets, for the highlight. */
export function targetGrassTypes(game: Game): number[] {
  return game.level.targets.flatMap((target) => (isObstacleType(target) ? [] : [GRASS_TYPE_ORDER.indexOf(target)]));
}

/** The last few target blades glow so the player can find them. */
export function shouldHighlightTargets(game: Game): boolean {
  const remaining = remainingTargets(game);
  return game.status === 'playing' && remaining > 0 && remaining < config.level.highlightBelow;
}

/** Debug shortcut: cuts every standing target blade and piece, so the next step starts the win wave. */
export function cutAllTargets(game: Game): { blades: number[]; obstacles: number[] } {
  const { field, obstacles, level } = game;
  const grassTargets = targetGrassTypes(game);
  const blades: number[] = [];
  for (let blade = 0; blade < field.bladeCount; blade++) {
    if (grassTargets.includes(field.types[blade]!) && field.cut[blade] === 0) {
      cutBlade(field, blade);
      blades.push(blade);
    }
  }
  const cutPieces: number[] = [];
  obstacles.obstacles.forEach((obstacle, index) => {
    if (obstacles.cut[index] === 0 && level.targets.some((target) => target === obstacle.type)) {
      obstacles.cut[index] = 1;
      cutPieces.push(index);
    }
  });
  if (game.status === 'ready') game.status = 'playing';
  return { blades, obstacles: cutPieces };
}
