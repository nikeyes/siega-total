import { bandPass, lowPass } from './filters';

/** Every synthesized sound swells in over this long, so it starts without a click. */
const ATTACK_SECONDS = 0.008;
/** Each generator fades by this much over its length: −40 dB. */
const FADE_OUT_RATIO = 0.01;

/** Level from 0 to 1 at `time`: a soft quadratic swell over `attackSeconds`, then an exponential fade to −40 dB at `seconds`. */
function envelope(time: number, seconds: number, attackSeconds = ATTACK_SECONDS): number {
  const swell = time < attackSeconds ? (time / attackSeconds) ** 2 : 1;
  return swell * FADE_OUT_RATIO ** (Math.max(0, time - attackSeconds) / Math.max(seconds - attackSeconds, 1e-9));
}

/** A sine that glides from `fromHz` to `toHz` while it fades out over `seconds`: a thump or a pop. */
export function pitchDrop(sampleRate: number, fromHz: number, toHz: number, seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const progress = i / samples.length;
    phase += (2 * Math.PI * fromHz * (toHz / fromHz) ** progress) / sampleRate;
    samples[i] = Math.sin(phase) * envelope(i / sampleRate, seconds);
  }
  return samples;
}

/** Noise between `lowHz` and `highHz` that swells in over `attackSeconds` and fades out over `seconds`: a splash, a crack or a sparkle. */
export function noiseBurst(
  sampleRate: number,
  seconds: number,
  lowHz: number,
  highHz: number,
  attackSeconds: number,
  random: () => number,
): Float32Array {
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const noise = bandPass(Float32Array.from({ length }, () => random() * 2 - 1), sampleRate, lowHz, highHz);
  return noise.map((sample, i) => sample * envelope(i / sampleRate, seconds, attackSeconds));
}

/** Harmonics of a bell note, after its fundamental: the 2nd at 25 % and the 3rd at 8 %. */
const BELL_HARMONICS = [
  { multiple: 2, level: 0.25 },
  { multiple: 3, level: 0.08 },
];
const BELL_ATTACK_SECONDS = 0.005;
const BELL_LOW_PASS_HZ = 5000;

/** A soft bell note at `frequency`: a sine with two quiet harmonics, a 5 ms attack and an exponential fade over `seconds`. */
export function bell(sampleRate: number, frequency: number, seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    const tone = BELL_HARMONICS.reduce(
      (sum, { multiple, level }) => sum + level * Math.sin(2 * Math.PI * frequency * multiple * time),
      Math.sin(2 * Math.PI * frequency * time),
    );
    samples[i] = tone * envelope(time, seconds, BELL_ATTACK_SECONDS);
  }
  return lowPass(samples, sampleRate, BELL_LOW_PASS_HZ);
}

/** Adds `source`, scaled by `gain`, into `target` from `offsetSeconds` on; what runs past the end is dropped. */
export function mixAt(target: Float32Array, source: Float32Array, offsetSeconds: number, sampleRate: number, gain = 1): void {
  const offset = Math.round(offsetSeconds * sampleRate);
  for (let i = 0; i < source.length && offset + i < target.length; i++) target[offset + i]! += source[i]! * gain;
}

/** Scales `samples` in place so their loudest sample is `peak`. */
export function normalizePeak(samples: Float32Array, peak: number): Float32Array {
  const loudest = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  if (loudest > 0) samples.forEach((sample, i) => (samples[i] = (sample * peak) / loudest));
  return samples;
}

/** Fades the first and last few milliseconds in place, so the sound starts and ends at zero. */
const EDGE_FADE_SECONDS = 0.003;
export function fadeEdges(samples: Float32Array, sampleRate: number): Float32Array {
  const fade = Math.min(Math.round(EDGE_FADE_SECONDS * sampleRate), Math.floor(samples.length / 2));
  for (let i = 0; i < fade; i++) {
    samples[i]! *= i / fade;
    samples[samples.length - 1 - i]! *= i / fade;
  }
  return samples;
}
