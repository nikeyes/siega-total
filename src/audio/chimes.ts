import { lowPass } from './filters';
import { bell, fadeEdges, mixAt, noiseBurst, normalizePeak } from './synthesis';

/** Every chime peaks here before its volume in config.audio.volume. */
const PEAK = 0.5;
const A4 = 440;
const E4 = 330;
const G4 = 392;
const C5 = 523;
const E5 = 659;
const G5 = 784;
const LOW_TIME_SECONDS = 1.2;
/** The warning is rounded off further than the other chimes, so it nudges rather than alarms. */
const LOW_TIME_LOW_PASS_HZ = 3000;

/** The soft low-time warning: A4 falling to E4. */
export function synthesizeLowTime(sampleRate: number): Float32Array {
  const sound = new Float32Array(Math.round(LOW_TIME_SECONDS * sampleRate));
  mixAt(sound, bell(sampleRate, A4, 0.7), 0, sampleRate);
  mixAt(sound, bell(sampleRate, E4, 0.7), 0.5, sampleRate);
  return fadeEdges(normalizePeak(lowPass(sound, sampleRate, LOW_TIME_LOW_PASS_HZ), PEAK), sampleRate);
}

const LEVEL_COMPLETE_NOTES = [C5, E5, G5];
const ARPEGGIO_GAP_SECONDS = 0.08;
const LEVEL_COMPLETE_TAIL_SECONDS = 1.2;

/** «Bar complete»: a quick C5, E5, G5 arpeggio that rings on. */
export function synthesizeLevelComplete(sampleRate: number): Float32Array {
  const lastNote = (LEVEL_COMPLETE_NOTES.length - 1) * ARPEGGIO_GAP_SECONDS;
  const sound = new Float32Array(Math.round((lastNote + LEVEL_COMPLETE_TAIL_SECONDS) * sampleRate));
  LEVEL_COMPLETE_NOTES.forEach((note, index) =>
    mixAt(sound, bell(sampleRate, note, LEVEL_COMPLETE_TAIL_SECONDS), index * ARPEGGIO_GAP_SECONDS, sampleRate),
  );
  return fadeEdges(normalizePeak(sound, PEAK), sampleRate);
}

/** Each star's note, rising: E4, G4, C5. */
const STAR_NOTES = [E4, G4, C5];
const STAR_SECONDS = 0.9;

/** The note of star `index`, from 1 to 3. */
export function synthesizeStar(index: number, sampleRate: number): Float32Array {
  return fadeEdges(normalizePeak(bell(sampleRate, STAR_NOTES[index - 1]!, STAR_SECONDS), PEAK), sampleRate);
}

const CONFETTI_SECONDS = 1.2;
/** The sparkles come thickest at the start and thin out by this time. */
const CONFETTI_SPARKLES_UNTIL = 0.9;
const CONFETTI_FIRST_SPARKLE_SECONDS = 0.01;
/** Softer than the original's bright confetti: little above this, cut twice as steeply as the other sounds. */
const CONFETTI_LOW_PASS_HZ = 4500;

/** Confetti falling: soft sparkles of high noise over a breath that fades away. */
export function synthesizeConfetti(sampleRate: number, random: () => number): Float32Array {
  const between = (min: number, max: number) => min + (max - min) * random();
  const sound = new Float32Array(Math.round(CONFETTI_SECONDS * sampleRate));
  mixAt(sound, noiseBurst(sampleRate, CONFETTI_SECONDS, 300, 1500, 0.05, random), 0, sampleRate, 0.6);
  const sparkles = Math.floor(between(14, 21));
  for (let sparkle = 0; sparkle < sparkles; sparkle++) {
    const at = CONFETTI_FIRST_SPARKLE_SECONDS + CONFETTI_SPARKLES_UNTIL * random() ** 2;
    mixAt(sound, noiseBurst(sampleRate, between(0.01, 0.025), 2000, 4000, 0.002, random), at, sampleRate, between(1.5, 3));
  }
  const softened = lowPass(lowPass(sound, sampleRate, CONFETTI_LOW_PASS_HZ), sampleRate, CONFETTI_LOW_PASS_HZ);
  return fadeEdges(normalizePeak(softened, PEAK), sampleRate);
}
