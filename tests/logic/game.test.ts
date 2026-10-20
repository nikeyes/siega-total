import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { addCuts, bladeRadius, createBlade, type Direction } from '../../src/logic/blade';
import { cutInCircle, GRASS_TYPE_ORDER, type Field, type GrassType } from '../../src/logic/field';
import {
  createGame,
  cutAllTargets,
  resetGame,
  remainingTargets,
  shouldHighlightTargets,
  stepGame,
  targetProgress,
  type Game,
  type StepResult,
} from '../../src/logic/game';
import { stripesLevel, type LevelDefinition } from '../../src/logic/levels';

const { width, depth } = config.field;
const { startSize } = config.blade;
const SIXTY_FPS_FRAME = 1 / 60;
const EAST: Direction = { x: 1, z: 0 };
const WEST: Direction = { x: -1, z: 0 };
const NORTH: Direction = { x: 0, z: -1 };
const SOUTH: Direction = { x: 0, z: 1 };

const GRASS_BY_LETTER: Record<string, GrassType | null> = { g: 'green', i: 'ice', w: 'wheat', l: 'lavender', b: 'bramble', '.': null };

/**
 * A level of 1 m cells drawn row by row, north to south: `g` green, `i` ice, `w` wheat,
 * `l` lavender, `b` bramble and `.` sand. Ice is the target unless `overrides` says otherwise.
 */
function levelFromRows(rows: string[], overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    width: rows[0]!.length,
    depth: rows.length,
    cellSize: 1,
    cells: rows.flatMap((row) => [...row].map((letter) => GRASS_BY_LETTER[letter]!)),
    target: 'ice',
    timeSeconds: config.level.timeSeconds,
    ...overrides,
  };
}

type StepListener = (result: StepResult, radiusDuringStep: number) => void;

function isInPlay(game: Game): boolean {
  return game.status === 'ready' || game.status === 'playing';
}

/** Steps the game one 60 fps frame at a time in `direction` until `arrived` holds or the game leaves play. */
function driveUntil(game: Game, direction: Direction | null, arrived: () => boolean, onStep: StepListener = () => {}) {
  while (!arrived() && isInPlay(game)) {
    const radiusDuringStep = bladeRadius(game.blade.size);
    onStep(stepGame(game, direction, SIXTY_FPS_FRAME), radiusDuringStep);
  }
}

/** Drives in `direction` for `seconds` of 60 fps frames, whatever the game status. */
function driveForSeconds(game: Game, direction: Direction | null, seconds: number, onStep: StepListener = () => {}) {
  for (let step = 0; step < seconds / SIXTY_FPS_FRAME; step++) {
    const radiusDuringStep = bladeRadius(game.blade.size);
    onStep(stepGame(game, direction, SIXTY_FPS_FRAME), radiusDuringStep);
  }
}

function bladesWithin(field: Field, centerX: number, centerZ: number, radius: number): number[] {
  const inside: number[] = [];
  for (let blade = 0; blade < field.bladeCount; blade++) {
    const distance = Math.hypot(field.positionsX[blade]! - centerX, field.positionsZ[blade]! - centerZ);
    if (distance <= radius) inside.push(blade);
  }
  return inside;
}

/** Brakes to a stop, so the next direction starts a straight line instead of a curve. */
function stopBlade(game: Game, onStep?: StepListener) {
  driveUntil(game, null, () => game.blade.speed === 0, onStep);
}

/**
 * Mows the whole field in east-west lanes, starting from the northwest corner, until the game leaves play.
 * Lanes are a quarter of the starting cut width apart; braking after each lane change
 * adds some drift, but consecutive lanes stay close enough for their cuts to overlap.
 */
