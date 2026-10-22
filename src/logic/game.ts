import { config } from '../config';
import { addCuts, bladeRadius, createBlade, moveBlade, type Blade, type Direction } from './blade';
import { resolveCollisions, sizeToPass } from './collision';
import { coinsForCuts, timeBonus } from './economy';
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
import { noBonuses, type GameBonuses } from './upgrades';

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
  /** What the player's upgrades change in this game. */
  readonly bonuses: GameBonuses;
  /** How much each blade cut counts for growth and coins, so every quality plays the same. */
  readonly bladeWeight: number;
  status: GameStatus;
  timeLeft: number;
  /** The full time of this game, for the timer ring: the level's time plus the bonus seconds. */
  timeTotal: number;
  winWave: WinWave | null;
  /** Seconds the compass booster still points for; 0 when it is off. */
  compassLeft: number;
  /** Coins cut in this attempt, the win wave's included; fractional, as each blade pays its weight. */
  levelCoins: number;
  /** Bonus for the time left, set when the win wave starts. */
  bonusCoins: number;
  /** Coins of this attempt already added to the balance. */
  bankedCoins: number;
}

export interface StepResult {
  /** Blades cut during this step. */
  cutIndices: number[];
  /** Obstacles cut during this step. */
  cutObstacles: number[];
  sizesGained: number;
  /** Coins of the blades and obstacles cut during this step. */
  coins: number;
  /** True while the player pushes the blade against something it cannot cut yet. */
  blocked: boolean;
  /** When blocked, the size that would get the blade through: Infinity for a rock. Null otherwise. */
  neededSize: number | null;
}

function nothingHappened(): StepResult {
  return { cutIndices: [], cutObstacles: [], sizesGained: 0, coins: 0, blocked: false, neededSize: null };
}

/** The field of `level`, with the blade at its center, waiting for the first move. */
export function createGame(
  level: LevelDefinition = sampleLevel(),
  bonuses: GameBonuses = noBonuses(),
  bladeCount: number = config.field.referenceBladeCount,
): Game {
  const field = createField(levelFieldOptions(level, bladeCount));
  return {
    level,
    field,
    obstacles: createObstacleField(level.obstacles),
    blade: bladeAtCenter(field, bonuses),
    bonuses,
    bladeWeight: field.bladeCount === 0 ? 0 : config.field.referenceBladeCount / field.bladeCount,
    status: 'ready',
    timeLeft: startingTime(level, bonuses),
    timeTotal: startingTime(level, bonuses),
    winWave: null,
    compassLeft: 0,
    levelCoins: 0,
    bonusCoins: 0,
    bankedCoins: 0,
  };
}

function startingTime(level: LevelDefinition, bonuses: GameBonuses): number {
  return level.timeSeconds + bonuses.extraSeconds;
}

function bladeAtCenter(field: Field, bonuses: GameBonuses): Blade {
  return createBlade(field.width / 2, field.depth / 2, bonuses.startSize);
}

/** Puts the level back to its start: all grass standing, a new blade at the center and the whole time left. */
export function resetGame(game: Game): void {
  const { field, blade, level } = game;
  field.cut.fill(0);
  field.cutCount = 0;
  field.cutByType.fill(0);
  resetObstacleField(game.obstacles);
  Object.assign(blade, bladeAtCenter(field, game.bonuses));
  game.timeLeft = game.timeTotal = startingTime(level, game.bonuses);
  game.status = 'ready';
  game.winWave = null;
  game.compassLeft = 0;
  game.levelCoins = 0;
  game.bonusCoins = 0;
  game.bankedCoins = 0;
}

export function stepGame(game: Game, direction: Direction | null, dt: number): StepResult {
  if (game.status === 'ready') {
    if (!direction) return nothingHappened();
    game.status = 'playing';
  }
  const { field, blade } = game;
  if (game.status === 'winWave') return stepWinWave(game, game.winWave!, dt);
  if (game.status === 'won' || game.status === 'lost') {
    moveBlade(blade, null, dt, field.width, field.depth, maxSpeedOf(game));
    return nothingHappened();
  }
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  game.compassLeft = Math.max(0, game.compassLeft - dt);
  moveBlade(blade, direction, dt, field.width, field.depth, maxSpeedOf(game));
  const { x, z, blocked: pushedBack } = resolveCollisions(game, blade.x, blade.z, bladeRadius(blade.size), blade.size);
  // Growing can make the blade overlap a wall too; only a push against where the player steers counts.
  const blocked = pushedBack && direction !== null && (x - blade.x) * direction.x + (z - blade.z) * direction.z < 0;
  // Asked where the blade tried to go, before the walls pushed it back.
  const neededSize = blocked ? sizeToPass(game, blade.x, blade.z, bladeRadius(blade.size), blade.size) : null;
  blade.x = x;
  blade.z = z;
  const radius = bladeRadius(blade.size);
  const cutIndices = cutInCircle(field, blade.x, blade.z, radius, blade.size);
  const cutObstacles = cutObstaclesInCircle(game.obstacles, blade.x, blade.z, radius, blade.size);
  const growthCuts = cutIndices.length * game.bladeWeight + growthCutsOf(game.obstacles, cutObstacles);
  const sizesGained = addCuts(blade, growthCuts * game.bonuses.growthMultiplier);
  const coins = coinsForCuts(game, cutIndices, cutObstacles);
  game.levelCoins += coins;
  if (remainingTargets(game) === 0) {
    game.status = 'winWave';
    game.bonusCoins = timeBonus(game.timeLeft);
    game.winWave = { x: blade.x, z: blade.z, radius: 0 };
    game.compassLeft = 0;
  } else if (game.timeLeft === 0) {
    game.status = 'lost';
    game.compassLeft = 0;
  }
  return { cutIndices, cutObstacles, sizesGained, coins, blocked, neededSize };
}

function maxSpeedOf(game: Game): number {
  return config.blade.maxSpeed * game.bonuses.speedMultiplier;
}

function growthCutsOf(obstacles: ObstacleField, indices: number[]): number {
  return indices.reduce((cuts, index) => cuts + obstacleGrowthCuts(obstacles.obstacles[index]!.type), 0);
}

/** The wave grows from where the last target was cut and cuts everything but rocks, until it covers the whole field. */
function stepWinWave(game: Game, wave: WinWave, dt: number): StepResult {
  const { field, blade } = game;
  moveBlade(blade, null, dt, field.width, field.depth, maxSpeedOf(game));
  wave.radius += config.level.winWaveSpeed * dt;
  const cutIndices = cutInCircle(field, wave.x, wave.z, wave.radius, Infinity);
  const cutObstacles = cutObstaclesInCircle(game.obstacles, wave.x, wave.z, wave.radius, Infinity);
  const coins = coinsForCuts(game, cutIndices, cutObstacles);
  game.levelCoins += coins;
  if (wave.radius >= distanceToFarthestCorner(field, wave.x, wave.z)) game.status = 'won';
  return { cutIndices, cutObstacles, sizesGained: 0, coins, blocked: false, neededSize: null };
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
