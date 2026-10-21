import { config } from '../config';

export interface CutRhythm {
  /** The playback rate of the zip to play in this step, or null when none plays. */
  step(cut: boolean, dt: number): number | null;
}

interface Streak {
  secondsSinceZip: number;
  secondsSinceCut: number;
  rate: number;
}

/** Zips at most once every cutMinIntervalSeconds, a little higher each time, until a pause in cutting ends the streak. */
export function createCutRhythm(): CutRhythm {
  const { cutMinIntervalSeconds, cutPitchStep, cutMaxPitch, cutStreakResetSeconds } = config.audio;
  let streak: Streak | null = null;

  function step(cut: boolean, dt: number): number | null {
    if (streak) {
      streak.secondsSinceZip += dt;
      streak.secondsSinceCut = cut ? 0 : streak.secondsSinceCut + dt;
      if (streak.secondsSinceCut >= cutStreakResetSeconds) streak = null;
    }
    if (!cut) return null;
    if (!streak) {
      streak = { secondsSinceZip: 0, secondsSinceCut: 0, rate: 1 };
      return streak.rate;
    }
    if (streak.secondsSinceZip < cutMinIntervalSeconds) return null;
    streak.secondsSinceZip = 0;
    streak.rate = Math.min(streak.rate + cutPitchStep, cutMaxPitch);
    return streak.rate;
  }

  return { step };
}
