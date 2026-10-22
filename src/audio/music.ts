import { config } from '../config';
import { sliderGain } from './volume';
import { createLofiComposer, eighthSeconds, type LofiNote } from './lofi';

export interface MusicPlayer {
  /** Fades the music in or out; it keeps its place in the song while it is silent. */
  setPlaying(playing: boolean): void;
  /** The music slider, from 0 to 1. */
  setVolume(position: number): void;
}

const SILENT_MUSIC: MusicPlayer = { setPlaying: () => {}, setVolume: () => {} };
/** How often the scheduler wakes up, and how far ahead it books notes, so a late timer never drops one. */
const SCHEDULER_MS = 60;
const LOOKAHEAD_SECONDS = 0.25;
const REVERB_SECONDS = 2.8;
const REVERB_DECAY = 2.6;

/** The lo-fi background music, composed as it plays. */
export function createMusicPlayer(context: AudioContext | null): MusicPlayer {
  if (!context) return SILENT_MUSIC;
  const ctx = context;
  const composer = createLofiComposer();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const reverb = ctx.createConvolver();
  reverb.buffer = reverbImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = config.audio.music.reverb;
  reverb.connect(wet).connect(master);

  let playing = false;
  let volume = 1;
  let timer: ReturnType<typeof setInterval> | null = null;
  let step = 0;
  let nextEighth = 0;

  function schedule(): void {
    // A suspended context's clock stands still: start booking again from now once it runs.
    if (ctx.state !== 'running') {
      nextEighth = 0;
      return;
    }
    if (nextEighth < ctx.currentTime) nextEighth = ctx.currentTime + 0.05;
    while (nextEighth < ctx.currentTime + LOOKAHEAD_SECONDS) {
      for (const note of composer.eighth(step)) play(note, nextEighth + note.delaySeconds);
      nextEighth += eighthSeconds();
      step++;
    }
  }

  function play(note: LofiNote, time: number): void {
    if (note.instrument === 'chord' || note.instrument === 'melody') electricPiano(ctx, [master, reverb], note, time);
    else if (note.instrument === 'bass') sine(ctx, master, frequencyOf(note.midi!), note, time);
    else if (note.instrument === 'kick') kick(ctx, master, note, time);
    else brush(ctx, master, note, time);
  }

  function fade(): void {
    const { fadeSeconds, volume: fullVolume } = config.audio.music;
    master.gain.setTargetAtTime(playing ? fullVolume * sliderGain(volume) : 0, ctx.currentTime, fadeSeconds / 3);
  }

  function setVolume(position: number): void {
    volume = position;
    fade();
  }

  function setPlaying(next: boolean): void {
    if (next === playing) return;
    playing = next;
    fade();
    if (playing && !timer) {
      timer = setInterval(schedule, SCHEDULER_MS);
      schedule();
    }
    if (!playing) {
      // Keeps booking notes while it fades out, then stops.
      setTimeout(() => {
        if (playing || !timer) return;
        clearInterval(timer);
        timer = null;
        nextEighth = 0;
      }, config.audio.music.fadeSeconds * 1000);
    }
  }

  return { setPlaying, setVolume };
}

function frequencyOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A warm electric piano: a sine and a soft octave above, with a slow tremolo. */
function electricPiano(ctx: AudioContext, outputs: AudioNode[], note: LofiNote, time: number): void {
  const tremolo = ctx.createGain();
  for (const output of outputs) tremolo.connect(output);
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 4.2;
  const depth = ctx.createGain();
  depth.gain.value = 0.18;
  wobble.connect(depth).connect(tremolo.gain);
  for (const [ratio, share] of [[1, 1], [2, 0.18]] as const) {
    sine(ctx, tremolo, frequencyOf(note.midi!) * ratio, { ...note, level: note.level * share }, time);
  }
  wobble.start(time);
  wobble.stop(time + note.seconds + 0.05);
}

function sine(ctx: AudioContext, output: AudioNode, frequency: number, { level, seconds }: LofiNote, time: number): void {
  const oscillator = ctx.createOscillator();
  oscillator.frequency.value = frequency;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, time);
  envelope.gain.linearRampToValueAtTime(level, time + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
  oscillator.connect(envelope).connect(output);
  oscillator.start(time);
  oscillator.stop(time + seconds + 0.05);
}

/** A soft thump: a sine falling from 110 to 48 Hz. */
function kick(ctx: AudioContext, output: AudioNode, { level, seconds }: LofiNote, time: number): void {
  const oscillator = ctx.createOscillator();
  oscillator.frequency.setValueAtTime(110, time);
  oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.12);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(level, time);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
  oscillator.connect(envelope).connect(output);
  oscillator.start(time);
  oscillator.stop(time + seconds + 0.05);
}

/** A brush on a snare: a short puff of high noise. */
function brush(ctx: AudioContext, output: AudioNode, { level, seconds }: LofiNote, time: number): void {
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx, seconds);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 5000;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(level, time);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
  source.connect(highpass).connect(envelope).connect(output);
  source.start(time);
}

const noiseBuffers = new Map<number, AudioBuffer>();
function noise(ctx: AudioContext, seconds: number): AudioBuffer {
  let buffer = noiseBuffers.get(seconds);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(seconds, buffer);
  }
  return buffer;
}

/** A room made of noise that dies away, for a soft reverb. */
function reverbImpulse(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(REVERB_SECONDS * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, REVERB_DECAY);
  }
  return buffer;
}
