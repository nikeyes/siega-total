import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import type { Direction } from '../../src/logic/blade';
import { applyBooster, buyBooster, canUseBooster, continueWithClock, nearestTarget, useBooster } from '../../src/logic/boosters';
import { bankCoins } from '../../src/logic/economy';
import { defaultSave } from '../../src/logic/save';
import { cutInCircle, GRASS_TYPE_ORDER } from '../../src/logic/field';
import { createGame, cutAllTargets, resetGame, stepGame, type Game, type GameStatus } from '../../src/logic/game';
import { levelFromRows } from './levelFixtures';

const SIXTY_FPS_FRAME = 1 / 60;
const EAST: Direction = { x: 1, z: 0 };

/** 20 × 2 m of sand with one ice cell, the target, in the west corner: a blade driving east stays in play. */
const OPEN_SAND = ['i' + '.'.repeat(19), '.'.repeat(20)];

function playingGame(): Game {
  const game = createGame(levelFromRows(OPEN_SAND));
  stepGame(game, EAST, SIXTY_FPS_FRAME);
  return game;
}

/** Gives up after a minute of game time, so a game that never gets there fails instead of hanging. */
function driveEastUntil(game: Game, status: GameStatus) {
  for (let step = 0; game.status !== status; step++) {
    if (step >= 60 / SIXTY_FPS_FRAME) expect.fail(`the game did not reach ${status}; it is ${game.status}`);
    stepGame(game, EAST, SIXTY_FPS_FRAME);
  }
}

function gameIn(status: GameStatus): Game {
  const game = playingGame();
  game.status = status;
  return game;
}

describe('upgrade booster', () => {
  it('grows the blade by its sizes at once while playing', () => {
    const game = playingGame();
    const { size } = game.blade;
    expect(applyBooster(game, 'upgrade')).toBe(true);
    expect(game.blade.size).toBe(size + config.boosters.upgrade.sizes);
  });

  it('keeps the progress toward the next size', () => {
    const game = playingGame();
    game.blade.growthProgress = 42;
    applyBooster(game, 'upgrade');
    expect(game.blade.growthProgress).toBe(42);
  });

  it('does nothing once the level is won', () => {
    const game = gameIn('won');
    const { size } = game.blade;
    expect(applyBooster(game, 'upgrade')).toBe(false);
    expect(game.blade.size).toBe(size);
  });
});

describe('clock booster', () => {
  const { seconds } = config.boosters.clock;

  it('adds its seconds while playing and raises the full time so the ring stays within 100 %', () => {
    const game = playingGame();
    const { timeLeft } = game;
    expect(applyBooster(game, 'clock')).toBe(true);
    expect(game.timeLeft).toBeCloseTo(timeLeft + seconds, 9);
    expect(game.timeTotal).toBe(Math.max(game.level.timeSeconds, game.timeLeft));
  });

  it('after a defeat, plays on with its seconds and the field as it was', () => {
    const game = createGame(levelFromRows(OPEN_SAND.map((row) => row.replace(/\./g, 'g')), { timeSeconds: 0.5 }));
    driveEastUntil(game, 'lost');
    const { cutCount } = game.field;
    expect(applyBooster(game, 'clock')).toBe(true);
    expect(game.status).toBe('playing');
    expect(game.timeLeft).toBe(seconds);
    expect(game.field.cutCount).toBe(cutCount);
    expect(cutCount).toBeGreaterThan(0);
  });

  it('does nothing once the level is won', () => {
    const game = gameIn('won');
    const { timeLeft } = game;
    expect(applyBooster(game, 'clock')).toBe(false);
    expect(game.timeLeft).toBe(timeLeft);
  });
  it('lets the clock add time before the first move', () => {
    const game = createGame(levelFromRows(OPEN_SAND));
    expect(applyBooster(game, 'clock')).toBe(true);
    expect([game.status, game.timeLeft, game.timeTotal]).toEqual([
      'ready',
      game.level.timeSeconds + config.boosters.clock.seconds,
      game.level.timeSeconds + config.boosters.clock.seconds,
    ]);
  });

  it('keeps the full time when the clock adds less than the time already gone', () => {
    const game = playingGame();
    game.timeLeft = 1;
    applyBooster(game, 'clock');
    expect(game.timeTotal).toBe(game.level.timeSeconds);
    expect(game.timeLeft).toBe(1 + config.boosters.clock.seconds);
  });

});

