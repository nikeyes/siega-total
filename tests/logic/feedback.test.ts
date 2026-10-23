import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { cutsToNextSize, type Direction } from '../../src/logic/blade';
import { applyBooster } from '../../src/logic/boosters';
import { createFeedbackTracker, type FeedbackEvent } from '../../src/logic/feedback';
import { createGame, stepGame } from '../../src/logic/game';
import type { Obstacle } from '../../src/logic/levels';
import { levelFromRows } from './levelFixtures';

const SIXTY_FPS_FRAME = 1 / 60;
const EAST: Direction = { x: 1, z: 0 };
/** Gives up after a minute of game time, so a wave that never ends fails instead of hanging. */
const MAX_WAVE_FRAMES = 60 / SIXTY_FPS_FRAME;

/**
 * A full-size green field with the ice target in the far corner, so the game goes on.
 * Its blades are spread over the whole field, so one step cuts a few of them and does not grow the blade.
 */
const GREEN_WITH_FAR_ICE = Array.from(
  { length: config.field.depth },
  (_, row) => (row === 0 ? 'i' : 'g') + 'g'.repeat(config.field.width - 1),
);

/** Sand around the blade, with the ice target in the far corner, so a few steps cut nothing. */
const SAND_WITH_FAR_ICE = ['i......', '.......', '.......'];
const SAND_CENTER = { x: SAND_WITH_FAR_ICE[0]!.length / 2, z: SAND_WITH_FAR_ICE.length / 2 };

describe('starting to play', () => {
  it('gives started on the first step with a direction, and not on the next ones', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    const tracker = createFeedbackTracker();
    expect(tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME))).toEqual([]);
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([{ kind: 'started' }]);
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([]);
  });
});

describe('cutting', () => {
  it('gives cut when the blade cuts grass while playing', () => {
    const game = createGame(levelFromRows(GREEN_WITH_FAR_ICE));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([{ kind: 'started' }, { kind: 'cut' }]);
  });

  it('gives nothing for a step that cuts nothing', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([]);
  });

  it.each(['strawberry', 'cactus'] as const)('gives obstacleCut with the obstacle when the blade cuts a %s', (type) => {
    const obstacleUnderTheBlade: Obstacle = { type, ...SAND_CENTER };
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { obstacles: [obstacleUnderTheBlade] }));
    game.blade.size = config.obstacles[type].minSize;
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([
      { kind: 'started' },
      { kind: 'obstacleCut', obstacle: type },
    ]);
  });

  it('gives no obstacleCut when the blade breaks against a rock', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { obstacles: [{ type: 'rock', ...SAND_CENTER }] }));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).not.toContainEqual(expect.objectContaining({ kind: 'obstacleCut' }));
  });

  it('gives one obstacleCut per kind cut in a step, in the order of config.obstacles', () => {
    const obstacles: Obstacle[] = [
      { type: 'strawberry', x: SAND_CENTER.x - 0.3, z: SAND_CENTER.z },
      { type: 'cactus', ...SAND_CENTER },
      { type: 'strawberry', x: SAND_CENTER.x + 0.3, z: SAND_CENTER.z },
    ];
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { obstacles }));
    game.blade.size = config.obstacles.cactus.minSize;
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([
      { kind: 'started' },
      { kind: 'obstacleCut', obstacle: 'cactus' },
      { kind: 'obstacleCut', obstacle: 'strawberry' },
    ]);
  });
});

describe('hitting fruit', () => {
  it('gives obstacleHit for each blow a watermelon takes before it breaks, and obstacleCut when it does', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { obstacles: [{ type: 'watermelon', ...SAND_CENTER }] }));
    game.blade.size = config.obstacles.watermelon.minSize;
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    const events: FeedbackEvent[] = [];
    for (let step = 0; step < 120; step++) events.push(...tracker.step(game, stepGame(game, step === 0 ? EAST : null, SIXTY_FPS_FRAME)));
    const blows = events.filter((event) => event.kind === 'obstacleHit' || event.kind === 'obstacleCut');
    expect(blows).toEqual([
      ...Array.from({ length: config.obstacles.watermelon.hits - 1 }, () => ({ kind: 'obstacleHit', obstacle: 'watermelon' })),
      { kind: 'obstacleCut', obstacle: 'watermelon' },
    ]);
  });
});

