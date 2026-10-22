import { config } from '../config';

export interface LofiNote {
  instrument: 'chord' | 'melody' | 'bass' | 'kick' | 'brush';
  /** MIDI note; none for the kick and the brush. */
  midi?: number;
  /** After the start of the eighth: the swing, and the strum of a chord. */
  delaySeconds: number;
  /** How long the note rings. */
  seconds: number;
  level: number;
}

export type MusicStyle = keyof typeof config.audio.music.styles;

/**
 * One bar per chord. In play, Fmaj7, Em7, Dm7, Cmaj7: a slow walk down.
 * In the menus, Fmaj7, Cmaj7, Fmaj7, G6: it stays close to home.
 */
export const LOFI_PROGRESSIONS: Record<MusicStyle, readonly (readonly number[])[]> = {
  game: [
    [53, 57, 60, 64],
    [52, 55, 59, 62],
    [50, 53, 57, 60],
    [48, 52, 55, 59],
  ],
  menu: [
    [53, 57, 60, 64],
    [48, 52, 55, 59],
    [53, 57, 60, 64],
    [55, 59, 62, 64],
  ],
};
/** C major pentatonic, an octave above the chords. */
export const LOFI_SCALE: readonly number[] = [72, 74, 76, 79, 81, 84];

const EIGHTHS_PER_BAR = 8;
/** Eighths of the bar that play the chord again, softer: «and» of two. */
const CHORD_ECHO_EIGHTH = 3;
const KICK_EIGHTHS = [0, 4];
/** The notes of a chord come this far apart, like fingers on a keyboard. */
const STRUM_SECONDS = 0.012;
const RING_SECONDS = { melody: 1.2, bass: 1.4, kick: 0.3, brush: 0.06 };
/** Scale steps the melody can take from one note to the next, the small ones more often. */
const MELODY_STEPS = [-2, -1, -1, 0, 1, 1, 2];

export function eighthSeconds(style: MusicStyle): number {
  return 60 / config.audio.music.styles[style].bpm / 2;
}

export interface LofiComposer {
  /** The notes of eighth number `step`, counted from the start of the music. */
  eighth(step: number): LofiNote[];
}

/** Slow lo-fi in `style`: an electric piano on four chords, soft bass, kick and brushes, and a melody that wanders the scale. */
export function createLofiComposer(style: MusicStyle, random: () => number = Math.random): LofiComposer {
  const chords = LOFI_PROGRESSIONS[style];
  let melodyIndex = Math.floor(LOFI_SCALE.length / 2);

  function eighth(step: number): LofiNote[] {
    const { swing, melodyChance, levels, ringSeconds } = config.audio.music.styles[style];
    const inBar = step % EIGHTHS_PER_BAR;
    const chord = chords[Math.floor(step / EIGHTHS_PER_BAR) % chords.length]!;
    const delay = step % 2 === 1 ? swing * eighthSeconds(style) : 0;
    const notes: LofiNote[] = [];
    const strum = (seconds: number, level: number) =>
      chord.forEach((midi, finger) => notes.push({ instrument: 'chord', midi, delaySeconds: delay + finger * STRUM_SECONDS, seconds, level }));

    if (inBar === 0) {
      strum(ringSeconds.chord, levels.chord);
      notes.push({ instrument: 'bass', midi: chord[0]! - 12, delaySeconds: delay, seconds: RING_SECONDS.bass, level: levels.bass });
    }
    if (inBar === CHORD_ECHO_EIGHTH) strum(ringSeconds.chordEcho, levels.chordEcho);
    if (levels.kick > 0 && KICK_EIGHTHS.includes(inBar)) notes.push({ instrument: 'kick', delaySeconds: delay, seconds: RING_SECONDS.kick, level: levels.kick });
    const brushLevel = inBar % 2 === 0 ? levels.brushOnBeat : levels.brushOffBeat;
    notes.push({ instrument: 'brush', delaySeconds: delay, seconds: RING_SECONDS.brush, level: brushLevel });
    if (random() < melodyChance) {
      const move = MELODY_STEPS[Math.floor(random() * MELODY_STEPS.length)]!;
      melodyIndex = Math.max(0, Math.min(LOFI_SCALE.length - 1, melodyIndex + move));
      notes.push({ instrument: 'melody', midi: LOFI_SCALE[melodyIndex]!, delaySeconds: delay, seconds: RING_SECONDS.melody, level: levels.melody });
    }
    return notes;
  }

  return { eighth };
}
