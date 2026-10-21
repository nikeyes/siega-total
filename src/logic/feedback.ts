import type { Game, GameStatus, StepResult } from './game';

export type FeedbackEvent =
  | { kind: 'started' } // ready → playing: the first move
  | { kind: 'cut' } // blades cut by the blade in this step
  | { kind: 'obstacleCut' } // a fruit or cactus cut by the blade in this step
  | { kind: 'sizeUp'; size: number } // the blade grew, by cutting or by the booster
  | { kind: 'winWave' } // the last target fell; the wave starts
  | { kind: 'won' }
  | { kind: 'lost' };

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
}

/**
 * Another game (a new level or a restart) that was not tracked starts the tracking over without events,
 * so its size or status is not news.
 */
export function createFeedbackTracker(): FeedbackTracker {
  let previous: Previous | null = null;
  const track = (game: Game) => {
    previous = { game, status: game.status, size: game.blade.size };
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

/** Always in the same order: started, cut, obstacleCut, sizeUp, winWave, won, lost. */
function eventsOfStep(game: Game, result: StepResult, previous: Previous): FeedbackEvent[] {
  const events: FeedbackEvent[] = [];
  // Only the blade's own cuts count; the win wave's cuts are covered by its jingle.
  // Won and lost steps cut nothing, and a step after the clock (lost → playing between frames) is the blade's.
  const played = previous.status !== 'winWave';
  const entered = (status: GameStatus) => game.status === status && previous.status !== status;
  // The first move can also cut the last target and go from ready straight to the win wave.
  if (previous.status === 'ready' && game.status !== 'ready') events.push({ kind: 'started' });
  if (played && result.cutIndices.length > 0) events.push({ kind: 'cut' });
  if (played && result.cutObstacles.some((index) => game.obstacles.obstacles[index]!.type !== 'rock')) {
    events.push({ kind: 'obstacleCut' });
  }
  // Compared between frames, so the upgrade booster used outside stepGame counts too.
  if (game.blade.size > previous.size) events.push({ kind: 'sizeUp', size: game.blade.size });
  if (entered('winWave')) events.push({ kind: 'winWave' });
  if (entered('won')) events.push({ kind: 'won' });
  if (entered('lost')) events.push({ kind: 'lost' });
  return events;
}