describe('compass booster', () => {
  const { seconds } = config.boosters.compass;

  it('points for its seconds', () => {
    const game = playingGame();
    expect(applyBooster(game, 'compass')).toBe(true);
    expect(game.compassLeft).toBe(seconds);
  });

  it('cannot be used again while it still points', () => {
    const game = playingGame();
    applyBooster(game, 'compass');
    stepGame(game, EAST, 1);
    expect(canUseBooster(game, 'compass')).toBe(false);
    expect(applyBooster(game, 'compass')).toBe(false);
    expect(game.compassLeft).toBeCloseTo(seconds - 1, 9);
  });

  it('counts down while playing and stops at 0, so it can be used again', () => {
    const game = playingGame();
    applyBooster(game, 'compass');
    stepGame(game, EAST, seconds + 1);
    expect(game.compassLeft).toBe(0);
    expect(canUseBooster(game, 'compass')).toBe(true);
  });

  it('switches off when the level is lost', () => {
    const game = createGame(levelFromRows(OPEN_SAND, { timeSeconds: 0.5 }));
    applyBooster(game, 'compass');
    driveEastUntil(game, 'lost');
    expect(game.compassLeft).toBe(0);
  });

  it('switches off when the last target falls', () => {
    const game = createGame(levelFromRows(['gggiii']));
    applyBooster(game, 'compass');
    driveEastUntil(game, 'winWave');
    expect(game.compassLeft).toBe(0);
  });

  it('does not count down before the first move', () => {
    const game = createGame(levelFromRows(OPEN_SAND));
    applyBooster(game, 'compass');
    stepGame(game, null, 1);
    expect(game.compassLeft).toBe(seconds);
  });
  it('switches off when the level restarts', () => {
    const game = playingGame();
    applyBooster(game, 'compass');
    resetGame(game);
    expect(game.compassLeft).toBe(0);
  });

});

describe('using a booster from the save', () => {
  it('spends one use and applies it', () => {
    const save = defaultSave();
    const game = playingGame();
    const { size } = game.blade;
    expect(useBooster(save, game, 'upgrade')).toBe(true);
    expect(save.boosters.upgrade).toBe(config.boosters.upgrade.startUses - 1);
    expect(game.blade.size).toBe(size + config.boosters.upgrade.sizes);
  });

  it('changes nothing without uses left', () => {
    const save = defaultSave();
    save.boosters.upgrade = 0;
    const game = playingGame();
    const { size } = game.blade;
    expect(useBooster(save, game, 'upgrade')).toBe(false);
    expect([save.boosters.upgrade, game.blade.size]).toEqual([0, size]);
  });

  it('keeps the use when the booster cannot be used now', () => {
    const save = defaultSave();
    expect(useBooster(save, gameIn('won'), 'upgrade')).toBe(false);
    expect(save.boosters.upgrade).toBe(config.boosters.upgrade.startUses);
  });
  it('keeps the compass use when it already points', () => {
    const save = defaultSave();
    const game = playingGame();
    useBooster(save, game, 'compass');
    expect(useBooster(save, game, 'compass')).toBe(false);
    expect(save.boosters.compass).toBe(config.boosters.compass.startUses - 1);
  });

});

describe('buying a booster', () => {
  it('spends its price and adds one use', () => {
    const save = { ...defaultSave(), coins: config.boosters.compass.price };
    expect(buyBooster(save, 'compass')).toBe(true);
    expect(save.coins).toBe(0);
    expect(save.boosters.compass).toBe(config.boosters.compass.startUses + 1);
  });

  it('changes nothing without enough coins', () => {
    const save = { ...defaultSave(), coins: config.boosters.compass.price - 1 };
    const before = structuredClone(save);
    expect(buyBooster(save, 'compass')).toBe(false);
    expect(save).toEqual(before);
  });
});