function mowInZigzag(game: Game) {
  const { width, depth } = game.field;
  const laneSpacing = config.blade.baseRadius / 2;
  driveUntil(game, NORTH, () => game.blade.z === 0);
  stopBlade(game);
  driveUntil(game, WEST, () => game.blade.x === 0);
  stopBlade(game);
  for (let lane = 0; isInPlay(game); lane++) {
    const goingEast = lane % 2 === 0;
    const edgeX = goingEast ? width : 0;
    driveUntil(game, goingEast ? EAST : WEST, () => game.blade.x === edgeX);
    stopBlade(game);
    if (game.blade.z === depth) return;
    const nextLaneZ = Math.min(depth, game.blade.z + laneSpacing);
    driveUntil(game, SOUTH, () => game.blade.z >= nextLaneZ);
    stopBlade(game);
  }
}

describe('createGame', () => {
  it('lays out the grass of the stripes level by default, with the configured number of blades', () => {
    const level = stripesLevel();
    const { field } = createGame();
    const columns = level.width / level.cellSize;
    const cellTypeOf = (blade: number) =>
      level.cells[
        Math.floor(field.positionsZ[blade]! / level.cellSize) * columns + Math.floor(field.positionsX[blade]! / level.cellSize)
      ];
    expect(field.bladeCount).toBe(config.field.bladeCount);
    expect(Array.from(field.types.keys()).every((blade) => GRASS_TYPE_ORDER[field.types[blade]!] === cellTypeOf(blade))).toBe(true);
  });

  it('starts ready, with the whole level time left', () => {
    const level = levelFromRows(['gi'], { timeSeconds: 7 });
    const game = createGame(level);
    expect(game.status).toBe('ready');
    expect(game.timeLeft).toBe(7);
  });
});

/** 4 × 4 m, green in the west half and ice, the target, in the east half. */
const HALVES = ['ggii', 'ggii', 'ggii', 'ggii'];

/** 5 × 5 m of bramble, too tough for a small blade, around one ice cell under the starting position. */
const ICE_IN_BRAMBLE = ['bbbbb', 'bbbbb', 'bbibb', 'bbbbb', 'bbbbb'];

/** 4 × 4 m with the ice, the target, along the east edge, out of reach of a blade that drives west. */
const ICE_ON_THE_EAST_EDGE = ['gggi', 'gggi', 'gggi', 'gggi'];

/** A level time that a whole number of 60 fps frames does not add up to exactly. */
const SHORT_TIME_SECONDS = 0.2501;

/** Cuts standing blades of `type` one by one, directly on the field, until `remaining` of them are left. */
function cutBladesOfTypeUntil(game: Game, type: GrassType, remaining: number) {
  const { field } = game;
  const typeIndex = GRASS_TYPE_ORDER.indexOf(type);
  for (let blade = 0; blade < field.bladeCount; blade++) {
    if (field.countByType[typeIndex]! - field.cutByType[typeIndex]! === remaining) return;
    if (field.types[blade] === typeIndex && field.cut[blade] === 0) {
      cutInCircle(field, field.positionsX[blade]!, field.positionsZ[blade]!, 0, Infinity);
    }
  }
}

/** Gives up after a minute of game time, so a wave that never ends fails instead of hanging. */
const MAX_WAVE_STEPS = 60 * 60;

/** Steps the game without a direction while the win wave lasts; returns the number of steps. */
function stepThroughWinWave(game: Game, onStep: (result: StepResult) => void = () => {}): number {
  let steps = 0;
  while (game.status === 'winWave' && steps < MAX_WAVE_STEPS) {
    onStep(stepGame(game, null, SIXTY_FPS_FRAME));
    steps++;
  }
  return steps;
}

function wonGame(): Game {
  const game = createGame(levelFromRows(ICE_IN_BRAMBLE));
  mowInZigzag(game);
  stepThroughWinWave(game);
  return game;
}

function lostGame(): Game {
  const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE, { timeSeconds: SHORT_TIME_SECONDS }));
  driveForSeconds(game, WEST, 2 * SHORT_TIME_SECONDS);
  return game;
}

