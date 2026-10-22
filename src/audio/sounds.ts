import { config } from '../config';
import { isSynthesized, playbackRate, synthesizeVariants } from './synthesizedSounds';
import { sliderGain } from './volume';

export type SoundName = keyof typeof config.audio.volume;

export interface SoundPlayer {
  /** Plays `variant` of `name`, or a random one; silent while locked, muted or still loading. */
  play(name: SoundName, variant?: number): void;
  /** Muting also stops the sounds that are playing. */
  setEnabled(enabled: boolean): void;
  /** The effects slider, from 0 to 1. */
  setVolume(position: number): void;
  /** The audio context the breeze and the music play in too, so one gesture unlocks them all; null without WebAudio. */
  readonly context: AudioContext | null;
}

const SOUND_NAMES = Object.keys(config.audio.volume) as SoundName[];
/** The player of a browser without WebAudio: the game just plays in silence. */
const SILENT_PLAYER: SoundPlayer = { play: () => {}, setEnabled: () => {}, setVolume: () => {}, context: null };

/**
 * Plays the sounds synthesized in code and Kenney's from `baseUrl` (one `<name>.mp3` each);
 * `onPlayed` hears every sound actually sent out.
 */
export function createSoundPlayer(baseUrl: string, onPlayed?: (name: SoundName, rate: number) => void): SoundPlayer {
  if (typeof AudioContext === 'undefined') return SILENT_PLAYER;
  const context = new AudioContext();
  const buffers: Partial<Record<SoundName, AudioBuffer[]>> = {};
  const playing = new Set<AudioBufferSourceNode>();
  let enabled = true;
  let volume = 1;

  // Browsers start the context suspended until a gesture. Layers stop pointerdown, so this listens in the capture phase.
  // A touch only counts as a gesture when it ends (pointerup, touchend on iPhone); pointerdown counts for the mouse.
  const unlockEvents = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;
  function unlock(): void {
    context.resume().catch((error: unknown) => console.warn('The audio context did not resume.', error));
  }
  // Listens while the context is not running: at first, and again if the phone interrupts it later (a call, the app in the background).
  function listenForUnlock(): void {
    const running = context.state === 'running';
    for (const type of unlockEvents) {
      if (running) window.removeEventListener(type, unlock, { capture: true });
      else window.addEventListener(type, unlock, { capture: true });
    }
  }
  context.addEventListener('statechange', listenForUnlock);
  listenForUnlock();

  for (const name of SOUND_NAMES) {
    if (isSynthesized(name)) {
      // One sound per task, so synthesizing them all does not hold up the first frames on a phone.
      setTimeout(() => {
        buffers[name] = synthesizeVariants(name, context.sampleRate).map((samples) => {
          const buffer = context.createBuffer(1, samples.length, context.sampleRate);
          buffer.getChannelData(0).set(samples);
          return buffer;
        });
      });
      continue;
    }
    fetch(baseUrl + name + '.mp3')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then(
        (buffer) => {
          buffers[name] = [buffer];
        },
        (error: unknown) => console.warn(`Sound ${name} failed to load; it stays silent.`, error),
      );
  }

  function play(name: SoundName, variant?: number): void {
    const variants = buffers[name];
    if (!enabled || context.state !== 'running' || !variants) return;
    const buffer = variants[(variant ?? Math.floor(Math.random() * variants.length)) % variants.length]!;
    const rate = playbackRate(name, Math.random);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = context.createGain();
    gain.gain.value = config.audio.volume[name] * sliderGain(volume);
    source.connect(gain).connect(context.destination);
    playing.add(source);
    source.onended = () => playing.delete(source);
    source.start();
    onPlayed?.(name, rate);
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    if (enabled) return;
    for (const source of playing) source.stop();
    playing.clear();
  }

  function setVolume(position: number): void {
    volume = position;
  }

  return { play, setEnabled, setVolume, context };
}
