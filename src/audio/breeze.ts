import { config } from '../config';

export interface BreezeSound {
  /** Fades the breeze in or out; muted, it stays silent. */
  setBlowing(blowing: boolean): void;
  setEnabled(enabled: boolean): void;
}

const SILENT_BREEZE: BreezeSound = { setBlowing: () => {}, setEnabled: () => {} };
/** Seconds of noise in the loop; long enough that the repeat is not heard. */
const LOOP_SECONDS = 6;
/** The end of the loop blends into its start over this long. */
const LOOP_SEAM_SECONDS = 0.5;

/** The cutting sound: a loop of soft brown noise whose low-pass sways, faded in and out as the blade cuts. */
export function createBreezeSound(context: AudioContext | null): BreezeSound {
  if (!context) return SILENT_BREEZE;
  const { highpassHz, lowpassHz, swayHz, swayDepthHz } = config.audio.breeze;
  const source = context.createBufferSource();
  source.buffer = brownNoise(context, LOOP_SECONDS);
  source.loop = true;
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = highpassHz;
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = lowpassHz;
  lowpass.Q.value = 0.4;
  const sway = context.createOscillator();
  sway.frequency.value = swayHz;
  const swayDepth = context.createGain();
  swayDepth.gain.value = swayDepthHz;
  sway.connect(swayDepth).connect(lowpass.frequency);
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(highpass).connect(lowpass).connect(gain).connect(context.destination);
  source.start();
  sway.start();

  let enabled = true;
  let blowing = false;

  function fade(): void {
    const { volume, fadeInSeconds, fadeOutSeconds } = config.audio.breeze;
    const on = enabled && blowing;
    gain.gain.setTargetAtTime(on ? volume : 0, context!.currentTime, on ? fadeInSeconds : fadeOutSeconds);
  }

  return {
    setBlowing(next: boolean): void {
      if (next === blowing) return;
      blowing = next;
      fade();
    },
    setEnabled(next: boolean): void {
      enabled = next;
      fade();
    },
  };
}

/** Random steps that wander slowly: a deep, soft noise without the hiss of white noise. */
function brownNoise(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(seconds * context.sampleRate);
  const seam = Math.floor(LOOP_SEAM_SECONDS * context.sampleRate);
  const walk = new Float32Array(length + seam);
  let last = 0;
  for (let i = 0; i < walk.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    walk[i] = last * 3.5;
  }
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  data.set(walk.subarray(0, length));
  // The start fades in from what follows the end, so the loop goes round without a click.
  for (let i = 0; i < seam; i++) data[i] = walk[i]! * (i / seam) + walk[length + i]! * (1 - i / seam);
  return buffer;
}
