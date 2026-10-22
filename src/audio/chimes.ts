import { lowPass } from './filters';
import { bell, fadeEdges, mixAt, normalizePeak } from './synthesis';

/** Every chime peaks here before its volume in config.audio.volume. */
const PEAK = 0.5;
const A4 = 440;
const E4 = 330;
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