describe('target progress', () => {
  it('is the fraction of target blades cut', () => {
    const game = createGame(levelFromRows(HALVES));
    const ice = game.field.countByType[game.targetType]!;
    expect(targetProgress(game)).toBe(0);
    cutBladesOfTypeUntil(game, 'ice', ice / 4);
    expect(targetProgress(game)).toBe(0.75);
    expect(remainingTargets(game)).toBe(ice / 4);
  });

  it('does not change when other grass is cut', () => {
    const game = createGame(levelFromRows(HALVES));
    cutBladesOfTypeUntil(game, 'green', 0);
    expect(targetProgress(game)).toBe(0);
    expect(remainingTargets(game)).toBe(game.field.countByType[game.targetType]);
  });
  it.skip('reports a level without target grass as fully done - BUG', () => {
    /*
     * ROOT CAUSE: targetProgress divides cutByType by countByType, and both are 0 when the level has no target grass.
     * CODE LOCATION: src/logic/game.ts targetProgress
     * PROPOSED FIX: return 1 when countByType[targetType] is 0 (nothing left to cut), matching remainingTargets = 0.
     * EXPECTED: 1
     * ACTUAL: NaN (the HUD bar would get a NaN width)
     */
    const game = createGame(levelFromRows(['gg', 'gg']));
    expect(targetProgress(game)).toBe(1);
  });
});

describe('stepGame', () => {
  it('starts playing on the first step with a direction, moving the blade and running the clock', () => {
    const game = createGame();
    stepGame(game, EAST, SIXTY_FPS_FRAME);
    expect(game.status).toBe('playing');
    expect(game.blade.x).toBeGreaterThan(width / 2);
    expect(game.timeLeft).toBe(game.level.timeSeconds - SIXTY_FPS_FRAME);
  });

  it('does nothing while ready and no direction is given', () => {
    const game = createGame();
    driveForSeconds(game, null, 1);
    expect(game.status).toBe('ready');
    expect(game.timeLeft).toBe(game.level.timeSeconds);
    expect(game.blade).toEqual(createBlade(width / 2, depth / 2));
    expect(game.field.cutCount).toBe(0);
  });

  it('only cuts blades within bladeRadius of the path when crossing the field from west to east', () => {
    const game = createGame();
    driveUntil(game, WEST, () => game.blade.x === 0);
    stopBlade(game);
    const pathZ = game.blade.z;
    const farthestCuts: number[] = [];
    let cutsOnTheWay = 0;
    driveUntil(game, EAST, () => game.blade.x === width, ({ cutIndices }, radius) => {
      cutsOnTheWay += cutIndices.length;
      for (const blade of cutIndices) {
        const distanceToBlade = Math.hypot(
          game.field.positionsX[blade]! - game.blade.x,
          game.field.positionsZ[blade]! - game.blade.z,
        );
        if (distanceToBlade > radius) farthestCuts.push(blade);
      }
    });
    expect(cutsOnTheWay).toBeGreaterThan(0);
    expect(farthestCuts).toEqual([]);
    expect(game.blade.z).toBe(pathZ);
  });

  it('grows the blade by the same sizes as addCuts over all the blades cut', () => {
    const game = createGame();
    let totalCut = 0;
    let totalSizesGained = 0;
    const record: StepListener = ({ cutIndices, sizesGained }) => {
      totalCut += cutIndices.length;
      totalSizesGained += sizesGained;
    };
    driveUntil(game, WEST, () => game.blade.x === 0, record);
    stopBlade(game, record);
    driveUntil(game, EAST, () => game.blade.x === width, record);

    const reference = createBlade(0, 0);
    const expectedSizesGained = addCuts(reference, totalCut);
    expect(expectedSizesGained).toBeGreaterThan(0);
    expect(totalSizesGained).toBe(expectedSizesGained);
    expect(game.blade.size).toBe(reference.size);
    expect(game.blade.growthProgress).toBe(reference.growthProgress);
  });

  it('cuts with the new, larger radius right after growing a size', () => {
    const game = createGame();
    let grown = false;
    driveUntil(game, WEST, () => game.blade.x === 0);
    stopBlade(game);
    driveUntil(game, EAST, () => grown || game.blade.x === width, ({ sizesGained }) => (grown = sizesGained > 0));
    expect(grown).toBe(true);
    const oldRadius = bladeRadius(game.blade.size - 1);
    const newRadius = bladeRadius(game.blade.size);

    const standingStill = 0;
    const { cutIndices } = stepGame(game, null, standingStill);
    const distances = cutIndices.map((blade) =>
      Math.hypot(game.field.positionsX[blade]! - game.blade.x, game.field.positionsZ[blade]! - game.blade.z),
    );
    expect(distances.length).toBeGreaterThan(0);
    expect(distances.every((distance) => distance > oldRadius && distance <= newRadius)).toBe(true);
  });

  it('cuts every blade exactly once when mowing the whole field in a zigzag', () => {
    const noTimeLimit = Infinity;
    const allGreen = levelFromRows(Array<string>(depth).fill('g'.repeat(width)), { target: 'green', timeSeconds: noTimeLimit });
    const game = createGame(allGreen);
    mowInZigzag(game);
    expect(game.field.cutCount).toBe(game.field.bladeCount);
    expect(game.field.cut.every((cut) => cut === 1)).toBe(true);
  });

  it('keeps the blade still and cuts nothing new when repeated with dt 0', () => {
    const game = createGame();
    stepGame(game, EAST, 0);
    const { x, z } = game.blade;
    const second = stepGame(game, EAST, 0);
    expect(game.blade.x).toBe(x);
    expect(game.blade.z).toBe(z);
    expect(second.cutIndices).toEqual([]);
    expect(second.sizesGained).toBe(0);
  });

  it('grows several sizes in one step when enough blades are cut at once', () => {
    const game = createGame(levelFromRows(['gg', 'gg'], { target: 'green' }));
    const result = stepGame(game, EAST, 0);
    const reference = createBlade(0, 0);
    const expectedSizesGained = addCuts(reference, result.cutIndices.length);
    expect(expectedSizesGained).toBeGreaterThan(1);
    expect(result.sizesGained).toBe(expectedSizesGained);
    expect(game.blade.size).toBe(startSize + expectedSizesGained);
    expect(game.blade.growthProgress).toBe(reference.growthProgress);
  });

  it('cuts every blade under the blade when it is pushed into a corner', () => {
    const game = createGame();
    driveUntil(game, { x: -Math.SQRT1_2, z: -Math.SQRT1_2 }, () => game.blade.x === 0 && game.blade.z === 0);
    const atCorner = bladesWithin(game.field, 0, 0, bladeRadius(game.blade.size));
    expect(atCorner.every((blade) => game.field.cut[blade] === 1)).toBe(true);
  });
  it('starts playing without using time on a first step of dt 0', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE));
    stepGame(game, WEST, 0);
    expect(game.status).toBe('playing');
    expect(game.timeLeft).toBe(game.level.timeSeconds);
  });
});

