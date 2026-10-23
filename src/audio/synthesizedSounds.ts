import { config } from '../config';
import { createRandom } from '../logic/random';
import { synthesizeBreak, synthesizeHit, synthesizeRockBump } from './breakSounds';
import { synthesizeConfetti, synthesizeLevelComplete, synthesizeLowTime, synthesizeStar } from './chimes';

type Synthesizer = (sampleRate: number, random: () => number) => Float32Array;

/** The sounds made in code rather than downloaded. */
export const SYNTHESIZED_SOUNDS = {
  watermelonBreak: (sampleRate, random) => synthesizeBreak('watermelon', sampleRate, random),
  strawberryBreak: (sampleRate, random) => synthesizeBreak('strawberry', sampleRate, random),
  cactusBreak: (sampleRate, random) => synthesizeBreak('cactus', sampleRate, random),
  fruitHit: (sampleRate, random) => synthesizeHit(sampleRate, random),
  rockBump: (sampleRate, random) => synthesizeRockBump(sampleRate, random),
  lowTime: (sampleRate) => synthesizeLowTime(sampleRate),
  levelComplete: (sampleRate) => synthesizeLevelComplete(sampleRate),
  star1: (sampleRate) => synthesizeStar(1, sampleRate),
  star2: (sampleRate) => synthesizeStar(2, sampleRate),
  star3: (sampleRate) => synthesizeStar(3, sampleRate),
  confetti: (sampleRate, random) => synthesizeConfetti(sampleRate, random),
} satisfies Record<string, Synthesizer>;

export type SynthesizedSoundName = keyof typeof SYNTHESIZED_SOUNDS;

export const SYNTHESIZED_SOUND_NAMES = Object.keys(SYNTHESIZED_SOUNDS) as SynthesizedSoundName[];

/** The breaks, the hits and the rock bump vary, so twenty in a row do not tire; the other sounds have one version. */
const VARIED_SOUNDS = new Set<SynthesizedSoundName>(['watermelonBreak', 'strawberryBreak', 'cactusBreak', 'fruitHit', 'rockBump']);
/** Every session synthesizes the same variants. */
const VARIANT_SEED = 1000;

export function variantsOf(name: SynthesizedSoundName): number {
  return VARIED_SOUNDS.has(name) ? config.audio.variants : 1;
}

/** The versions of `name` the player picks from. */
export function synthesizeVariants(name: SynthesizedSoundName, sampleRate: number): Float32Array[] {
  return Array.from({ length: variantsOf(name) }, (_, variant) => SYNTHESIZED_SOUNDS[name](sampleRate, createRandom(VARIANT_SEED + variant)));
}

/** How fast to play `name` this time: each break a little higher or lower, every other sound at its own pitch. */
export function playbackRate(name: string, random: () => number): number {
  if (!VARIED_SOUNDS.has(name as SynthesizedSoundName)) return 1;
  return 1 + (random() * 2 - 1) * config.audio.pitchJitter;
}

export function isSynthesized(name: string): name is SynthesizedSoundName {
  return name in SYNTHESIZED_SOUNDS;
}
