import type { BreakingObstacle } from '../logic/feedback';
import { lowPass } from './filters';
import { fadeEdges, mixAt, noiseBurst, normalizePeak, pitchDrop } from './synthesis';

/** Every break peaks here before its volume in config.audio.volume. */
const PEAK = 0.5;
/** No crack lands before this, so the break starts without a click. */
const FIRST_CRACK_SECONDS = 0.005;
/** Rounds off the hiss above the splash and the cracks, so nothing is shrill. */
const SOFTENING_HZ = 4500;

/** The sound of `obstacle` breaking; `random` picks this variant's details. */
export function synthesizeBreak(obstacle: BreakingObstacle, sampleRate: number, random: () => number): Float32Array {
  const between = (min: number, max: number) => min + (max - min) * random();
  const sound = new Float32Array(Math.round(BREAK_SECONDS[obstacle] * sampleRate));
  if (obstacle === 'watermelon') {
    // The splash of the flesh swells up to the moment it bursts, with a low thump, then a few drops land.
    mixAt(sound, noiseBurst(sampleRate, 0.45, 1500, 5000, 0.08, random), 0, sampleRate, 3);
    mixAt(sound, pitchDrop(sampleRate, 75, 45, 0.12), 0.05, sampleRate);
    const drops = Math.floor(between(3, 7));
    for (let drop = 0; drop < drops; drop++) {
      mixAt(sound, noiseBurst(sampleRate, between(0.015, 0.03), 2000, 4500, 0.004, random), between(0.1, 0.5), sampleRate, between(0.2, 0.4));
    }
  }
  if (obstacle === 'strawberry') {
    // A quick pop and the juicy crush after it.
    mixAt(sound, pitchDrop(sampleRate, 900, 450, 0.04), 0, sampleRate);
    mixAt(sound, noiseBurst(sampleRate, 0.3, 1000, 4000, 0.008, random), 0, sampleRate, 3);
  }
  if (obstacle === 'cactus') {
    // A soft low knock under a run of dry cracks.
    mixAt(sound, pitchDrop(sampleRate, 180, 180, 0.06), 0, sampleRate, 0.4);
    const cracks = Math.floor(between(5, 9));
    for (let crack = 0; crack < cracks; crack++) {
      mixAt(sound, noiseBurst(sampleRate, between(0.004, 0.01), 1000, 3500, 0.001, random), between(FIRST_CRACK_SECONDS, 0.18), sampleRate, between(2, 4));
    }
  }
  return fadeEdges(normalizePeak(lowPass(sound, sampleRate, SOFTENING_HZ), PEAK), sampleRate);
}

const BREAK_SECONDS: Record<BreakingObstacle, number> = { watermelon: 0.75, strawberry: 0.5, cactus: 0.4 };