describe('continuing a defeat with a clock', () => {
  function lostGame(): Game {
    const game = createGame(levelFromRows(OPEN_SAND, { timeSeconds: 0.5 }));
    driveEastUntil(game, 'lost');
    return game;
  }

  it('uses a clock when there is one', () => {
    const save = defaultSave();
    const game = lostGame();
    expect(continueWithClock(save, game)).toBe(true);
    expect(game.status).toBe('playing');
    expect(save.boosters.clock).toBe(config.boosters.clock.startUses - 1);
  });

  it('without clocks, buys one with the coins and uses it, leaving none', () => {
    const save = { ...defaultSave(), coins: config.boosters.clock.price };
    save.boosters.clock = 0;
    const game = lostGame();
    expect(continueWithClock(save, game)).toBe(true);
    expect(game.status).toBe('playing');
    expect([save.coins, save.boosters.clock]).toEqual([0, 0]);
  });

  it('without clocks or coins, changes nothing', () => {
    const save = { ...defaultSave(), coins: config.boosters.clock.price - 1 };
    save.boosters.clock = 0;
    const before = structuredClone(save);
    const game = lostGame();
    expect(continueWithClock(save, game)).toBe(false);
    expect(game.status).toBe('lost');
    expect(save).toEqual(before);
  });

  it('banks only the coins cut after continuing, plus the bonus, when the level is then won', () => {
    const save = defaultSave();
    const game = createGame(levelFromRows(['ggggggiiii'], { timeSeconds: 0.5 }));
    driveEastUntil(game, 'lost');
    const bankedAtDefeat = bankCoins(game);
    continueWithClock(save, game);
    driveEastUntil(game, 'won');
    expect(bankCoins(game)).toBe(game.levelCoins - bankedAtDefeat + game.bonusCoins);
  });
  it('does not buy a clock to continue a level that was won', () => {
    const save = { ...defaultSave(), coins: config.boosters.clock.price };
    save.boosters.clock = 0;
    const before = structuredClone(save);
    expect(continueWithClock(save, gameIn('won'))).toBe(false);
    expect(save).toEqual(before);
  });

  it('runs out again after continuing, and the compass is off then', () => {
    const save = defaultSave();
    const game = createGame(levelFromRows(OPEN_SAND, { timeSeconds: 0.5 }));
    driveEastUntil(game, 'lost');
    continueWithClock(save, game);
    useBooster(save, game, 'compass');
    for (let step = 0; step < (config.boosters.clock.seconds + 1) / SIXTY_FPS_FRAME && game.status === 'playing'; step++) {
      stepGame(game, EAST, SIXTY_FPS_FRAME);
    }
    expect(game.status).toBe('lost');
    expect(game.compassLeft).toBe(0);
  });

});

describe('nearest target', () => {
  /** 6 × 1 m: green, then one ice cell, the target, then green again. */
  const ICE_IN_THE_MIDDLE = ['ggigg.'];

  function standingIceDistances(game: Game, x: number, z: number): number[] {
    const { field } = game;
    const ice = GRASS_TYPE_ORDER.indexOf('ice');
    const distances: number[] = [];
    for (let blade = 0; blade < field.bladeCount; blade++) {
      if (field.types[blade] === ice && field.cut[blade] === 0) {
        distances.push(Math.hypot(field.positionsX[blade]! - x, field.positionsZ[blade]! - z));
      }
    }
    return distances;
  }

  it('finds the closest standing target blade, ignoring other grass', () => {
    const game = createGame(levelFromRows(ICE_IN_THE_MIDDLE));
    const target = nearestTarget(game, 0, 0.5)!;
    expect(target.x).toBeGreaterThanOrEqual(2);
    expect(target.x).toBeLessThanOrEqual(3);
    expect(Math.hypot(target.x, target.z - 0.5)).toBeCloseTo(Math.min(...standingIceDistances(game, 0, 0.5)), 6);
  });

  it('ignores target blades already cut', () => {
    const game = createGame(levelFromRows(ICE_IN_THE_MIDDLE));
    cutInCircle(game.field, 2, 0.5, 0.5, Infinity);
    const target = nearestTarget(game, 0, 0.5)!;
    expect(Math.hypot(target.x, target.z - 0.5)).toBeCloseTo(Math.min(...standingIceDistances(game, 0, 0.5)), 6);
    expect(Math.hypot(target.x - 2, target.z - 0.5)).toBeGreaterThan(0.5);
  });

  it('finds a target piece when it is closer than any target blade', () => {
    const strawberry = { type: 'strawberry' as const, x: 5.5, z: 0.5 };
    const game = createGame(levelFromRows(ICE_IN_THE_MIDDLE, { obstacles: [strawberry], targets: ['ice', 'strawberry'] }));
    expect(nearestTarget(game, 5.9, 0.5)).toEqual({ x: strawberry.x, z: strawberry.z });
  });

  it('ignores pieces that are not targets and pieces already cut', () => {
    const obstacles = [
      { type: 'strawberry' as const, x: 5.5, z: 0.5 },
      { type: 'watermelon' as const, x: 5.5, z: 0.5 },
    ];
    const game = createGame(levelFromRows(ICE_IN_THE_MIDDLE, { obstacles, targets: ['ice', 'strawberry'] }));
    game.obstacles.cut[0] = 1;
    expect(nearestTarget(game, 5.9, 0.5)!.x).toBeLessThanOrEqual(3);
  });

  it('finds nothing once every target is cut', () => {
    const game = createGame(levelFromRows(ICE_IN_THE_MIDDLE));
    cutAllTargets(game);
    expect(nearestTarget(game, 0, 0.5)).toBeNull();
  });
});

describe('when boosters cannot be used', () => {
  it.each(['upgrade', 'compass', 'clock'] as const)('does not use %s during the win wave', (kind) => {
    expect(canUseBooster(gameIn('winWave'), kind)).toBe(false);
  });

  it.each(['upgrade', 'compass'] as const)('does not use %s after a defeat', (kind) => {
    expect(canUseBooster(gameIn('lost'), kind)).toBe(false);
  });
});