describe('winning', () => {
  it('starts the win wave at the blade when the last target blade is cut', () => {
    const game = createGame(levelFromRows(HALVES));
    mowInZigzag(game);
    expect(remainingTargets(game)).toBe(0);
    expect(game.status).toBe('winWave');
    expect(game.winWave).toEqual({ x: game.blade.x, z: game.blade.z, radius: 0 });
  });
});

describe('win wave', () => {
  function gameInWinWave(): Game {
    const game = createGame(levelFromRows(ICE_IN_BRAMBLE));
    mowInZigzag(game);
    return game;
  }

  it('cuts all the grass, even grass too tough for the blade, and then the level is won', () => {
    const game = gameInWinWave();
    const bramble = GRASS_TYPE_ORDER.indexOf('bramble');
    expect(game.blade.size).toBeLessThan(config.grassTypes.bramble.minSize);
    expect(game.field.cutByType[bramble]).toBe(0);
    const cutByWave: number[] = [];
    stepThroughWinWave(game, ({ cutIndices }) => cutByWave.push(...cutIndices));
    expect(game.status).toBe('won');
    expect(game.field.cutCount).toBe(game.field.bladeCount);
    expect(cutByWave).toHaveLength(game.field.countByType[bramble]!);
  });

  it('brakes the blade, even with a direction', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE));
    driveForSeconds(game, WEST, SIXTY_FPS_FRAME);
    cutAllTargets(game);
    stepGame(game, WEST, SIXTY_FPS_FRAME);
    expect(game.status).toBe('winWave');
    expect(game.blade.speed).toBe(config.blade.maxSpeed);
    stepGame(game, WEST, SIXTY_FPS_FRAME);
    expect(game.blade.speed).toBeLessThan(config.blade.maxSpeed);
  });

  it('does not grow the blade', () => {
    const game = gameInWinWave();
    const { size, growthProgress } = game.blade;
    let sizesGained = 0;
    stepThroughWinWave(game, (result) => (sizesGained += result.sizesGained));
    expect(sizesGained).toBe(0);
    expect(game.blade.size).toBe(size);
    expect(game.blade.growthProgress).toBe(growthProgress);
  });

  it('lasts as long as the wave takes to reach the farthest corner of the field', () => {
    const game = gameInWinWave();
    const { x, z } = game.winWave!;
    const { width, depth } = game.field;
    const farthestCorner = Math.max(Math.hypot(x, z), Math.hypot(width - x, z), Math.hypot(x, depth - z), Math.hypot(width - x, depth - z));
    const expectedSteps = farthestCorner / config.level.winWaveSpeed / SIXTY_FPS_FRAME;
    expect(Math.abs(stepThroughWinWave(game) - expectedSteps)).toBeLessThanOrEqual(1);
  });
  it('finishes the win wave in a single long step', () => {
    const game = createGame(levelFromRows(ICE_IN_BRAMBLE));
    mowInZigzag(game);
    const oneMinute = 60;
    stepGame(game, null, oneMinute);
    expect(game.status).toBe('won');
    expect(game.field.cutCount).toBe(game.field.bladeCount);
  });
});

