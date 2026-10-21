import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { bankCoins, coinsForCuts, timeBonus } from '../../src/logic/economy';
import type { Direction } from '../../src/logic/blade';
import { GRASS_TYPE_ORDER } from '../../src/logic/field';
import { createGame, cutAllTargets, resetGame, stepGame, type Game, type GameStatus, type StepResult } from '../../src/logic/game';
import { levelFromRows } from './levelFixtures';

const SIXTY_FPS_FRAME = 1 / 60;
const FRAMES_IN_ONE_SECOND = 1 / SIXTY_FPS_FRAME;
const EAST: Direction = { x: 1, z: 0 };
const HALF_A_SECOND = 0.5;
const ONE_MINUTE = 60;

/**
 * 6 × 1 m: green with a rock and a strawberry in the west half, behind the blade,
 * and ice, the target, in the east half, ahead of a blade that drives east.
 */
function iceAheadFruitAndRockBehind(): Game {
  const obstacles = [
    { type: 'rock' as const, x: 0.5, z: 0.5 },
    { type: 'strawberry' as const, x: 2, z: 0.5 },
  ];
  return createGame(levelFromRows(['gggiii'], { obstacles }));
}

/** 6 × 1 m with the ice behind the blade, out of its reach: the blade cuts some green and runs out of time. */
function lostAfterCuttingSome(): Game {
  const game = createGame(levelFromRows(['iiiggg'], { timeSeconds: HALF_A_SECOND }));
  driveEastUntil(game, 'lost');
  return game;
}

/** Loses with part of the ice still ahead, banks the defeat, then continues with more time until the win. */
function wonAfterContinuingADefeat(): { game: Game; bankedAtDefeat: number } {
  const game = createGame(levelFromRows(['ggggggiiii'], { timeSeconds: HALF_A_SECOND }));
  driveEastUntil(game, 'lost');
  const bankedAtDefeat = bankCoins(game);
  game.status = 'playing';
  game.timeLeft = ONE_MINUTE;
  driveEastUntil(game, 'won');
  return { game, bankedAtDefeat };
}

/** Gives up after a minute of game time, so a game that never gets there fails instead of hanging. */
function driveEastUntil(game: Game, status: GameStatus, onStep: (result: StepResult) => void = () => {}) {
  for (let step = 0; game.status !== status; step++) {
    if (step >= ONE_MINUTE * FRAMES_IN_ONE_SECOND) expect.fail(`the game did not reach ${status}; it is ${game.status}`);
    onStep(stepGame(game, EAST, SIXTY_FPS_FRAME));
  }
}

function allBlades(game: Game): number[] {
  return Array.from({ length: game.field.bladeCount }, (_, blade) => blade);
}

function coinsOfAllGrass(game: Game, ...types: ('green' | 'ice')[]): number {
  return types.reduce((coins, type) => coins + game.field.countByType[GRASS_TYPE_ORDER.indexOf(type)]! * config.grassTypes[type].coins, 0);
}

describe('coins for cuts', () => {
  it('pays the coins of its grass type for each blade cut', () => {
    const game = createGame(levelFromRows(['gg']));
    expect(coinsForCuts(game, allBlades(game), [])).toBe(game.field.bladeCount * config.grassTypes.green.coins);
  });

  it('pays more for tougher grass', () => {
    const game = createGame(levelFromRows(['ww']));
    expect(coinsForCuts(game, allBlades(game), [])).toBe(game.field.bladeCount * config.grassTypes.wheat.coins);
  });

  it('pays the coins of a cut strawberry and nothing for a rock', () => {
    const obstacles = [
      { type: 'strawberry' as const, x: 0.5, z: 0.5 },
      { type: 'rock' as const, x: 1.5, z: 0.5 },
    ];
    const game = createGame(levelFromRows(['..'], { obstacles, targets: ['strawberry'] }));
    expect(coinsForCuts(game, [], [0])).toBe(config.obstacles.strawberry.coins);
    expect(coinsForCuts(game, [], [1])).toBe(0);
  });

  it('pays nothing for a step that cuts nothing', () => {
    const game = createGame(levelFromRows(['gg']));
    expect(coinsForCuts(game, [], [])).toBe(0);
  });
});

