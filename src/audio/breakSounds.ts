import type { BreakingObstacle } from '../logic/feedback';
import { lowPass } from './filters';
import { bell, fadeEdges, mixAt, noiseBurst, normalizePeak, pitchDrop } from './synthesis';

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

const HIT_SECONDS = 0.2;
/** The hit stays below the break: dull, without the splash or the cracks. */
const HIT_SOFTENING_HZ = 1500;

/** A blow on a fruit that takes several: a dull thud and a little give, softer than the break that ends it. */
export function synthesizeHit(sampleRate: number, random: () => number): Float32Array {
  const between = (min: number, max: number) => min + (max - min) * random();
  const sound = new Float32Array(Math.round(HIT_SECONDS * sampleRate));
  mixAt(sound, pitchDrop(sampleRate, between(190, 230), between(110, 130), 0.12), 0, sampleRate);
  mixAt(sound, noiseBurst(sampleRate, 0.15, 300, 1200, 0.006, random), 0, sampleRate, 1.5);
  return fadeEdges(normalizePeak(lowPass(sound, sampleRate, HIT_SOFTENING_HZ), PEAK), sampleRate);
}

const ROCK_BUMP_SECONDS = 0.3;
/** Two bell partials this far apart ring like metal on stone, not like a note. */
const CLINK_PARTIAL_RATIO = 1.48;

/** The blade knocking into a rock it can never break: a dry knock under a short, hard clink. */
export function synthesizeRockBump(sampleRate: number, random: () => number): Float32Array {
  const between = (min: number, max: number) => min + (max - min) * random();
  const sound = new Float32Array(Math.round(ROCK_BUMP_SECONDS * sampleRate));
  const clinkHz = between(1000, 1150);
  mixAt(sound, pitchDrop(sampleRate, between(150, 170), 90, 0.05), 0, sampleRate, 0.6);
  mixAt(sound, bell(sampleRate, clinkHz, 0.18), 0, sampleRate, 0.6);
  mixAt(sound, bell(sampleRate, clinkHz * CLINK_PARTIAL_RATIO, 0.12), 0, sampleRate, 0.35);
  mixAt(sound, noiseBurst(sampleRate, 0.03, 800, 3000, 0.002, random), 0, sampleRate, 0.5);
  return fadeEdges(normalizePeak(lowPass(sound, sampleRate, SOFTENING_HZ), PEAK), sampleRate);
}
