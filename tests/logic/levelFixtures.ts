import { config } from '../../src/config';
import type { GrassType } from '../../src/logic/field';
import type { Game } from '../../src/logic/game';
import type { LevelDefinition } from '../../src/logic/levels';
import { obstacleHits } from '../../src/logic/obstacles';

const GRASS_BY_LETTER: Record<string, GrassType | null> = { g: 'green', i: 'ice', w: 'wheat', l: 'lavender', b: 'bramble', '.': null };

/**
 * A level of 1 m cells drawn row by row, north to south: `g` green, `i` ice, `w` wheat,
 * `l` lavender, `b` bramble and `.` sand. Ice is the target unless `overrides` says otherwise.
 */
export function levelFromRows(rows: string[], overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    number: 0,
    seed: config.field.seed,
    width: rows[0]!.length,
    depth: rows.length,
    cellSize: 1,
    cells: rows.flatMap((row) => [...row].map((letter) => GRASS_BY_LETTER[letter]!)),
    obstacles: [],
    targets: ['ice'],
    timeSeconds: config.level.timeSeconds,
    ...overrides,
  };
}

/** Lands all but the last blow on every obstacle, so the next touch breaks it: for tests about cutting, not hitting. */
export function oneBlowFromBreaking(game: Game): void {
  game.obstacles.obstacles.forEach(({ type }, index) => (game.obstacles.hitsTaken[index] = obstacleHits(type) - 1));
}
