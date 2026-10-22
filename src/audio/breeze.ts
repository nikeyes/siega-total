import { config } from '../config';
import { createRandom } from '../logic/random';
import { synthesizeCutLoop } from './cutLoop';
import { sliderGain } from './volume';

export interface BreezeSound {
  /** Fades the breeze in or out; muted, it stays silent. */
  setBlowing(blowing: boolean): void;
  setEnabled(enabled: boolean): void;
  /** The effects slider, from 0 to 1. */
  setVolume(position: number): void;
}

const SILENT_BREEZE: BreezeSound = { setBlowing: () => {}, setEnabled: () => {}, setVolume: () => {} };
/** Seconds in the loop: a whole number of sways, and long enough that the repeat is not heard. */
const LOOP_SECONDS = 4;
/** The same snips every session, so tuning by ear holds. */
const LOOP_SEED = 1;

/** The cutting sound: a loop of crisp snips over a swaying hiss, faded in and out as the blade cuts. */
export function createBreezeSound(context: AudioContext | null): BreezeSound {
  if (!context) return SILENT_BREEZE;
  const samples = synthesizeCutLoop(context.sampleRate, LOOP_SECONDS, createRandom(LOOP_SEED));
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(context.destination);
  source.start();

  let enabled = true;
  let blowing = false;
  let volume = 1;

  function fade(): void {
    const { levelDb, fadeInSeconds, fadeOutSeconds } = config.audio.breeze;
    const on = enabled && blowing;
    // The loop has unit RMS, so this gain is its loudness.
    gain.gain.setTargetAtTime(on ? 10 ** (levelDb / 20) * sliderGain(volume) : 0, context!.currentTime, on ? fadeInSeconds : fadeOutSeconds);
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
    setVolume(position: number): void {
      volume = position;
      fade();
    },
  };
}