describe('losing', () => {
  it('ends the level with exactly no time left when the time runs out with targets standing', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE, { timeSeconds: SHORT_TIME_SECONDS }));
    driveForSeconds(game, WEST, 2 * SHORT_TIME_SECONDS);
    expect(remainingTargets(game)).toBeGreaterThan(0);
    expect(game.status).toBe('lost');
    expect(game.timeLeft).toBe(0);
  });

  it('ends the level in the step where the time left reaches exactly 0', () => {
    const quarterSecond = 0.25;
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE, { timeSeconds: 2 * quarterSecond }));
    stepGame(game, WEST, quarterSecond);
    expect(game.status).toBe('playing');
    stepGame(game, WEST, quarterSecond);
    expect(game.status).toBe('lost');
  });

  it('wins instead when the last target blade is cut in the step that runs out of time', () => {
    const rehearsal = createGame(levelFromRows(HALVES, { timeSeconds: 1_000 }));
    mowInZigzag(rehearsal);
    const timeToCutTheLastTarget = rehearsal.level.timeSeconds - rehearsal.timeLeft;
    const halfAStepTooShort = timeToCutTheLastTarget - SIXTY_FPS_FRAME / 2;

    const game = createGame(levelFromRows(HALVES, { timeSeconds: halfAStepTooShort }));
    mowInZigzag(game);
    expect(game.status).toBe('winWave');
  });
  it('loses in a single long step that runs past the time', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE, { timeSeconds: SHORT_TIME_SECONDS }));
    stepGame(game, WEST, 10 * SHORT_TIME_SECONDS);
    expect(game.status).toBe('lost');
    expect(game.timeLeft).toBe(0);
  });
});

describe.each([
  ['won', wonGame],
  ['lost', lostGame],
] as const)('once the level is %s', (status, createFinishedGame) => {
  function finishedGame(): Game {
    const game = createFinishedGame();
    expect(game.status).toBe(status);
    return game;
  }

  it('keeps the time and cuts nothing more', () => {
    const game = finishedGame();
    const { timeLeft } = game;
    const { cutCount } = game.field;
    const cutAfterTheEnd: number[] = [];
    driveForSeconds(game, EAST, 1, ({ cutIndices }) => cutAfterTheEnd.push(...cutIndices));
    expect(cutAfterTheEnd).toEqual([]);
    expect(game.field.cutCount).toBe(cutCount);
    expect(game.timeLeft).toBe(timeLeft);
  });

  it('brakes the blade to a stop even with a direction', () => {
    const game = finishedGame();
    driveForSeconds(game, EAST, config.blade.brakeSeconds + SIXTY_FPS_FRAME);
    expect(game.blade.speed).toBe(0);
  });
});

