import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { addCuts, cutsToNextSize } from '../../src/logic/blade';
import { isHardCell } from '../../src/logic/collision';
import { createGame, stepGame, type Game } from '../../src/logic/game';
import { cuttingSpeedFactor, grassCutSize } from '../../src/logic/grass';
import { levelFromRows } from '../logic/levelFixtures';

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

describe('tough grass in the nueva build', () => {
  it('can be cut one size before its minimum size', () => {
    expect(grassCutSize('wheat')).toBe(1);
    expect(grassCutSize('bramble')).toBe(config.grassTypes.bramble.minSize - 1);
  });

  it('is still a wall two sizes before its minimum size', () => {
    const level = levelFromRows(['b']);
    expect(isHardCell(level, 0, config.grassTypes.bramble.minSize - 2)).toBe(true);
    expect(isHardCell(level, 0, config.grassTypes.bramble.minSize - 1)).toBe(false);
  });

  it('slows the blade that cuts it one size early, and not one big enough for it', () => {
    expect(cuttingSpeedFactor('wheat', 1)).toBeLessThan(0.6);
    expect(cuttingSpeedFactor('wheat', 2)).toBe(1);
    expect(cuttingSpeedFactor('green', 1)).toBe(1);
  });

  it('makes a blade cutting through it one size early cover less ground than over grass it is big enough for', () => {
    const throughWheat = metersIn(gameOnStrip('w', 1), 1);
    const throughGreen = metersIn(gameOnStrip('g', 1), 1);
    expect(throughWheat).toBeGreaterThan(0);
    expect(throughWheat).toBeLessThan(throughGreen * 0.7);
  });
});
