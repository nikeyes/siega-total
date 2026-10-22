import { config } from '../config';
import { difficultyFor, type Difficulty } from './difficulty';
import type { GrassType } from './field';
import { clearCellsUnderSolidObstacles, clearStart, type LevelDefinition, type Obstacle, type ObstacleType, type TargetKind } from './levels';
import { obstacleRadius } from './obstacles';
import { PATTERNS, SAND_REGION, type PatternName } from './patterns';
import { createRandom } from './random';
import { estimateSeconds } from './validation';

export type GeneratedLevel = LevelDefinition & { pattern: PatternName };

/** Tries for each obstacle before giving it up. */
const PLACEMENT_TRIES = 20;
/** The generator draws levels on 1 m cells. */
const CELL_SIZE = 1;
/** Levels up to this one only ask for green; the next ones each bring something new to ask for. */
const LAST_GREEN_ONLY_LEVEL = 1;

/** A level for `levelNumber` from `seed`; not validated. */
export function generateLevel(levelNumber: number, seed: number): GeneratedLevel {
  const random = createRandom(seed);
  const difficulty = difficultyFor(levelNumber);
  const { width, depth } = config.field;
  const columns = width / CELL_SIZE;
  const rows = depth / CELL_SIZE;

  const patternNames = Object.keys(PATTERNS) as PatternName[];
  const pattern = pick(random, patternNames);
  const regionCount = Math.max(config.generator.minPatternRegions, difficulty.grassTypeCount);
  const map = PATTERNS[pattern](random, { columns, rows, regionCount });
  const typeOfRegion = grassTypesForRegions(random, difficulty);
  // Regions past the level's grass types are sand.
  const cells = Array.from(map.regions, (region): GrassType | null => (region === SAND_REGION ? null : (typeOfRegion[region] ?? null)));
  clearStart(cells, CELL_SIZE, columns, rows, config.generator.startClearingMeters);

  const obstacles = placeObstacles(random, difficulty, cells, columns);
  clearCellsUnderSolidObstacles(cells, CELL_SIZE, columns, obstacles);

  const level: LevelDefinition = {
    number: levelNumber,
    seed,
    width,
    depth,
    cellSize: CELL_SIZE,
    cells,
    obstacles,
    targets: chooseTargets(random, difficulty, cells, obstacles),
    timeSeconds: 0,
  };
  return { ...level, timeSeconds: levelTime(level, difficulty), pattern };
}

/** Stripes of the first unlocked grass, all of it the target: for when no seed gives a valid level. */
export function fallbackLevel(levelNumber: number): GeneratedLevel {
  const difficulty = difficultyFor(levelNumber);
  const [type] = difficulty.grassTypes;
  const { width, depth } = config.field;
  const columns = width / CELL_SIZE;
  const rows = depth / CELL_SIZE;
  const cells = Array<GrassType | null>(columns * rows).fill(type!);
  clearStart(cells, CELL_SIZE, columns, rows, config.generator.startClearingMeters);
  const level: LevelDefinition = {
    number: levelNumber,
    seed: config.field.seed,
    width,
    depth,
    cellSize: CELL_SIZE,
    cells,
    obstacles: [],
    targets: [type!],
    timeSeconds: 0,
  };
  return { ...level, timeSeconds: levelTime(level, difficultyFor(1)), pattern: 'stripes' };
}

/** The grass type of each region: the new grass, if any, plus other unlocked types, in random order. */
function grassTypesForRegions(random: () => number, difficulty: Difficulty): GrassType[] {
  const { newElement, grassTypes, grassTypeCount } = difficulty;
  const newGrass = grassTypes.find((type) => type === newElement);
  const others = shuffle(random, grassTypes.filter((type) => type !== newGrass));
  const chosen = newGrass ? [newGrass, ...others] : others;
  return shuffle(random, chosen.slice(0, grassTypeCount));
}

/** Rocks, then cacti, then fruit at random free spots, giving up a piece after PLACEMENT_TRIES. */
function placeObstacles(random: () => number, difficulty: Difficulty, cells: readonly (GrassType | null)[], columns: number): Obstacle[] {
  const { width, depth } = config.field;
  const { startClearingMeters, obstacleGapMeters } = config.generator;
  const wanted: (() => ObstacleType)[] = [
    ...Array<() => ObstacleType>(difficulty.rockCount).fill(() => 'rock'),
    ...Array<() => ObstacleType>(difficulty.cactusCount).fill(() => 'cactus'),
    ...Array<() => ObstacleType>(difficulty.fruitCount).fill(() => (random() < 0.5 ? 'watermelon' : 'strawberry')),
  ];
  const placed: Obstacle[] = [];
  for (const typeOf of wanted) {
    const type = typeOf();
    const radius = obstacleRadius(type);
    const isFruit = type === 'watermelon' || type === 'strawberry';
    // A rock or cactus leaves room to go round it between itself and the edge; fruit is cut, not gone round.
    const edgeGap = isFruit ? 0 : obstacleGapMeters;
    for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++) {
      const x = radius + edgeGap + random() * (width - 2 * (radius + edgeGap));
      const z = radius + edgeGap + random() * (depth - 2 * (radius + edgeGap));
      const outsideClearing = Math.hypot(x - width / 2, z - depth / 2) > startClearingMeters / 2 + radius;
      const onGrass = !isFruit || cells[Math.floor(z / CELL_SIZE) * columns + Math.floor(x / CELL_SIZE)] !== null;
      const apart = placed.every(
        (other) => Math.hypot(other.x - x, other.z - z) >= radius + obstacleRadius(other.type) + obstacleGapMeters,
      );
      if (!outsideClearing || !onGrass || !apart) continue;
      placed.push({ type, x, z });
      break;
    }
  }
  return placed;
}

function chooseTargets(
  random: () => number,
  difficulty: Difficulty,
  cells: readonly (GrassType | null)[],
  obstacles: readonly Obstacle[],
): TargetKind[] {
  const { newElement, levelNumber, targetCount } = difficulty;
  const countOf = (type: ObstacleType) => obstacles.filter((obstacle) => obstacle.type === type).length;
  if (newElement === 'fruit') return [countOf('strawberry') > countOf('watermelon') ? 'strawberry' : 'watermelon'];
  if (newElement !== null && newElement !== 'rock') return [newElement];
  if (levelNumber <= LAST_GREEN_ONLY_LEVEL) return ['green'];
  const grassPresent = [...new Set(cells.filter((type): type is GrassType => type !== null))];
  const piecesPresent = [...new Set(obstacles.map(({ type }) => type))].filter(
    (type): type is Exclude<ObstacleType, 'rock'> => type !== 'rock',
  );
  return shuffle(random, [...grassPresent, ...piecesPresent]).slice(0, Math.max(1, targetCount));
}

/** The estimate times the level's margin, rounded up to roundTimeToSeconds, plus extraSeconds. */
function levelTime(level: LevelDefinition, difficulty: Difficulty): number {
  const { roundTimeToSeconds, extraSeconds } = config.generator;
  return Math.ceil((estimateSeconds(level) * difficulty.timeMargin) / roundTimeToSeconds) * roundTimeToSeconds + extraSeconds;
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

/** Fisher–Yates on a copy. */
function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled;
}
