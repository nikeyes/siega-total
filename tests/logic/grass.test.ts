import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { addCuts, cutsToNextSize } from '../../src/logic/blade';
import { isHardCell } from '../../src/logic/collision';
import { createGame, stepGame, type Game } from '../../src/logic/game';
import { grassCutSize, isCutSlowly } from '../../src/logic/grass';
import { levelFromRows } from './levelFixtures';

const EAST = { x: 1, z: 0 };
const FRAME = 1 / 60;

/** A blade at the west end of a strip of one grass, 1 m from the start, heading east. */
function gameOnStrip(letter: string, size: number): Game {
  const game = createGame(levelFromRows(['g' + letter.repeat(9), 'i' + 'g'.repeat(9)]));
  game.blade.x = 1.2;
  game.blade.z = 0.5;
  for (let current = game.blade.size; current < size; current++) addCuts(game.blade, cutsToNextSize(current));
  return game;
}

function metersIn(game: Game, seconds: number): number {
  const start = game.blade.x;
  for (let time = 0; time < seconds; time += FRAME) stepGame(game, EAST, FRAME);
  return game.blade.x - start;
}

describe('grassCutSize', () => {
  it('is one size before the minimum size of tough grass, never below the starting size', () => {
    expect(grassCutSize('green')).toBe(config.blade.startSize);
    expect(grassCutSize('wheat')).toBe(1);
    expect(grassCutSize('bramble')).toBe(config.grassTypes.bramble.minSize - 1);
  });
});

describe('tough grass', () => {
  it('is still a wall two sizes before its minimum size', () => {
    const level = levelFromRows(['b']);
    expect(isHardCell(level, 0, config.grassTypes.bramble.minSize - 2)).toBe(true);
    expect(isHardCell(level, 0, config.grassTypes.bramble.minSize - 1)).toBe(false);
  });

  it('is cut slowly by a blade one size short of it, and not by one big enough for it', () => {
    expect(isCutSlowly('wheat', 1)).toBe(true);
    expect(isCutSlowly('wheat', 2)).toBe(false);
    expect(isCutSlowly('green', 1)).toBe(false);
  });

  it('makes a blade cutting through it one size early cover less ground than over grass it is big enough for', () => {
    const throughWheat = metersIn(gameOnStrip('w', 1), 1);
    const throughGreen = metersIn(gameOnStrip('g', 1), 1);
    expect(throughWheat).toBeGreaterThan(0);
    expect(throughWheat).toBeLessThan(throughGreen * 0.7);
  });

  it('does not hold back a blade big enough for it', () => {
    expect(metersIn(gameOnStrip('w', 2), 1)).toBeCloseTo(metersIn(gameOnStrip('g', 2), 1), 5);
  });
});