describe('highlighting the last targets', () => {
  const { highlightBelow } = config.level;

  /** A game in play on ICE_ON_THE_EAST_EDGE with `remaining` ice blades standing. */
  function playingGameWithTargetsLeft(remaining: number): Game {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE));
    stepGame(game, WEST, 0);
    cutBladesOfTypeUntil(game, 'ice', remaining);
    expect(game.status).toBe('playing');
    return game;
  }

  it('does not highlight with highlightBelow targets left', () => {
    expect(shouldHighlightTargets(playingGameWithTargetsLeft(highlightBelow))).toBe(false);
  });

  it('highlights with fewer than highlightBelow targets left', () => {
    expect(shouldHighlightTargets(playingGameWithTargetsLeft(highlightBelow - 1))).toBe(true);
    expect(shouldHighlightTargets(playingGameWithTargetsLeft(1))).toBe(true);
  });

  it('does not highlight before the first move', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE));
    cutBladesOfTypeUntil(game, 'ice', 1);
    expect(shouldHighlightTargets(game)).toBe(false);
  });

  it('does not highlight right after the debug panel cuts every target', () => {
    const game = playingGameWithTargetsLeft(1);
    cutAllTargets(game);
    expect(game.status).toBe('playing');
    expect(shouldHighlightTargets(game)).toBe(false);
  });

  it('does not highlight once every target is cut', () => {
    const game = createGame(levelFromRows(ICE_IN_BRAMBLE));
    mowInZigzag(game);
    expect(remainingTargets(game)).toBe(0);
    expect(shouldHighlightTargets(game)).toBe(false);
  });
});

describe('resetGame', () => {
  it('leaves a lost game just like a new game of the same level', () => {
    const game = lostGame();
    expect(game.field.cutCount).toBeGreaterThan(0);
    resetGame(game);
    expect(game).toEqual(createGame(game.level));
  });

  it('leaves a won game just like a new game of the same level', () => {
    const game = wonGame();
    resetGame(game);
    expect(game).toEqual(createGame(game.level));
  });
  it('resets in the middle of the win wave', () => {
    const game = createGame(levelFromRows(ICE_IN_BRAMBLE));
    mowInZigzag(game);
    stepGame(game, null, SIXTY_FPS_FRAME);
    resetGame(game);
    expect(game).toEqual(createGame(game.level));
  });
  it('starts the reset game with a level time changed after creating it', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE));
    game.level.timeSeconds = 3;
    resetGame(game);
    expect(game.timeLeft).toBe(3);
  });
  it('plays a reset game to the end again', () => {
    const game = lostGame();
    resetGame(game);
    driveForSeconds(game, WEST, 2 * SHORT_TIME_SECONDS);
    expect(game.status).toBe('lost');
  });
});

describe('cutAllTargets (debug)', () => {
  it('cuts every target blade before the first move, and the next step starts the win wave', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE));
    const cut = cutAllTargets(game);
    expect(cut).toHaveLength(game.field.countByType[game.targetType]!);
    expect(remainingTargets(game)).toBe(0);
    expect(game.field.cutCount).toBe(cut.length);
    stepGame(game, null, SIXTY_FPS_FRAME);
    expect(game.status).toBe('winWave');
  });

  it('returns only the target blades that were still standing', () => {
    const game = createGame(levelFromRows(ICE_ON_THE_EAST_EDGE));
    cutBladesOfTypeUntil(game, 'ice', 3);
    const cut = cutAllTargets(game);
    expect(cut).toHaveLength(3);
    expect(game.field.cutCount).toBe(game.field.countByType[game.targetType]);
  });
  it('does not change the status of a lost game when cutting all targets from the debug panel', () => {
    const game = lostGame();
    cutAllTargets(game);
    stepGame(game, null, SIXTY_FPS_FRAME);
    expect(game.status).toBe('lost');
  });
});
