import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createRandom } from '../../src/logic/random';
import { createLofiComposer, eighthSeconds, LOFI_PROGRESSIONS, LOFI_SCALE, type LofiNote, type MusicStyle } from '../../src/audio/lofi';

const EIGHTHS_PER_BAR = 8;

/** The notes of the first `count` eighths, from a composer with a fixed seed. */
function compose(count: number, seed = 7, style: MusicStyle = 'game'): LofiNote[][] {
  const composer = createLofiComposer(style, createRandom(seed));
  return Array.from({ length: count }, (_, step) => composer.eighth(step));
}

const of = (notes: LofiNote[], instrument: LofiNote['instrument']) => notes.filter((note) => note.instrument === instrument);

describe('lo-fi composer, game style', () => {
  it('lasts an eighth of a beat at the configured tempo', () => {
    expect(eighthSeconds('game')).toBeCloseTo(60 / config.audio.music.styles.game.bpm / 2);
  });

  it('plays the whole chord of each bar on its first eighth, with the root an octave lower in the bass and a kick', () => {
    const bars = compose(EIGHTHS_PER_BAR * LOFI_PROGRESSIONS.game.length);
    LOFI_PROGRESSIONS.game.forEach((chord, bar) => {
      const first = bars[bar * EIGHTHS_PER_BAR]!;
      expect(of(first, 'chord').map((note) => note.midi)).toEqual(chord);
      expect(of(first, 'bass').map((note) => note.midi)).toEqual([chord[0]! - 12]);
      expect(of(first, 'kick')).toHaveLength(1);
    });
  });

  it('goes back to the first chord after the last one', () => {
    const notes = compose(EIGHTHS_PER_BAR * LOFI_PROGRESSIONS.game.length + 1);
    expect(of(notes.at(-1)!, 'chord').map((note) => note.midi)).toEqual(LOFI_PROGRESSIONS.game[0]);
  });

  it('kicks only on the first and third beat of every bar', () => {
    const kicked = compose(EIGHTHS_PER_BAR * 4).flatMap((notes, step) => (of(notes, 'kick').length ? [step % EIGHTHS_PER_BAR] : []));
    expect(new Set(kicked)).toEqual(new Set([0, 4]));
  });

  it('brushes every eighth, softer off the beat', () => {
    const notes = compose(EIGHTHS_PER_BAR);
    notes.forEach((eighth) => expect(of(eighth, 'brush')).toHaveLength(1));
    expect(of(notes[1]!, 'brush')[0]!.level).toBeLessThan(of(notes[0]!, 'brush')[0]!.level);
  });

  it('swings: everything off the beat comes swing eighths late, everything on the beat on time', () => {
    const notes = compose(EIGHTHS_PER_BAR);
    const late = config.audio.music.styles.game.swing * eighthSeconds('game');
    expect(of(notes[0]!, 'brush')[0]!.delaySeconds).toBe(0);
    expect(of(notes[1]!, 'brush')[0]!.delaySeconds).toBeCloseTo(late);
  });

  it('keeps the melody in the scale, moving at most two scale steps at a time', () => {
    const melody = compose(2000).flatMap((notes) => of(notes, 'melody').map((note) => note.midi!));
    expect(melody.length).toBeGreaterThan(100);
    expect(melody.every((midi) => LOFI_SCALE.includes(midi))).toBe(true);
    melody.slice(1).forEach((midi, index) => {
      expect(Math.abs(LOFI_SCALE.indexOf(midi) - LOFI_SCALE.indexOf(melody[index]!))).toBeLessThanOrEqual(2);
    });
  });

  it('plays a melody note on about melodyChance of the eighths', () => {
    const eighths = 4000;
    const played = compose(eighths).filter((notes) => of(notes, 'melody').length > 0).length;
    expect(played / eighths).toBeCloseTo(config.audio.music.styles.game.melodyChance, 1);
  });

  it('plays the same notes from the same random numbers', () => {
    expect(compose(64, 3)).toEqual(compose(64, 3));
    expect(compose(64, 3)).not.toEqual(compose(64, 4));
  });
});

describe('lo-fi composer, menu style', () => {
  it('is slower: an eighth lasts 60 / 60 / 2 s', () => {
    expect(eighthSeconds('menu')).toBeCloseTo(60 / 60 / 2);
  });

  it('has no kick', () => {
    expect(compose(EIGHTHS_PER_BAR * 8, 7, 'menu').flatMap((notes) => of(notes, 'kick'))).toEqual([]);
  });

  it('brushes more softly than in play', () => {
    const brushLevels = (style: MusicStyle) => compose(2, 7, style).map((notes) => of(notes, 'brush')[0]!.level);
    brushLevels('menu').forEach((level, eighth) => expect(level).toBeLessThan(brushLevels('game')[eighth]!));
  });

  it('follows its own progression, one chord per bar', () => {
    const bars = compose(EIGHTHS_PER_BAR * LOFI_PROGRESSIONS.menu.length, 7, 'menu');
    const chords = LOFI_PROGRESSIONS.menu.map((_, bar) => of(bars[bar * EIGHTHS_PER_BAR]!, 'chord').map((note) => note.midi));
    expect(chords).toEqual(LOFI_PROGRESSIONS.menu);
  });

  it('plays fewer melody notes than in play, from the same random numbers', () => {
    const melodyNotes = (style: MusicStyle) => compose(2000, 7, style).flatMap((notes) => of(notes, 'melody')).length;
    expect(melodyNotes('menu')).toBeLessThan(melodyNotes('game'));
  });

  it('lets each chord ring through its whole bar, so the menu never falls silent between chords', () => {
    const barSeconds = eighthSeconds('menu') * EIGHTHS_PER_BAR;
    const firstChord = of(compose(1, 7, 'menu')[0]!, 'chord');
    firstChord.forEach((note) => expect(note.seconds).toBeGreaterThan(barSeconds));
  });
});
