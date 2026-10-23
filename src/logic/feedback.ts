import { config } from '../config';
import type { Game, GameStatus, StepResult } from './game';
import type { ObstacleType } from './levels';

export type FeedbackEvent =
  | { kind: 'started' } // ready → playing: the first move
  | { kind: 'cut' } // blades cut by the blade in this step
  | { kind: 'obstacleHit'; obstacle: BreakingObstacle } // one per kind of fruit hit by the blade in this step without breaking
  | { kind: 'obstacleCut'; obstacle: BreakingObstacle } // one per kind of fruit or cactus cut by the blade in this step
  | { kind: 'sizeUp'; size: number } // the blade grew, by cutting or by the booster
  | { kind: 'lowTime' } // the clock went below config.level.lowTimeSeconds while playing
  | { kind: 'winWave' } // the last target fell; the wave starts
  | { kind: 'won' }
  | { kind: 'lost' };

/** Rocks never break. */
export type BreakingObstacle = Exclude<ObstacleType, 'rock'>;

const BREAKING_OBSTACLES = (Object.keys(config.obstacles) as ObstacleType[]).filter(
  (type): type is BreakingObstacle => type !== 'rock',
);

export interface FeedbackTracker {
  /** Follows a new game from its current status and size, so its first step gives events. */
  track(game: Game): void;
  /** Events of the step that just ran; call it once per frame, after stepGame. */
  step(game: Game, result: StepResult): FeedbackEvent[];
}

/** What the tracker remembers from the previous frame. */
interface Previous {
  game: Game;
  status: GameStatus;
  size: number;
  timeLeft: number;
}

/**
 * Another game (a new level or a restart) that was not tracked starts the tracking over without events,
 * so its size or status is not news.
 */
export function createFeedbackTracker(): FeedbackTracker {
  let previous: Previous | null = null;
  const track = (game: Game) => {
    previous = { game, status: game.status, size: game.blade.size, timeLeft: game.timeLeft };
  };
  return {
    track,
    step(game, result) {
      const events = previous?.game === game ? eventsOfStep(game, result, previous) : [];
      track(game);
      return events;
    },
  };
}

/** Always in the same order: started, cut, obstacleHit, obstacleCut, sizeUp, lowTime, winWave, won, lost. */
function eventsOfStep(game: Game, result: StepResult, previous: Previous): FeedbackEvent[] {
  const events: FeedbackEvent[] = [];
  // Only the blade's own cuts count; the win wave's cuts are covered by its jingle.
  // Won and lost steps cut nothing, and a step after the clock (lost → playing between frames) is the blade's.
  const played = previous.status !== 'winWave';
  const entered = (status: GameStatus) => game.status === status && previous.status !== status;
  // The first move can also cut the last target and go from ready straight to the win wave.
  if (previous.status === 'ready' && game.status !== 'ready') events.push({ kind: 'started' });
  if (played && result.cutIndices.length > 0) events.push({ kind: 'cut' });
  if (played) {
    const typesOf = (indices: number[]) => new Set(indices.map((index) => game.obstacles.obstacles[index]!.type));
    const hitTypes = typesOf(result.hitObstacles);
    const cutTypes = typesOf(result.cutObstacles);
    for (const obstacle of BREAKING_OBSTACLES) if (hitTypes.has(obstacle)) events.push({ kind: 'obstacleHit', obstacle });
    for (const obstacle of BREAKING_OBSTACLES) if (cutTypes.has(obstacle)) events.push({ kind: 'obstacleCut', obstacle });
  }
  // Compared between frames, so the upgrade booster used outside stepGame counts too.
  if (game.blade.size > previous.size) events.push({ kind: 'sizeUp', size: game.blade.size });
  // Crossing from above re-arms it: a booster or «+30 s» that lifts the clock back lets it sound again.
  const { lowTimeSeconds } = config.level;
  if (game.status === 'playing' && previous.timeLeft > lowTimeSeconds && game.timeLeft <= lowTimeSeconds) {
    events.push({ kind: 'lowTime' });
  }
  if (entered('winWave')) events.push({ kind: 'winWave' });
  if (entered('won')) events.push({ kind: 'won' });
  if (entered('lost')) events.push({ kind: 'lost' });
  return events;
}
