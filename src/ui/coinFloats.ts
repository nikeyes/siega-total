import { config } from '../config';

/** Sums of fractional coins drift a hair below whole numbers; this much short still counts as the whole coin. */
const WHOLE_COIN_TOLERANCE = 1e-9;

export interface CoinFloats {
  /** The coins of a «+N» to show in this step, or null when none comes out. */
  step(coins: number, dt: number): number | null;
}

/**
 * Adds up the coins of each step and lets one «+N» out every `config.economy.floatIntervalSeconds`.
 * The interval starts with the first coins, so a «+N» never comes out of steps without any.
 * Only whole coins come out; the fraction left waits for the next «+N».
 */
export function createCoinFloats(): CoinFloats {
  let gathered = 0;
  let secondsGathering = 0;

  function step(coins: number, dt: number): number | null {
    gathered += coins;
    if (gathered === 0) return null;
    secondsGathering += dt;
    if (secondsGathering < config.economy.floatIntervalSeconds) return null;
    const shown = Math.floor(gathered + WHOLE_COIN_TOLERANCE);
    if (shown === 0) return null;
    gathered -= shown;
    secondsGathering = 0;
    return shown;
  }

  return { step };
}
