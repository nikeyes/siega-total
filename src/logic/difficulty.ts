import { config } from '../config';
import { GRASS_TYPE_ORDER, type GrassType } from './field';
import type { ObstacleType } from './levels';

export type Unlockable = keyof typeof config.generator.unlockLevel;

export interface Difficulty {
  levelNumber: number;
  /** Unlocked grass types, in order of appearance. */
  grassTypes: GrassType[];
  /** Unlocked obstacle types, in order of appearance; fruit unlocks both kinds. */
  obstacleTypes: ObstacleType[];
  /** The element introduced at exactly this level, if any. */
  newElement: Unlockable | null;
  grassTypeCount: number;
  targetCount: number;
  rockCount: number;
  fruitCount: number;
  cactusCount: number;
  timeMargin: number;
}

/** The obstacle types each unlockable obstacle brings. */
const OBSTACLES_OF: Partial<Record<Unlockable, ObstacleType[]>> = {
  rock: ['rock'],
  fruit: ['watermelon', 'strawberry'],
  cactus: ['cactus'],
};

/** Linear from `first` at level 1 to `last` at curveLastLevel, then flat. */
export function curveValue(range: { first: number; last: number }, levelNumber: number): number {
  const progress = Math.min(1, Math.max(0, (levelNumber - 1) / (config.generator.curveLastLevel - 1)));
  return range.first + (range.last - range.first) * progress;
}

export function difficultyFor(levelNumber: number): Difficulty {
  const generator = config.generator;
  const unlocked = (Object.keys(generator.unlockLevel) as Unlockable[])
    .filter((element) => generator.unlockLevel[element] <= levelNumber)
    .sort((a, b) => generator.unlockLevel[a] - generator.unlockLevel[b]);
  const isUnlocked = (element: Unlockable) => unlocked.includes(element);
  const grassTypes = unlocked.filter((element): element is GrassType => (GRASS_TYPE_ORDER as readonly string[]).includes(element));
  const countIfUnlocked = (element: Unlockable, range: { first: number; last: number }) =>
    isUnlocked(element) ? Math.round(curveValue(range, levelNumber)) : 0;
  const newElement = unlocked.find((element) => generator.unlockLevel[element] === levelNumber) ?? null;
  const grassTypeCount = Math.min(Math.round(curveValue(generator.grassTypeCount, levelNumber)), grassTypes.length);
  return {
    levelNumber,
    grassTypes,
    obstacleTypes: unlocked.flatMap((element) => OBSTACLES_OF[element] ?? []),
    newElement,
    // The blade has to grow on another grass before it can cut a new one too tough for its starting size.
    grassTypeCount: isToughGrass(newElement) ? Math.max(2, grassTypeCount) : grassTypeCount,
    targetCount: Math.round(curveValue(generator.targetCount, levelNumber)),
    rockCount: countIfUnlocked('rock', generator.rockCount),
    fruitCount: countIfUnlocked('fruit', generator.fruitCount),
    cactusCount: countIfUnlocked('cactus', generator.cactusCount),
    timeMargin: curveValue(generator.timeMargin, levelNumber),
  };
}

/** A grass the blade cannot cut at its starting size. */
function isToughGrass(element: Unlockable | null): boolean {
  return element !== null && element in config.grassTypes && config.grassTypes[element as GrassType].minSize > config.blade.startSize;
}