describe('time bonus', () => {
  it('pays for each whole second left', () => {
    expect(timeBonus(40.9)).toBe(40 * config.economy.coinsPerSecondLeft);
  });

  it('gives nothing for less than a whole second left', () => {
    expect(timeBonus(0)).toBe(0);
    expect(timeBonus(0.99)).toBe(0);
  });
});

describe('coins of a won level', () => {
  it('holds the coins of everything cuttable and the bonus for the time left', () => {
    const game = iceAheadFruitAndRockBehind();
    driveEastUntil(game, 'won');
    expect(game.levelCoins).toBe(coinsOfAllGrass(game, 'green', 'ice') + config.obstacles.strawberry.coins);
    expect(game.bonusCoins).toBe(timeBonus(game.timeLeft));
    expect(game.bonusCoins).toBeGreaterThan(0);
  });

  it('adds up the coins of every step, the win wave included', () => {
    const game = iceAheadFruitAndRockBehind();
    let stepCoins = 0;
    driveEastUntil(game, 'won', ({ coins }) => (stepCoins += coins));
    expect(stepCoins).toBe(game.levelCoins);
  });

  it('never gives a negative bonus when the last target falls in the step that runs out of time', () => {
    const obstacles = [{ type: 'strawberry' as const, x: 2, z: 1 }];
    const game = createGame(levelFromRows(['....', '....'], { obstacles, targets: ['strawberry'], timeSeconds: SIXTY_FPS_FRAME / 2 }));
    game.blade.size = config.obstacles.strawberry.minSize;
    stepGame(game, EAST, SIXTY_FPS_FRAME);
    expect(game.status).toBe('winWave');
    expect(game.bonusCoins).toBe(0);
  });

  it('pays nothing for targets cut with the debug shortcut, but the win wave still pays the rest', () => {
    const game = createGame(levelFromRows(['gggiii']));
    cutAllTargets(game);
    expect(game.levelCoins).toBe(0);
    driveEastUntil(game, 'won');
    expect(game.levelCoins).toBe(coinsOfAllGrass(game, 'green'));
  });
});

describe('coins of a lost level', () => {
  it('keeps the coins cut but gives no bonus', () => {
    const game = lostAfterCuttingSome();
    expect(game.levelCoins).toBeGreaterThan(0);
    expect(game.bonusCoins).toBe(0);
  });

  it('earns nothing more once lost', () => {
    const game = lostAfterCuttingSome();
    const { levelCoins } = game;
    for (let step = 0; step < FRAMES_IN_ONE_SECOND; step++) expect(stepGame(game, EAST, SIXTY_FPS_FRAME).coins).toBe(0);
    expect(game.levelCoins).toBe(levelCoins);
  });
});

describe('banking coins', () => {
  it('hands over what a lost attempt earned, and nothing more when called again', () => {
    const game = lostAfterCuttingSome();
    expect(bankCoins(game)).toBe(game.levelCoins);
    expect(bankCoins(game)).toBe(0);
  });

  it('hands over the coins and the bonus of a win, and nothing more when called again', () => {
    const game = iceAheadFruitAndRockBehind();
    driveEastUntil(game, 'won');
    expect(bankCoins(game)).toBe(game.levelCoins + game.bonusCoins);
    expect(bankCoins(game)).toBe(0);
  });

  it('after continuing a defeat, hands over only the coins cut since then, plus the bonus of the win', () => {
    const { game, bankedAtDefeat } = wonAfterContinuingADefeat();
    expect(game.levelCoins).toBeGreaterThan(bankedAtDefeat);
    expect(bankCoins(game)).toBe(game.levelCoins - bankedAtDefeat + game.bonusCoins);
  });

  it('after continuing a defeat, hands over nothing more once the win is banked', () => {
    const { game } = wonAfterContinuingADefeat();
    bankCoins(game);
    expect(bankCoins(game)).toBe(0);
  });
});

describe('restarting a level', () => {
  it('forgets the coins, the bonus and what was banked of the attempt', () => {
    const game = iceAheadFruitAndRockBehind();
    driveEastUntil(game, 'won');
    bankCoins(game);
    expect(game.bonusCoins).toBeGreaterThan(0);
    resetGame(game);
    expect([game.levelCoins, game.bonusCoins, game.bankedCoins]).toEqual([0, 0, 0]);
  });
});
