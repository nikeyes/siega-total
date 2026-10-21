import { config } from '../config';

export interface CutBreeze {
  /** Whether the breeze blows after this step, given whether the blade cut in it. */
  step(cut: boolean, dt: number): boolean;
}

/** Blows while the blade cuts, and keeps blowing for holdSeconds after the last cut. */
export function createCutBreeze(): CutBreeze {
  let secondsSinceCut = Infinity;

  function step(cut: boolean, dt: number): boolean {
    secondsSinceCut = cut ? 0 : secondsSinceCut + dt;
    // Read on every step, so the debug panel's tuning applies at once.
    return secondsSinceCut < config.audio.breeze.holdSeconds;
  }

  return { step };
}
