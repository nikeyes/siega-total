import { config } from '../config';

const STARS = [1, 2, 3] as const;

export type VictoryStep = { kind: 'star'; index: (typeof STARS)[number] } | { kind: 'confetti' };

/** When each step of the victory comes, in seconds after the result shows: three stars, then the confetti. */
export function victorySteps(): { at: number; step: VictoryStep }[] {
  const { starsDelaySeconds, starIntervalSeconds } = config.effects;
  const stars = STARS.map((index, star): { at: number; step: VictoryStep } => ({
    at: starsDelaySeconds + star * starIntervalSeconds,
    step: { kind: 'star', index },
  }));
  // The confetti waits for the last star to land.
  return [...stars, { at: starsDelaySeconds + STARS.length * starIntervalSeconds, step: { kind: 'confetti' } }];
}

export interface VictorySequence {
  /** Starts the steps over from now. */
  play(): void;
  /** Drops the steps still to come. */
  cancel(): void;
}

/** Runs the victory's steps on time, calling `onStep` for each. */
export function createVictorySequence({ onStep }: { onStep: (step: VictoryStep) => void }): VictorySequence {
  let timers: ReturnType<typeof setTimeout>[] = [];

  function cancel(): void {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function play(): void {
    cancel();
    timers = victorySteps().map(({ at, step }) => setTimeout(() => onStep(step), at * 1000));
  }

  return { play, cancel };
}
