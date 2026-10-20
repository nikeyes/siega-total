import { config } from '../config';
import { addCuts, bladeRadius, createBlade, moveBlade, type Blade, type Direction } from './blade';
import { createField, cutBlade, cutInCircle, GRASS_TYPE_ORDER, levelFieldOptions, type Field } from './field';
import { stripesLevel, type LevelDefinition } from './levels';

export type GameStatus = 'ready' | 'playing' | 'winWave' | 'won' | 'lost';

export interface WinWave {
  x: number;
  z: number;
  radius: number;
}

export interface Game {
  readonly level: LevelDefinition;
  readonly field: Field;
  readonly blade: Blade;
  /** Index into GRASS_TYPE_ORDER. */
  readonly targetType: number;
  status: GameStatus;
  timeLeft: number;
  winWave: WinWave | null;
}

export interface StepResult {
  /** Blades cut during this step. */
  cutIndices: number[];
  sizesGained: number;
}

/** The field of `level`, with the blade at its center, waiting for the first move. */
export function createGame(level: LevelDefinition = stripesLevel()): Game {
  const field = createField(levelFieldOptions(level));
  return {
    level,
    field,
    blade: bladeAtCenter(field),
    targetType: GRASS_TYPE_ORDER.indexOf(level.target),
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
  Object.assign(blade, bladeAtCenter(field));
  game.timeLeft = level.timeSeconds;
  game.status = 'ready';
  game.winWave = null;
}

export function stepGame(game: Game, direction: Direction | null, dt: number): StepResult {
  if (game.status === 'ready') {
    if (!direction) return { cutIndices: [], sizesGained: 0 };
    game.status = 'playing';
  }
  const { field, blade } = game;
  if (game.status === 'winWave') return stepWinWave(game, game.winWave!, dt);
  if (game.status === 'won' || game.status === 'lost') {
    moveBlade(blade, null, dt, field.width, field.depth);
    return { cutIndices: [], sizesGained: 0 };
  }
  game.timeLeft -= dt;
  moveBlade(blade, direction, dt, field.width, field.depth);
  const cutIndices = cutInCircle(field, blade.x, blade.z, bladeRadius(blade.size), blade.size);
  const sizesGained = addCuts(blade, cutIndices.length);
  if (remainingTargets(game) === 0) {
    game.status = 'winWave';
    game.winWave = { x: blade.x, z: blade.z, radius: 0 };
  } else if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    game.status = 'lost';
  }
  return { cutIndices, sizesGained };
}

/** The wave grows from where the last target was cut and cuts everything, until it covers the whole field. */
function stepWinWave(game: Game, wave: WinWave, dt: number): StepResult {
  const { field, blade } = game;
  moveBlade(blade, null, dt, field.width, field.depth);
  wave.radius += config.level.winWaveSpeed * dt;
  const cutIndices = cutInCircle(field, wave.x, wave.z, wave.radius, Infinity);
  if (wave.radius >= distanceToFarthestCorner(field, wave.x, wave.z)) game.status = 'won';
  return { cutIndices, sizesGained: 0 };
}

function distanceToFarthestCorner(field: Field, x: number, z: number): number {
  return Math.hypot(Math.max(x, field.width - x), Math.max(z, field.depth - z));
}

/** Target blades still standing. */
export function remainingTargets(game: Game): number {
  const { field, targetType } = game;
  return field.countByType[targetType]! - field.cutByType[targetType]!;
}

/** Fraction of the target blades cut, from 0 to 1. */
export function targetProgress(game: Game): number {
  const { field, targetType } = game;
  return field.cutByType[targetType]! / field.countByType[targetType]!;
}

/** The last few target blades glow so the player can find them. */
export function shouldHighlightTargets(game: Game): boolean {
  const remaining = remainingTargets(game);
  return game.status === 'playing' && remaining > 0 && remaining < config.level.highlightBelow;
}

/** Debug shortcut: cuts every standing target blade, so the next step starts the win wave. */
export function cutAllTargets(game: Game): number[] {
  const { field, targetType } = game;
  const cutIndices: number[] = [];
  for (let blade = 0; blade < field.bladeCount; blade++) {
    if (field.types[blade] === targetType && field.cut[blade] === 0) {
      cutBlade(field, blade);
      cutIndices.push(blade);
    }
  }
  if (game.status === 'ready') game.status = 'playing';
  return cutIndices;
}