describe('growing', () => {
  it('gives sizeUp with the new size when the cuts fill the bar', () => {
    const game = createGame(levelFromRows(GREEN_WITH_FAR_ICE));
    game.blade.growthProgress = cutsToNextSize(game.blade.size) - 1;
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([
      { kind: 'started' },
      { kind: 'cut' },
      { kind: 'sizeUp', size: config.blade.startSize + 1 },
    ]);
  });

  it('gives sizeUp on the next step after the upgrade booster', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    applyBooster(game, 'upgrade');
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([
      { kind: 'sizeUp', size: config.blade.startSize + config.boosters.upgrade.sizes },
    ]);
  });

  it('gives sizeUp without started when the upgrade booster is used before the first move', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    applyBooster(game, 'upgrade');
    expect(tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME))).toEqual([
      { kind: 'sizeUp', size: config.blade.startSize + config.boosters.upgrade.sizes },
    ]);
  });
});

describe('winning', () => {
  /** The only target is a strawberry under the blade, so the first move cuts it; the ice corner is left for the wave. */
  function lastTargetUnderTheBlade() {
    const strawberry: Obstacle = { type: 'strawberry', ...SAND_CENTER };
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { obstacles: [strawberry], targets: ['strawberry'] }));
    game.blade.size = config.obstacles.strawberry.minSize;
    return game;
  }

  it('gives winWave when the last target falls', () => {
    const game = lastTargetUnderTheBlade();
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([
      { kind: 'started' },
      { kind: 'obstacleCut', obstacle: 'strawberry' },
      { kind: 'winWave' },
    ]);
  });

  it('gives no cut while the wave cuts, and won once when it ends', () => {
    const game = lastTargetUnderTheBlade();
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    let waveCuts = 0;
    const events: FeedbackEvent[] = [];
    const stepAndTrack = () => {
      const result = stepGame(game, EAST, SIXTY_FPS_FRAME);
      waveCuts += result.cutIndices.length;
      events.push(...tracker.step(game, result));
    };
    for (let frame = 0; game.status === 'winWave' && frame < MAX_WAVE_FRAMES; frame++) stepAndTrack();
    stepAndTrack();
    stepAndTrack();
    expect(game.status).toBe('won');
    expect(waveCuts).toBeGreaterThan(0);
    expect(events).toEqual([{ kind: 'won' }]);
  });

  it('gives no obstacleCut when the wave cuts a cactus the blade could not', () => {
    const target: Obstacle = { type: 'strawberry', ...SAND_CENTER };
    const cactus: Obstacle = { type: 'cactus', x: 0.5, z: 0.5 };
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { obstacles: [target, cactus], targets: ['strawberry'] }));
    game.blade.size = config.obstacles.strawberry.minSize;
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    expect(game.status).toBe('winWave');
    let waveObstacleCuts = 0;
    const events: FeedbackEvent[] = [];
    for (let frame = 0; game.status === 'winWave' && frame < MAX_WAVE_FRAMES; frame++) {
      const result = stepGame(game, EAST, SIXTY_FPS_FRAME);
      waveObstacleCuts += result.cutObstacles.length;
      events.push(...tracker.step(game, result));
    }
    expect(waveObstacleCuts).toBeGreaterThan(0);
    expect(events).toEqual([{ kind: 'won' }]);
  });

  it('gives won once while the game stays won', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    game.status = 'won';
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([{ kind: 'won' }]);
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([]);
  });
});

describe('losing', () => {
  it('gives nothing when the clock lets the player go on', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { timeSeconds: 2 * SIXTY_FPS_FRAME }));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    expect(game.status).toBe('lost');
    applyBooster(game, 'clock');
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([]);
    expect(game.status).toBe('playing');
  });

  it('gives lost when the time runs out, and once while the game stays lost', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE, { timeSeconds: 2 * SIXTY_FPS_FRAME }));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([{ kind: 'lost' }]);
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([]);
    expect(game.status).toBe('lost');
  });

  it('gives cut and lost in the same step when the last frame of time cuts grass', () => {
    const game = createGame(levelFromRows(GREEN_WITH_FAR_ICE, { timeSeconds: SIXTY_FPS_FRAME }));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([
      { kind: 'started' },
      { kind: 'cut' },
      { kind: 'lost' },
    ]);
  });

  it('gives cut on the first step after continuing with the clock', () => {
    const game = createGame(levelFromRows(GREEN_WITH_FAR_ICE, { timeSeconds: SIXTY_FPS_FRAME }));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    expect(game.status).toBe('lost');
    for (let frame = 0; frame < 60; frame++) tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    applyBooster(game, 'clock');
    const result = stepGame(game, EAST, SIXTY_FPS_FRAME);
    expect(result.cutIndices.length).toBeGreaterThan(0);
    expect(tracker.step(game, result)).toEqual([{ kind: 'cut' }]);
  });
});

