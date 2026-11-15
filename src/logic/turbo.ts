import { config } from '../config';

/** A win adds to the streak; a defeat starts it over. */
export function nextWinStreak(winStreak: number, outcome: 'won' | 'lost'): number {
  return outcome === 'won' ? winStreak + 1 : 0;
}

export function isTurboOn(winStreak: number): boolean {
  const { afterWins } = config.turbo;
  return afterWins !== null && winStreak >= afterWins;
}
