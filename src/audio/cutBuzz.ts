import { config } from '../config';

export interface CutBuzz {
  /** Whether to buzz after this step, given whether the blade cut in it. */
  step(cut: boolean, dt: number): boolean;
}

/** Buzzes as cutting starts, then every everySeconds of the cutRhythm step reached; a pause starts the rhythm over. */
export function createCutBuzz(): CutBuzz {
  let cuttingSeconds = 0;
  let secondsSinceCut = Infinity;
  let secondsSinceBuzz = Infinity;

  function step(cut: boolean, dt: number): boolean {
    const { cutRhythm, cutRhythmPauseSeconds } = config.vibration;
    secondsSinceCut = cut ? 0 : secondsSinceCut + dt;
    if (secondsSinceCut >= cutRhythmPauseSeconds) {
      cuttingSeconds = 0;
      secondsSinceBuzz = Infinity;
      return false;
    }
    cuttingSeconds += dt;
    secondsSinceBuzz += dt;
    const rhythm = cutRhythm.filter((beat) => cuttingSeconds >= beat.afterSeconds).at(-1);
    if (!cut || !rhythm || secondsSinceBuzz < rhythm.everySeconds) return false;
    secondsSinceBuzz = 0;
    return true;
  }

  return { step };
}