describe('switching games', () => {
  it('gives nothing for the first step of another game, with a bigger or a smaller blade', () => {
    const tracker = createFeedbackTracker();
    const grown = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    tracker.step(grown, stepGame(grown, EAST, SIXTY_FPS_FRAME));
    applyBooster(grown, 'upgrade');
    tracker.step(grown, stepGame(grown, EAST, SIXTY_FPS_FRAME));
    const restarted = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    expect(tracker.step(restarted, stepGame(restarted, null, SIXTY_FPS_FRAME))).toEqual([]);
    const bigger = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    bigger.blade.size = restarted.blade.size + config.boosters.upgrade.sizes;
    expect(tracker.step(bigger, stepGame(bigger, null, SIXTY_FPS_FRAME))).toEqual([]);
  });

  it('gives nothing when the new game is already won', () => {
    const tracker = createFeedbackTracker();
    const playing = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    tracker.step(playing, stepGame(playing, EAST, SIXTY_FPS_FRAME));
    const won = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    won.status = 'won';
    expect(tracker.step(won, stepGame(won, EAST, SIXTY_FPS_FRAME))).toEqual([]);
  });

  it('gives started and cut for the first step of a game tracked before it is stepped', () => {
    const tracker = createFeedbackTracker();
    const previous = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    tracker.step(previous, stepGame(previous, EAST, SIXTY_FPS_FRAME));
    const next = createGame(levelFromRows(GREEN_WITH_FAR_ICE));
    tracker.track(next);
    expect(tracker.step(next, stepGame(next, EAST, SIXTY_FPS_FRAME))).toEqual([{ kind: 'started' }, { kind: 'cut' }]);
  });

  it('gives nothing for the first step of a game other than the tracked one', () => {
    const tracker = createFeedbackTracker();
    const tracked = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    tracker.track(tracked);
    const bigger = createGame(levelFromRows(GREEN_WITH_FAR_ICE));
    bigger.blade.size = tracked.blade.size + config.boosters.upgrade.sizes;
    expect(tracker.step(bigger, stepGame(bigger, EAST, SIXTY_FPS_FRAME))).toEqual([]);
  });

  it('keeps each tracker separate', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    const first = createFeedbackTracker();
    const second = createFeedbackTracker();
    first.step(game, stepGame(game, null, SIXTY_FPS_FRAME));
    const result = stepGame(game, EAST, SIXTY_FPS_FRAME);
    expect(first.step(game, result)).toEqual([{ kind: 'started' }]);
    expect(second.step(game, result)).toEqual([]);
  });
});

describe('running low on time', () => {
  /** A game in play on sand, with `seconds` left on the clock. */
  function playingWith(seconds: number) {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    const tracker = createFeedbackTracker();
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    game.timeLeft = seconds;
    tracker.track(game);
    return { game, tracker };
  }

  it('gives lowTime once, in the step the clock crosses lowTimeSeconds', () => {
    const { game, tracker } = playingWith(config.level.lowTimeSeconds + SIXTY_FPS_FRAME / 2);
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([{ kind: 'lowTime' }]);
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([]);
  });

  it('gives lowTime again after the clock is lifted back above lowTimeSeconds and falls again', () => {
    const { game, tracker } = playingWith(config.level.lowTimeSeconds + SIXTY_FPS_FRAME / 2);
    tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME));
    game.timeLeft = config.level.lowTimeSeconds + 5;
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([]);
    game.timeLeft = config.level.lowTimeSeconds + SIXTY_FPS_FRAME / 2;
    tracker.track(game);
    expect(tracker.step(game, stepGame(game, EAST, SIXTY_FPS_FRAME))).toEqual([{ kind: 'lowTime' }]);
  });

  it('gives only lost when the clock runs out in one step from above lowTimeSeconds', () => {
    const { game, tracker } = playingWith(config.level.lowTimeSeconds + 0.001);
    expect(tracker.step(game, stepGame(game, EAST, config.level.lowTimeSeconds + 1))).toEqual([{ kind: 'lost' }]);
  });

  it('gives no lowTime before the first move', () => {
    const game = createGame(levelFromRows(SAND_WITH_FAR_ICE));
    game.timeLeft = config.level.lowTimeSeconds + 1;
    const tracker = createFeedbackTracker();
    tracker.track(game);
    game.timeLeft = config.level.lowTimeSeconds - 1;
    expect(game.status).toBe('ready');
    expect(tracker.step(game, stepGame(game, null, SIXTY_FPS_FRAME))).toEqual([]);
  });
});
