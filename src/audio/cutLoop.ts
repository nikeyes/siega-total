/** The hiss swells and fades this often, like the blade sweeping through the grass. */
const SWAY_HZ = 7;
const SNIPS_PER_SECOND = 10;
const CRACKLES_PER_SECOND = 60;
/** Each noise layer, as a frequency band and a level. */
const HISS = { lowHz: 2500, highHz: 11000, level: 0.16 };
const BODY = { lowHz: 600, highHz: 2500, level: 0.1 };
const SNIP = { minSeconds: 0.012, maxSeconds: 0.045, attackSeconds: 0.0015, minHz: 2500, maxHz: 8000 };
const CRACKLE = { seconds: 0.003, lowHz: 5000, highHz: 14000, minLevel: 0.1, maxLevel: 0.4 };
/** The end of the hiss blends into its start over this long. */
const SEAM_SECONDS = 0.25;

/**
 * The cutting sound: a crisp hiss that sways at SWAY_HZ, with short snips of blades being cut and tiny crackles of stems on top.
 * Returns `seconds` of samples with unit RMS that loop seamlessly; `seconds × SWAY_HZ` should be whole so the sway loops too.
 */
export function synthesizeCutLoop(sampleRate: number, seconds: number, random: () => number): Float32Array {
  const length = Math.round(seconds * sampleRate);
  const loop = new Float32Array(length);
  const between = (min: number, max: number) => min + (max - min) * random();
  const swayPhase = random();

  const hiss = loopingNoise(sampleRate, length, HISS, random);
  const body = loopingNoise(sampleRate, length, BODY, random);
  for (let i = 0; i < length; i++) {
    const sway = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * (SWAY_HZ * (i / sampleRate) + swayPhase))) ** 1.5;
    loop[i] = (hiss[i]! + body[i]!) * sway;
  }

  for (let time = -Math.log(1 - random()) / SNIPS_PER_SECOND; time < seconds; time += -Math.log(1 - random()) / SNIPS_PER_SECOND) {
    const centerHz = between(SNIP.minHz, SNIP.maxHz);
    const decay = between(4, 8);
    const attackSamples = SNIP.attackSeconds * sampleRate;
    addBurst(loop, Math.floor(time * sampleRate), sampleRate, between(SNIP.minSeconds, SNIP.maxSeconds), centerHz * 0.5, Math.min(centerHz * 1.6, 0.45 * sampleRate), random, (i, burstLength) =>
      between(0.5, 1) * Math.exp((-decay * i) / burstLength) * Math.min(1, i / attackSamples),
    );
  }

  for (let crackle = 0; crackle < CRACKLES_PER_SECOND * seconds; crackle++) {
    const level = between(CRACKLE.minLevel, CRACKLE.maxLevel);
    addBurst(loop, Math.floor(random() * length), sampleRate, CRACKLE.seconds, CRACKLE.lowHz, CRACKLE.highHz, random, (i, burstLength) => level * Math.exp((-6 * i) / burstLength));
  }

  const scale = 1 / Math.sqrt(loop.reduce((sum, sample) => sum + sample * sample, 0) / length);
  return loop.map((sample) => sample * scale);
}

/** Band-passed white noise, `length` samples long, whose end runs on into its start. */
function loopingNoise(sampleRate: number, length: number, band: { lowHz: number; highHz: number; level: number }, random: () => number): Float32Array {
  const seam = Math.floor(SEAM_SECONDS * sampleRate);
  const noise = bandPass(whiteNoise(length + seam, random), sampleRate, band.lowHz, band.highHz);
  const loop = noise.slice(0, length).map((sample) => sample * band.level);
  // The start fades in from what follows the end, so the loop goes round without a click.
  for (let i = 0; i < seam; i++) loop[i] = band.level * (noise[i]! * (i / seam) + noise[length + i]! * (1 - i / seam));
  return loop;
}

/** Adds a short band-passed noise burst shaped by `envelope`; a burst running past the end wraps round to the start. */
function addBurst(
  loop: Float32Array,
  start: number,
  sampleRate: number,
  seconds: number,
  lowHz: number,
  highHz: number,
  random: () => number,
  envelope: (i: number, burstLength: number) => number,
): void {
  const burstLength = Math.max(1, Math.floor(seconds * sampleRate));
  const burst = bandPass(whiteNoise(burstLength, random), sampleRate, lowHz, highHz);
  for (let i = 0; i < burstLength; i++) loop[(start + i) % loop.length]! += burst[i]! * envelope(i, burstLength);
}

function whiteNoise(length: number, random: () => number): Float32Array {
  return Float32Array.from({ length }, () => random() * 2 - 1);
}

/** Keeps the band between `lowHz` and `highHz` evenly loud: a Butterworth high-pass, then a Butterworth low-pass. */
function bandPass(samples: Float32Array, sampleRate: number, lowHz: number, highHz: number): Float32Array {
  return butterworth(butterworth(samples, sampleRate, lowHz, 'highpass'), sampleRate, highHz, 'lowpass');
}

/** A biquad with Q = 1/√2, from the Audio EQ Cookbook. */
function butterworth(input: Float32Array, sampleRate: number, cornerHz: number, type: 'highpass' | 'lowpass'): Float32Array {
  const omega = (2 * Math.PI * cornerHz) / sampleRate;
  const cos = Math.cos(omega);
  const alpha = Math.sin(omega) / Math.SQRT2;
  const a0 = 1 + alpha;
  const b0 = (type === 'lowpass' ? 1 - cos : 1 + cos) / 2 / a0;
  const [b1, b2, a1, a2] = [type === 'lowpass' ? 2 * b0 : -2 * b0, b0, (-2 * cos) / a0, (1 - alpha) / a0];
  const output = new Float32Array(input.length);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < input.length; i++) {
    const y = b0 * input[i]! + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, input[i]!, y1, y];
    output[i] = y;
  }
  return output;
}
