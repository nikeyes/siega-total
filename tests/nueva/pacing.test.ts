import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { continueWithClock } from '../../src/logic/boosters';
import { cameraDistanceFor, targetDistance, verticalFovDegrees } from '../../src/logic/camera';
import { curveValue, difficultyFor } from '../../src/logic/difficulty';
import { createGame, stepGame, type Game } from '../../src/logic/game';
import { defaultSave } from '../../src/logic/save';
import { levelFromRows } from '../logic/levelFixtures';

const PHONE_ASPECT = 390 / 844;

/** Ice in the far west corner, the blade driving east away from it. */
const ICE_BEHIND = ['i' + '.'.repeat(19), '.'.repeat(20)];

function driveUntilLost(game: Game) {
  for (let step = 0; game.status !== 'lost'; step++) {
    if (step >= 60 * 60) expect.fail(`the game did not reach lost; it is ${game.status}`);
    stepGame(game, { x: 1, z: 0 }, 1 / 60);
  }
}

function lostGame(): Game {
  const game = createGame(levelFromRows(ICE_BEHIND, { timeSeconds: 0.5 }));
  driveUntilLost(game);
  return game;
}

function brokeSave() {
  const save = { ...defaultSave(), coins: 0 };
  save.boosters.clock = 0;
  return save;
}

describe('pacing in the nueva build', () => {
  it('lets each attempt continue once for free, without clocks or coins', () => {
    const save = brokeSave();
    const game = lostGame();
    expect(continueWithClock(save, game)).toBe(true);
    expect(game.status).toBe('playing');
    expect(save).toEqual(brokeSave());
  });

  it('asks for a clock on the second continue of the same attempt', () => {
    const save = brokeSave();
    const game = lostGame();
    continueWithClock(save, game);
    driveUntilLost(game);
    expect(continueWithClock(save, game)).toBe(false);
  });

  it('shows the whole field before the first move, then follows the blade', () => {
    const { width, depth } = config.field;
    const overview = cameraDistanceFor('ready', 1, width, depth, PHONE_ASPECT);
    const halfVisibleZ = overview * Math.tan(((verticalFovDegrees(PHONE_ASPECT) * Math.PI) / 180) / 2);
    expect(halfVisibleZ).toBeGreaterThanOrEqual(depth / 2);
    expect(halfVisibleZ * PHONE_ASPECT).toBeGreaterThanOrEqual(width / 2);
    expect(cameraDistanceFor('playing', 1, width, depth, PHONE_ASPECT)).toBe(targetDistance(1));
  });

  it('gives harder levels less time and easier ones more, in a cycle that averages out', () => {
    const margins = Array.from({ length: 10 }, (_, index) => difficultyFor(30 + index).timeMargin / curveValue(config.generator.timeMargin, 30 + index));
    expect(Math.min(...margins)).toBeLessThan(1);
    expect(Math.max(...margins)).toBeGreaterThan(1);
    expect(margins.reduce((sum, margin) => sum + margin, 0) / margins.length).toBeCloseTo(1, 1);
  });
});
